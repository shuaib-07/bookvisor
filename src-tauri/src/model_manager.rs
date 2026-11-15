use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub model_id: String,
    pub filename: String,
    pub is_downloaded: bool,
    pub file_size_bytes: u64,
    pub expected_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub model_id: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub percent: f64,
    pub is_complete: bool,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct ModelManagerState {
    pub is_downloading: Arc<AtomicBool>,
    pub cancel_download: Arc<AtomicBool>,
}

pub fn get_models_dir(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let dir = app_data.join("models");
    fs::create_dir_all(&dir).ok();
    dir
}

pub fn get_model_specs(model_id: &str) -> Option<(&'static str, &'static str, u64)> {
    match model_id {
        "nomic_embed" => Some((
            "nomic-embed-text-v1.5.Q8_0.gguf",
            "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf",
            94_500_000,
        )),
        "reasoning_8b" => Some((
            "DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
            "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-8B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
            4_920_000_000,
        )),
        "reasoning_1.5b" => Some((
            "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
            "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
            1_120_000_000,
        )),
        "pro_7b" => Some((
            "qwen2.5-7b-instruct-q4_k_m.gguf",
            "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
            4_680_000_000,
        )),
        "balanced_3b" => Some((
            "qwen2.5-3b-instruct-q4_k_m.gguf",
            "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
            1_930_000_000,
        )),
        "light_1.5b" => Some((
            "qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
            986_000_000,
        )),
        _ => None,
    }
}

