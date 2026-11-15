use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTierInfo {
    pub id: String,
    pub name: String,
    pub parameter_size: String,
    pub download_size: String,
    pub min_ram_gb: f64,
    pub min_vram_gb: f64,
    pub is_supported: bool,
    pub is_recommended: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSpecs {
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub gpu_name: Option<String>,
    pub gpu_vram_gb: Option<f64>,
    pub has_cuda: bool,
    pub recommended_tier: String,
    pub tiers: Vec<ModelTierInfo>,
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecs {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_bytes = sys.total_memory();
    let avail_ram_bytes = sys.available_memory();
    let total_ram_gb = (total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0;
    let avail_ram_gb = (avail_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0;

    let cpu_cores = sys.cpus().len();
    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    // GPU detection on Windows
    let (gpu_name, gpu_vram_gb, has_cuda) = detect_gpu();

    let vram = gpu_vram_gb.unwrap_or(0.0);

    let can_run_8b = (has_cuda && vram >= 6.0) || total_ram_gb >= 16.0;
    let can_run_7b = (has_cuda && vram >= 6.0) || total_ram_gb >= 16.0;
    let can_run_3b = total_ram_gb >= 7.5 || vram >= 3.0;
    let can_run_1_5b = total_ram_gb >= 3.5;

    let is_recommended_7b = (has_cuda && vram >= 6.0) || total_ram_gb >= 24.0;
    let is_recommended_3b = !is_recommended_7b && (total_ram_gb >= 8.0 || vram >= 3.0);
    let is_recommended_1_5b = !is_recommended_7b && !is_recommended_3b && can_run_1_5b;

    let recommended_tier = if is_recommended_7b {
        "reasoning_8b".to_string()
    } else if is_recommended_3b {
        "balanced_3b".to_string()
    } else if is_recommended_1_5b {
        "reasoning_1.5b".to_string()
    } else {
        "cloud_only".to_string()
    };

    let tiers = vec![
        ModelTierInfo {
            id: "reasoning_8b".to_string(),
            name: "DeepSeek-R1-Distill-Qwen-8B (Deep Reasoning)".to_string(),
            parameter_size: "8 Billion parameters".to_string(),
            download_size: "~4.9 GB".to_string(),
            min_ram_gb: 16.0,
            min_vram_gb: 6.0,
            is_supported: can_run_8b,
            is_recommended: is_recommended_7b,
            reason: if is_recommended_7b {
                if has_cuda {
                    "Hardware Match! Offloaded to NVIDIA GPU with CUDA for deep chain-of-thought reasoning.".to_string()
                } else {
                    "Hardware Match! System has sufficient 16GB+ RAM for deep reasoning.".to_string()
                }
            } else if !can_run_8b {
                "Requires at least 16GB system RAM or a 6GB+ VRAM GPU.".to_string()
            } else {
                "Supported. Delivers deep chain-of-thought analysis for complex queries and taxonomy.".to_string()
            },
        },
        ModelTierInfo {
            id: "reasoning_1.5b".to_string(),
            name: "DeepSeek-R1-Distill-Qwen-1.5B (Light Reasoning)".to_string(),
            parameter_size: "1.5 Billion parameters".to_string(),
            download_size: "~1.1 GB".to_string(),
            min_ram_gb: 4.0,
            min_vram_gb: 0.0,
            is_supported: can_run_1_5b,
            is_recommended: is_recommended_1_5b,
            reason: if is_recommended_1_5b {
                "Recommended for lighter hardware: fast chain-of-thought reasoning with small memory footprint.".to_string()
            } else {
                "Lightweight reasoning model (~1.1GB) with chain-of-thought reasoning.".to_string()
            },
        },
        ModelTierInfo {
            id: "pro_7b".to_string(),
            name: "Qwen 2.5 7B-Instruct (General Knowledge)".to_string(),
            parameter_size: "7 Billion parameters".to_string(),
            download_size: "~4.6 GB".to_string(),
            min_ram_gb: 16.0,
            min_vram_gb: 6.0,
            is_supported: can_run_7b,
            is_recommended: false,
            reason: if can_run_7b {
                "High quality general instruction and coding model.".to_string()
            } else {
                "Requires at least 16GB system RAM or a 6GB+ VRAM GPU.".to_string()
            },
        },
        ModelTierInfo {
            id: "balanced_3b".to_string(),
            name: "Qwen 2.5 3B-Instruct (Balanced)".to_string(),
            parameter_size: "3 Billion parameters".to_string(),
            download_size: "~1.9 GB".to_string(),
            min_ram_gb: 8.0,
            min_vram_gb: 3.0,
            is_supported: can_run_3b,
            is_recommended: is_recommended_3b,
            reason: if is_recommended_3b {
                "Best fit for standard laptops and balanced systems.".to_string()
            } else if !can_run_3b {
                "Requires at least 8GB system RAM.".to_string()
            } else {
                "Supported and lightweight.".to_string()
            },
        },
        ModelTierInfo {
            id: "light_1.5b".to_string(),
            name: "Qwen 2.5 1.5B-Instruct (Ultra-Light)".to_string(),
            parameter_size: "1.5 Billion parameters".to_string(),
            download_size: "~980 MB".to_string(),
            min_ram_gb: 4.0,
            min_vram_gb: 0.0,
            is_supported: can_run_1_5b,
            is_recommended: false,
            reason: "Minimal resource footprint (~980MB) for ultra-portable systems.".to_string(),
        },
        ModelTierInfo {
            id: "cloud_only".to_string(),
            name: "Cloud API Hub (OpenAI, Claude, Gemini, Groq, OpenRouter)".to_string(),
            parameter_size: "Frontier Cloud Models".to_string(),
            download_size: "0 MB".to_string(),
            min_ram_gb: 0.0,
            min_vram_gb: 0.0,
            is_supported: true,
            is_recommended: !can_run_1_5b,
            reason: "Bring your own API key. Access GPT-4o, Claude 3.7, Gemini 2.5, or DeepSeek R1 via cloud.".to_string(),
        },
    ];

    SystemSpecs {
        total_ram_gb,
        available_ram_gb: avail_ram_gb,
        cpu_name,
        cpu_cores,
        gpu_name,
        gpu_vram_gb,
        has_cuda,
        recommended_tier,
        tiers,
    }
}

#[cfg(target_os = "windows")]
fn detect_gpu() -> (Option<String>, Option<f64>, bool) {
    use std::process::Command;

    // Check nvidia-smi first for accurate NVIDIA GPU & VRAM
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = stdout.lines().next() {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim().to_string();
                    let vram_mb: f64 = parts[1].trim().parse().unwrap_or(0.0);
                    let vram_gb = (vram_mb / 1024.0 * 10.0).round() / 10.0;
                    return (Some(name), Some(vram_gb), true);
                }
            }
        }
    }

    // Fallback: PowerShell Get-CimInstance Win32_VideoController
    if let Ok(output) = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM | ConvertTo-Json",
        ])
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                let name = json["Name"].as_str().map(|s| s.to_string());
                let ram_bytes = json["AdapterRAM"].as_f64().unwrap_or(0.0);
                let vram_gb = if ram_bytes > 0.0 {
                    Some((ram_bytes / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0)
                } else {
                    None
                };
                let is_nvidia = name
                    .as_ref()
                    .map(|n| n.to_lowercase().contains("nvidia") || n.to_lowercase().contains("geforce") || n.to_lowercase().contains("rtx"))
                    .unwrap_or(false);
                return (name, vram_gb, is_nvidia);
            }
        }
    }

    (None, None, false)
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu() -> (Option<String>, Option<f64>, bool) {
    (None, None, false)
}