#[tauri::command]
pub fn check_model_status(app: AppHandle, model_id: String) -> ModelStatus {
    let models_dir = get_models_dir(&app);
    if let Some((filename, _url, expected_size)) = get_model_specs(&model_id) {
        let file_path = models_dir.join(filename);
        if file_path.exists() {
            let actual_size = fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);
            let is_downloaded = actual_size > 0 && actual_size >= (expected_size * 95 / 100);
            return ModelStatus {
                model_id,
                filename: filename.to_string(),
                is_downloaded,
                file_size_bytes: actual_size,
                expected_size_bytes: expected_size,
            };
        }
        return ModelStatus {
            model_id,
            filename: filename.to_string(),
            is_downloaded: false,
            file_size_bytes: 0,
            expected_size_bytes: expected_size,
        };
    }

    ModelStatus {
        model_id,
        filename: "unknown.gguf".to_string(),
        is_downloaded: false,
        file_size_bytes: 0,
        expected_size_bytes: 0,
    }
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    state: tauri::State<'_, ModelManagerState>,
    model_id: String,
) -> Result<(), String> {
    if state.is_downloading.load(Ordering::SeqCst) {
        return Err("Another download is already in progress".to_string());
    }

    let (filename, url, expected_size) = get_model_specs(&model_id)
        .ok_or_else(|| format!("Unknown model_id: {}", model_id))?;

    let models_dir = get_models_dir(&app);
    let target_path = models_dir.join(filename);
    let temp_path = models_dir.join(format!("{}.part", filename));

    state.is_downloading.store(true, Ordering::SeqCst);
    state.cancel_download.store(false, Ordering::SeqCst);

    let cancel_flag = state.cancel_download.clone();
    let is_downloading_flag = state.is_downloading.clone();
    let model_id_cloned = model_id.clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        let client = reqwest::Client::new();

        let mut downloaded: u64 = 0;
        let file_res = if temp_path.exists() {
            let existing_meta = fs::metadata(&temp_path).ok();
            downloaded = existing_meta.map(|m| m.len()).unwrap_or(0);
            fs::OpenOptions::new().append(true).open(&temp_path)
        } else {
            File::create(&temp_path)
        };

        let mut file = match file_res {
            Ok(f) => f,
            Err(e) => {
                is_downloading_flag.store(false, Ordering::SeqCst);
                let _ = app_handle.emit(
                    "model://download_progress",
                    DownloadProgressEvent {
                        model_id: model_id_cloned,
                        total_bytes: expected_size,
                        downloaded_bytes: 0,
                        percent: 0.0,
                        is_complete: false,
                        error: Some(format!("Failed to create local file: {}", e)),
                    },
                );
                return;
            }
        };

        let mut req = client.get(url);
        if downloaded > 0 {
            req = req.header("Range", format!("bytes={}-", downloaded));
        }

        let resp_res = req.send().await;
        let mut resp = match resp_res {
            Ok(r) if r.status().is_success() || r.status().as_u16() == 206 => r,
            Ok(r) => {
                is_downloading_flag.store(false, Ordering::SeqCst);
                let _ = app_handle.emit(
                    "model://download_progress",
                    DownloadProgressEvent {
                        model_id: model_id_cloned,
                        total_bytes: expected_size,
                        downloaded_bytes: downloaded,
                        percent: 0.0,
                        is_complete: false,
                        error: Some(format!("Server returned HTTP {}", r.status())),
                    },
                );
                return;
            }
            Err(e) => {
                is_downloading_flag.store(false, Ordering::SeqCst);
                let _ = app_handle.emit(
                    "model://download_progress",
                    DownloadProgressEvent {
                        model_id: model_id_cloned,
                        total_bytes: expected_size,
                        downloaded_bytes: downloaded,
                        percent: 0.0,
                        is_complete: false,
                        error: Some(e.to_string()),
                    },
                );
                return;
            }
        };

        let content_length = resp.content_length().unwrap_or(expected_size - downloaded);
        let total_size = downloaded + content_length;
        let mut last_emit = std::time::Instant::now();

        loop {
            if cancel_flag.load(Ordering::SeqCst) {
                is_downloading_flag.store(false, Ordering::SeqCst);
                return;
            }

            match resp.chunk().await {
                Ok(Some(chunk)) => {
                    if let Err(e) = file.write_all(&chunk) {
                        is_downloading_flag.store(false, Ordering::SeqCst);
                        let _ = app_handle.emit(
                            "model://download_progress",
                            DownloadProgressEvent {
                                model_id: model_id_cloned,
                                total_bytes: total_size,
                                downloaded_bytes: downloaded,
                                percent: (downloaded as f64 / total_size as f64) * 100.0,
                                is_complete: false,
                                error: Some(format!("Write error: {}", e)),
                            },
                        );
                        return;
                    }
                    downloaded += chunk.len() as u64;

                    if last_emit.elapsed().as_millis() >= 150 {
                        last_emit = std::time::Instant::now();
                        let percent = ((downloaded as f64 / total_size as f64) * 100.0 * 10.0).round() / 10.0;
                        let _ = app_handle.emit(
                            "model://download_progress",
                            DownloadProgressEvent {
                                model_id: model_id_cloned.clone(),
                                total_bytes: total_size,
                                downloaded_bytes: downloaded,
                                percent,
                                is_complete: false,
                                error: None,
                            },
                        );
                    }
                }
                Ok(None) => {
                    // Download complete
                    break;
                }
                Err(e) => {
                    is_downloading_flag.store(false, Ordering::SeqCst);
                    let _ = app_handle.emit(
                        "model://download_progress",
                        DownloadProgressEvent {
                            model_id: model_id_cloned,
                            total_bytes: total_size,
                            downloaded_bytes: downloaded,
                            percent: (downloaded as f64 / total_size as f64) * 100.0,
                            is_complete: false,
                            error: Some(format!("Network chunk error: {}", e)),
                        },
                    );
                    return;
                }
            }
        }

        drop(file);
        if let Err(e) = fs::rename(&temp_path, &target_path) {
            is_downloading_flag.store(false, Ordering::SeqCst);
            let _ = app_handle.emit(
                "model://download_progress",
                DownloadProgressEvent {
                    model_id: model_id_cloned,
                    total_bytes: total_size,
                    downloaded_bytes: downloaded,
                    percent: 100.0,
                    is_complete: false,
                    error: Some(format!("Failed to rename model file: {}", e)),
                },
            );
            return;
        }

        is_downloading_flag.store(false, Ordering::SeqCst);
        let _ = app_handle.emit(
            "model://download_progress",
            DownloadProgressEvent {
                model_id: model_id_cloned,
                total_bytes: total_size,
                downloaded_bytes: total_size,
                percent: 100.0,
                is_complete: true,
                error: None,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_model_download(state: tauri::State<ModelManagerState>) -> Result<(), String> {
    state.cancel_download.store(true, Ordering::SeqCst);
    state.is_downloading.store(false, Ordering::SeqCst);
    Ok(())
}
