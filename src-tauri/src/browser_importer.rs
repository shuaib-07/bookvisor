use crate::db::DbState;
use crate::html_parser::ImportResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedBrowser {
    pub id: String,
    pub name: String,
    pub is_available: bool,
    pub bookmark_count_estimate: Option<usize>,
    pub icon_name: String,
}

#[derive(Deserialize)]
pub struct ChromiumBookmarkItem {
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub url: Option<String>,
    pub children: Option<Vec<ChromiumBookmarkItem>>,
}

#[derive(Deserialize)]
pub struct ChromiumBookmarksRoot {
    pub roots: Option<ChromiumRoots>,
}

#[derive(Deserialize)]
pub struct ChromiumRoots {
    pub bookmark_bar: Option<ChromiumBookmarkItem>,
    pub other: Option<ChromiumBookmarkItem>,
    pub synced: Option<ChromiumBookmarkItem>,
}

pub fn get_chromium_path(browser: &str) -> Option<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let path = match browser {
        "chrome" => PathBuf::from(&local_app_data)
            .join("Google")
            .join("Chrome")
            .join("User Data")
            .join("Default")
            .join("Bookmarks"),
        "edge" => PathBuf::from(&local_app_data)
            .join("Microsoft")
            .join("Edge")
            .join("User Data")
            .join("Default")
            .join("Bookmarks"),
        "brave" => PathBuf::from(&local_app_data)
            .join("BraveSoftware")
            .join("Brave-Browser")
            .join("User Data")
            .join("Default")
            .join("Bookmarks"),
        _ => return None,
    };

    if path.exists() {
        Some(path)
    } else {
        None
    }
}

#[tauri::command]
pub fn detect_installed_browsers(ws_state: tauri::State<crate::ws_server::WsServerState>) -> Vec<DetectedBrowser> {
    let mut list = Vec::new();

    // 1. Zen Browser (via WebSocket Live Bridge or installed binary)
    let zen_connected = ws_state.connected_clients.load(std::sync::atomic::Ordering::SeqCst) > 0;
    let zen_installed = crate::extension_manager::find_browser_exe("zen").is_some();
    list.push(DetectedBrowser {
        id: "zen".to_string(),
        name: "Zen Browser".to_string(),
        is_available: zen_connected || zen_installed,
        bookmark_count_estimate: if zen_connected { Some(1) } else { None },
        icon_name: "zen".to_string(),
    });

    // 2. Google Chrome
    let chrome_path = get_chromium_path("chrome");
    let chrome_installed = crate::extension_manager::find_browser_exe("chrome").is_some();
    list.push(DetectedBrowser {
        id: "chrome".to_string(),
        name: "Google Chrome".to_string(),
        is_available: chrome_path.is_some() || chrome_installed,
        bookmark_count_estimate: None,
        icon_name: "chrome".to_string(),
    });

    // 3. Microsoft Edge
    let edge_path = get_chromium_path("edge");
    let edge_installed = crate::extension_manager::find_browser_exe("edge").is_some();
    list.push(DetectedBrowser {
        id: "edge".to_string(),
        name: "Microsoft Edge".to_string(),
        is_available: edge_path.is_some() || edge_installed,
        bookmark_count_estimate: None,
        icon_name: "edge".to_string(),
    });

    // 4. Brave Browser
    let brave_path = get_chromium_path("brave");
    let brave_installed = crate::extension_manager::find_browser_exe("brave").is_some();
    list.push(DetectedBrowser {
        id: "brave".to_string(),
        name: "Brave Browser".to_string(),
        is_available: brave_path.is_some() || brave_installed,
        bookmark_count_estimate: None,
        icon_name: "brave".to_string(),
    });

    // 5. Mozilla Firefox
    let firefox_installed = crate::extension_manager::find_browser_exe("firefox").is_some();
    list.push(DetectedBrowser {
        id: "firefox".to_string(),
        name: "Mozilla Firefox".to_string(),
        is_available: firefox_installed,
        bookmark_count_estimate: None,
        icon_name: "firefox".to_string(),
    });

    list
}

#[tauri::command]
pub fn import_from_browser_profile(
    state: tauri::State<DbState>,
    ws_state: tauri::State<crate::ws_server::WsServerState>,
    browser_id: String,
) -> Result<ImportResult, String> {
    if browser_id == "zen" {
        // Trigger via WebSocket bridge
        let _ = crate::ws_server::zen_request_browser_sync(ws_state)?;
        return Ok(ImportResult {
            total_bookmarks_imported: 0,
            total_folders_created: 0,
            total_bookmarks_skipped: 0,
        });
    }

    let path = get_chromium_path(&browser_id)
        .ok_or_else(|| format!("Could not locate bookmarks file for {}", browser_id))?;

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read browser bookmarks file: {}", e))?;

    let parsed: ChromiumBookmarksRoot = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse browser bookmarks JSON: {}", e))?;

    let mut stats = ImportResult {
        total_bookmarks_imported: 0,
        total_folders_created: 0,
        total_bookmarks_skipped: 0,
    };

    let mut conn = state.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(roots) = parsed.roots {
        if let Some(bar) = roots.bookmark_bar {
            if let Some(children) = bar.children {
                import_chromium_items(&tx, &children, None, &mut stats, &now)?;
            }
        }
        if let Some(other) = roots.other {
            if let Some(children) = other.children {
                import_chromium_items(&tx, &children, None, &mut stats, &now)?;
            }
        }
        if let Some(synced) = roots.synced {
            if let Some(children) = synced.children {
                import_chromium_items(&tx, &children, None, &mut stats, &now)?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(stats)
}

fn import_chromium_items(
    conn: &rusqlite::Connection,
    items: &[ChromiumBookmarkItem],
    parent_folder_id: Option<String>,
    stats: &mut ImportResult,
    now: &str,
) -> Result<(), String> {
    for item in items {
        let item_type = item.item_type.as_deref().unwrap_or("");
        let name = item.name.as_deref().unwrap_or("Untitled").trim();

        if item_type == "folder" {
            if name.is_empty() {
                continue;
            }

            // Reuse existing folder if same title already exists under this parent
            let existing_folder_id: Option<String> = match &parent_folder_id {
                Some(pid) => conn
                    .query_row(
                        "SELECT id FROM folders WHERE title = ?1 AND parent_id = ?2 AND is_deleted = 0",
                        rusqlite::params![name, pid],
                        |r| r.get(0),
                    )
                    .ok(),
                None => conn
                    .query_row(
                        "SELECT id FROM folders WHERE title = ?1 AND parent_id IS NULL AND is_deleted = 0",
                        rusqlite::params![name],
                        |r| r.get(0),
                    )
                    .ok(),
            };

            let folder_id = if let Some(fid) = existing_folder_id {
                fid
            } else {
                let fid = Uuid::new_v4().to_string();
                conn.execute(
                    r#"
                    INSERT INTO folders (id, parent_id, title, position, is_locked, created_at, updated_at, is_deleted)
                    VALUES (?1, ?2, ?3, 0, 0, ?4, ?4, 0)
                    "#,
                    rusqlite::params![fid, parent_folder_id, name, now],
                )
                .map_err(|e| e.to_string())?;

                stats.total_folders_created += 1;
                fid
            };

            if let Some(ref children) = item.children {
                import_chromium_items(conn, children, Some(folder_id), stats, now)?;
            }
        } else if item_type == "url" {
            if let Some(ref raw_url) = item.url {
                let raw_trimmed = raw_url.trim();
                if raw_trimmed.is_empty() || (!raw_trimmed.starts_with("http://") && !raw_trimmed.starts_with("https://")) {
                    continue;
                }

                let clean = crate::url_cleaner::clean_url(raw_trimmed);
                if clean.is_empty() {
                    continue;
                }

                // Check if active bookmark already exists in database
                let already_active: bool = conn
                    .query_row(
                        "SELECT 1 FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 0 LIMIT 1",
                        rusqlite::params![clean, raw_trimmed],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);

                if already_active {
                    stats.total_bookmarks_skipped += 1;
                    continue;
                }

                // Check if soft-deleted bookmark exists — un-delete and assign to folder
                let existing_deleted_id: Option<String> = conn
                    .query_row(
                        "SELECT id FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 1 LIMIT 1",
                        rusqlite::params![clean, raw_trimmed],
                        |r| r.get(0),
                    )
                    .ok();

                if let Some(del_id) = existing_deleted_id {
                    conn.execute(
                        "UPDATE bookmarks SET is_deleted = 0, folder_id = ?1, title = ?2, updated_at = ?3 WHERE id = ?4",
                        rusqlite::params![parent_folder_id, name, now, del_id],
                    )
                    .map_err(|e| e.to_string())?;
                    stats.total_bookmarks_imported += 1;
                } else {
                    let domain = crate::url_cleaner::extract_domain(&clean);
                    let b_id = Uuid::new_v4().to_string();

                    conn.execute(
                        r#"
                        INSERT INTO bookmarks (
                            id, folder_id, url, clean_url, domain, title,
                            link_status, is_pinned, tags, created_at, updated_at, is_deleted
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'UNCHECKED', 0, '[]', ?7, ?7, 0)
                        "#,
                        rusqlite::params![b_id, parent_folder_id, raw_trimmed, clean, domain, name, now],
                    )
                    .map_err(|e| e.to_string())?;

                    stats.total_bookmarks_imported += 1;
                }
            }
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultBrowserInfo {
    pub id: String,
    pub name: String,
    pub is_available: bool,
}

#[tauri::command]
pub fn get_default_browser(ws_state: tauri::State<crate::ws_server::WsServerState>) -> DefaultBrowserInfo {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if let Ok(output) = std::process::Command::new("reg")
            .args(&[
                "query",
                r"HKEY_CURRENT_USER\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
                "/v",
                "ProgId",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("ProgId") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(prog_id) = parts.last() {
                        let cmd_key = format!(r"HKEY_CLASSES_ROOT\{}\shell\open\command", prog_id);
                        if let Ok(cmd_output) = std::process::Command::new("reg")
                            .args(&["query", &cmd_key])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output()
                        {
                            let cmd_str = String::from_utf8_lossy(&cmd_output.stdout).to_lowercase();
                            if cmd_str.contains("zen.exe") || cmd_str.contains("zen") {
                                let zen_connected = ws_state.connected_clients.load(std::sync::atomic::Ordering::SeqCst) > 0;
                                return DefaultBrowserInfo {
                                    id: "zen".to_string(),
                                    name: "Zen Browser".to_string(),
                                    is_available: zen_connected,
                                };
                            } else if cmd_str.contains("chrome.exe") {
                                return DefaultBrowserInfo {
                                    id: "chrome".to_string(),
                                    name: "Google Chrome".to_string(),
                                    is_available: get_chromium_path("chrome").is_some(),
                                };
                            } else if cmd_str.contains("msedge.exe") {
                                return DefaultBrowserInfo {
                                    id: "edge".to_string(),
                                    name: "Microsoft Edge".to_string(),
                                    is_available: get_chromium_path("edge").is_some(),
                                };
                            } else if cmd_str.contains("brave.exe") {
                                return DefaultBrowserInfo {
                                    id: "brave".to_string(),
                                    name: "Brave Browser".to_string(),
                                    is_available: get_chromium_path("brave").is_some(),
                                };
                            } else if cmd_str.contains("firefox.exe") {
                                return DefaultBrowserInfo {
                                    id: "firefox".to_string(),
                                    name: "Mozilla Firefox".to_string(),
                                    is_available: false,
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: If Zen WebSocket is connected, prefer Zen
    if ws_state.connected_clients.load(std::sync::atomic::Ordering::SeqCst) > 0 {
        return DefaultBrowserInfo {
            id: "zen".to_string(),
            name: "Zen Browser".to_string(),
            is_available: true,
        };
    }

    // Fallback: Check installed Chromium browsers
    if get_chromium_path("chrome").is_some() {
        return DefaultBrowserInfo {
            id: "chrome".to_string(),
            name: "Google Chrome".to_string(),
            is_available: true,
        };
    }
    if get_chromium_path("edge").is_some() {
        return DefaultBrowserInfo {
            id: "edge".to_string(),
            name: "Microsoft Edge".to_string(),
            is_available: true,
        };
    }
    if get_chromium_path("brave").is_some() {
        return DefaultBrowserInfo {
            id: "brave".to_string(),
            name: "Brave Browser".to_string(),
            is_available: true,
        };
    }

    DefaultBrowserInfo {
        id: "chrome".to_string(),
        name: "Google Chrome".to_string(),
        is_available: false,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDefaultBrowserResult {
    pub browser_id: String,
    pub browser_name: String,
    pub is_live_websocket: bool,
    pub imported_count: usize,
    pub skipped_count: usize,
    pub folders_count: usize,
}

#[tauri::command]
pub fn sync_default_browser(
    state: tauri::State<DbState>,
    ws_state: tauri::State<crate::ws_server::WsServerState>,
) -> Result<SyncDefaultBrowserResult, String> {
    let default_browser = get_default_browser(ws_state.clone());

    if default_browser.id == "zen" {
        let zen_connected = ws_state.connected_clients.load(std::sync::atomic::Ordering::SeqCst) > 0;
        if !zen_connected {
            // Check if user has Chrome or Edge as fallback if Zen extension is not currently connected
            if get_chromium_path("chrome").is_some() {
                let res = import_from_browser_profile(state, ws_state, "chrome".to_string())?;
                return Ok(SyncDefaultBrowserResult {
                    browser_id: "chrome".to_string(),
                    browser_name: "Google Chrome (Fallback)".to_string(),
                    is_live_websocket: false,
                    imported_count: res.total_bookmarks_imported,
                    skipped_count: res.total_bookmarks_skipped,
                    folders_count: res.total_folders_created,
                });
            } else if get_chromium_path("edge").is_some() {
                let res = import_from_browser_profile(state, ws_state, "edge".to_string())?;
                return Ok(SyncDefaultBrowserResult {
                    browser_id: "edge".to_string(),
                    browser_name: "Microsoft Edge (Fallback)".to_string(),
                    is_live_websocket: false,
                    imported_count: res.total_bookmarks_imported,
                    skipped_count: res.total_bookmarks_skipped,
                    folders_count: res.total_folders_created,
                });
            } else {
                return Err("Zen Browser is your system default browser, but the BookVisor extension bridge is not currently connected. Please open Zen Browser or install the BookVisor extension to sync.".to_string());
            }
        }

        let _ = crate::ws_server::zen_request_browser_sync(ws_state)?;
        return Ok(SyncDefaultBrowserResult {
            browser_id: "zen".to_string(),
            browser_name: "Zen Browser".to_string(),
            is_live_websocket: true,
            imported_count: 0,
            skipped_count: 0,
            folders_count: 0,
        });
    }

    // For Chrome, Edge, Brave
    let res = import_from_browser_profile(state, ws_state, default_browser.id.clone())?;
    Ok(SyncDefaultBrowserResult {
        browser_id: default_browser.id,
        browser_name: default_browser.name,
        is_live_websocket: false,
        imported_count: res.total_bookmarks_imported,
        skipped_count: res.total_bookmarks_skipped,
        folders_count: res.total_folders_created,
    })
}

// ── Multi-Profile & Multi-Account Discovery Suite ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredProfile {
    pub id: String,
    pub browser_type: String,
    pub profile_folder_name: String,
    pub display_name: String,
    pub user_email: Option<String>,
    pub avatar_url: Option<String>,
    pub bookmarks_file_path: Option<String>,
    pub bookmark_count_estimate: usize,
    pub is_connected: bool,
    pub suggested_color: String,
}

const COLOR_PALETTE: &[&str] = &[
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#6366f1", // Indigo
    "#f43f5e", // Rose
];

#[tauri::command]
pub fn discover_all_browser_profiles(
    state: tauri::State<DbState>,
    _ws_state: tauri::State<crate::ws_server::WsServerState>,
) -> Result<Vec<DiscoveredProfile>, String> {
    let mut discovered = Vec::new();
    let mut color_idx = 0;

    let connected_account_keys: Vec<(String, String)> = {
        let conn = state.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT browser_type, profile_folder_name FROM browser_accounts")
            .unwrap();
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .unwrap();
        rows.flatten().collect()
    };

    let is_connected = |b_type: &str, p_folder: &str| -> bool {
        connected_account_keys.iter().any(|(b, p)| b == b_type && p == p_folder)
    };

    let next_color = |idx: &mut usize| -> String {
        let color = COLOR_PALETTE[*idx % COLOR_PALETTE.len()].to_string();
        *idx += 1;
        color
    };

    // 1. Zen Browser (Live Bridge & Local Profiles)
    let zen_count = {
        let conn = state.conn.lock().unwrap();
        let mapped: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM bookmark_account_mappings m JOIN browser_accounts a ON a.id = m.account_id WHERE a.browser_type = 'zen'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if mapped > 0 {
            mapped
        } else {
            conn.query_row("SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 0", [], |r| r.get(0)).unwrap_or(0)
        }
    };

    discovered.push(DiscoveredProfile {
        id: "zen-live".to_string(),
        browser_type: "zen".to_string(),
        profile_folder_name: "default-release".to_string(),
        display_name: "Zen Browser (Active Profile)".to_string(),
        user_email: None,
        avatar_url: None,
        bookmarks_file_path: None,
        bookmark_count_estimate: zen_count,
        is_connected: is_connected("zen", "default-release"),
        suggested_color: next_color(&mut color_idx),
    });

    // 2. Discover Chromium Profiles (Chrome, Edge, Brave)
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    if !local_app_data.is_empty() {
        let chromium_specs = [
            ("chrome", "Google Chrome", PathBuf::from(&local_app_data).join("Google").join("Chrome").join("User Data")),
            ("edge", "Microsoft Edge", PathBuf::from(&local_app_data).join("Microsoft").join("Edge").join("User Data")),
            ("brave", "Brave Browser", PathBuf::from(&local_app_data).join("BraveSoftware").join("Brave-Browser").join("User Data")),
        ];

        for (b_type, b_name, user_data_path) in &chromium_specs {
            if !user_data_path.exists() {
                continue;
            }

            let local_state_path = user_data_path.join("Local State");
            let mut found_profiles: std::collections::HashMap<String, (String, Option<String>)> = std::collections::HashMap::new();

            if local_state_path.exists() {
                if let Ok(content) = fs::read_to_string(&local_state_path) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(info_cache) = json.get("profile").and_then(|p| p.get("info_cache")).and_then(|ic| ic.as_object()) {
                            for (folder_key, profile_info) in info_cache {
                                let display = profile_info.get("name").and_then(|n| n.as_str()).unwrap_or(folder_key).to_string();
                                let email = profile_info.get("user_name").and_then(|e| e.as_str()).map(|s| s.to_string());
                                found_profiles.insert(folder_key.clone(), (display, email));
                            }
                        }
                    }
                }
            }

            // Always check Default
            if !found_profiles.contains_key("Default") {
                if resolve_chromium_bookmarks_path(&user_data_path.join("Default")).is_some() {
                    found_profiles.insert("Default".to_string(), ("Personal / Default".to_string(), None));
                }
            }

            // Scan subfolders for Profile 1, Profile 2, etc. in case Local State omitted them
            if let Ok(entries) = fs::read_dir(user_data_path) {
                for entry in entries.flatten() {
                    let folder_name = entry.file_name().to_string_lossy().to_string();
                    if (folder_name.starts_with("Profile ") || folder_name == "Default") && !found_profiles.contains_key(&folder_name) {
                        if resolve_chromium_bookmarks_path(&entry.path()).is_some() {
                            found_profiles.insert(folder_name.clone(), (format!("{} ({})", b_name, folder_name), None));
                        }
                    }
                }
            }

            for (folder_key, (display, email)) in found_profiles {
                let profile_dir = user_data_path.join(&folder_key);
                let bm_path = match resolve_chromium_bookmarks_path(&profile_dir) {
                    Some(p) => p,
                    None => continue,
                };

                let count = estimate_chromium_bookmark_count(&bm_path);
                let is_conn = is_connected(b_type, &folder_key);
                let real_count = if is_conn {
                    let conn = state.conn.lock().unwrap();
                    let mapped: usize = conn
                        .query_row(
                            "SELECT COUNT(*) FROM bookmark_account_mappings m JOIN browser_accounts a ON a.id = m.account_id WHERE a.browser_type = ?1 AND a.profile_folder_name = ?2",
                            rusqlite::params![b_type, folder_key],
                            |r| r.get(0),
                        )
                        .unwrap_or(0);
                    if mapped > 0 {
                        mapped
                    } else {
                        count
                    }
                } else {
                    count
                };

                let full_display = if display.to_lowercase().contains(b_type) {
                    display
                } else {
                    format!("{} ({})", b_name, display)
                };

                discovered.push(DiscoveredProfile {
                    id: format!("{}-{}", b_type, folder_key),
                    browser_type: b_type.to_string(),
                    profile_folder_name: folder_key.clone(),
                    display_name: full_display,
                    user_email: email,
                    avatar_url: None,
                    bookmarks_file_path: Some(bm_path.to_string_lossy().to_string()),
                    bookmark_count_estimate: real_count,
                    is_connected: is_conn,
                    suggested_color: next_color(&mut color_idx),
                });
            }
        }
    }

    Ok(discovered)
}

pub fn resolve_chromium_bookmarks_path(profile_dir: &std::path::Path) -> Option<PathBuf> {
    let account_bm = profile_dir.join("AccountBookmarks");
    let standard_bm = profile_dir.join("Bookmarks");

    // Prefer AccountBookmarks if it has substantial content (used for synced Google Accounts)
    if account_bm.exists() {
        if let Ok(meta) = fs::metadata(&account_bm) {
            if meta.len() > 1200 {
                return Some(account_bm);
            }
        }
    }
    if standard_bm.exists() {
        if let Ok(meta) = fs::metadata(&standard_bm) {
            if meta.len() > 1200 {
                return Some(standard_bm);
            }
        }
    }
    if account_bm.exists() {
        return Some(account_bm);
    }
    if standard_bm.exists() {
        return Some(standard_bm);
    }
    None
}

pub fn estimate_chromium_bookmark_count(path: &PathBuf) -> usize {
    if let Ok(content) = fs::read_to_string(path) {
        let mut count = content.matches("\"type\": \"url\"").count();
        if count == 0 {
            count = content.matches("\"type\":\"url\"").count();
        }
        if count == 0 {
            count = content.matches("\"url\": \"http").count();
        }
        if count == 0 {
            count = content.matches("\"url\":\"http").count();
        }
        if count == 0 {
            let raw_count = content.matches("\"url\"").count();
            if raw_count > 0 {
                count = raw_count / 2;
            }
        }
        count
    } else {
        0
    }
}

#[tauri::command]
pub fn connect_and_import_profile(
    state: tauri::State<DbState>,
    ws_state: tauri::State<crate::ws_server::WsServerState>,
    profile: DiscoveredProfile,
    custom_name: Option<String>,
    color_dot: Option<String>,
    sync_mode: Option<String>,
) -> Result<crate::db::BrowserAccount, String> {
    let acc_id = Uuid::new_v4().to_string();
    let display_name = custom_name.unwrap_or(profile.display_name);
    let color = color_dot.unwrap_or(profile.suggested_color);
    let s_mode = sync_mode.unwrap_or_else(|| "live".to_string());

    let account = crate::db::db_upsert_account(
        state.clone(),
        Some(acc_id.clone()),
        profile.browser_type.clone(),
        profile.profile_folder_name.clone(),
        display_name,
        profile.user_email,
        color,
        profile.browser_type.clone(),
        profile.bookmarks_file_path.clone(),
        Some(s_mode),
    )?;

    // Import bookmarks and link them to this new account
    if profile.browser_type == "zen" {
        let _ = crate::ws_server::zen_request_browser_sync(ws_state).ok();
        let conn = state.conn.lock().unwrap();
        let _ = conn.execute(
            r#"
            INSERT OR IGNORE INTO bookmark_account_mappings (account_id, bookmark_id)
            SELECT ?1, id FROM bookmarks WHERE is_deleted = 0
            "#,
            [&acc_id],
        );
    } else if let Some(ref bm_path_str) = profile.bookmarks_file_path {
        let path = PathBuf::from(bm_path_str);
        let mut paths_to_import = vec![path.clone()];

        if let Some(parent) = path.parent() {
            let companion = if path.file_name().and_then(|n| n.to_str()) == Some("Bookmarks") {
                parent.join("AccountBookmarks")
            } else {
                parent.join("Bookmarks")
            };
            if companion.exists() && companion != path {
                if let Ok(meta) = fs::metadata(&companion) {
                    if meta.len() > 1200 {
                        paths_to_import.push(companion);
                    }
                }
            }
        }

        for p in paths_to_import {
            if p.exists() {
                if let Ok(content) = fs::read_to_string(&p) {
                    if let Ok(parsed) = serde_json::from_str::<ChromiumBookmarksRoot>(&content) {
                        let mut stats = ImportResult {
                            total_bookmarks_imported: 0,
                            total_folders_created: 0,
                            total_bookmarks_skipped: 0,
                        };
                        let now = chrono::Utc::now().to_rfc3339();
                        let mut conn = state.conn.lock().unwrap();
                        if let Ok(tx) = conn.transaction() {
                            if let Some(roots) = parsed.roots {
                                if let Some(bar) = roots.bookmark_bar {
                                    if let Some(children) = bar.children {
                                        import_and_link_chromium_items(&tx, &children, None, &acc_id, &mut stats, &now).ok();
                                    }
                                }
                                if let Some(other) = roots.other {
                                    if let Some(children) = other.children {
                                        import_and_link_chromium_items(&tx, &children, None, &acc_id, &mut stats, &now).ok();
                                    }
                                }
                                if let Some(synced) = roots.synced {
                                    if let Some(children) = synced.children {
                                        import_and_link_chromium_items(&tx, &children, None, &acc_id, &mut stats, &now).ok();
                                    }
                                }
                            }
                            tx.commit().ok();
                        };
                    }
                }
            }
        }
    }

    Ok(account)
}

pub fn import_and_link_chromium_items(
    conn: &rusqlite::Connection,
    items: &[ChromiumBookmarkItem],
    parent_folder_id: Option<String>,
    account_id: &str,
    stats: &mut ImportResult,
    now: &str,
) -> Result<(), String> {
    for item in items {
        let item_type = item.item_type.as_deref().unwrap_or("");
        let name = item.name.as_deref().unwrap_or("Untitled").trim();

        if item_type == "folder" {
            if name.is_empty() {
                continue;
            }

            let existing_folder_id: Option<String> = match &parent_folder_id {
                Some(pid) => conn
                    .query_row(
                        "SELECT id FROM folders WHERE title = ?1 AND parent_id = ?2 AND is_deleted = 0",
                        rusqlite::params![name, pid],
                        |r| r.get(0),
                    )
                    .ok(),
                None => conn
                    .query_row(
                        "SELECT id FROM folders WHERE title = ?1 AND parent_id IS NULL AND is_deleted = 0",
                        rusqlite::params![name],
                        |r| r.get(0),
                    )
                    .ok(),
            };

            let folder_id = if let Some(fid) = existing_folder_id {
                fid
            } else {
                let fid = Uuid::new_v4().to_string();
                conn.execute(
                    r#"
                    INSERT INTO folders (id, parent_id, title, position, is_locked, created_at, updated_at, is_deleted)
                    VALUES (?1, ?2, ?3, 0, 0, ?4, ?4, 0)
                    "#,
                    rusqlite::params![fid, parent_folder_id, name, now],
                )
                .map_err(|e| e.to_string())?;

                stats.total_folders_created += 1;
                fid
            };

            if let Some(ref children) = item.children {
                import_and_link_chromium_items(conn, children, Some(folder_id), account_id, stats, now)?;
            }
        } else if item_type == "url" {
            if let Some(ref raw_url) = item.url {
                let raw_trimmed = raw_url.trim();
                if raw_trimmed.is_empty() || (!raw_trimmed.starts_with("http://") && !raw_trimmed.starts_with("https://")) {
                    continue;
                }

                let clean = crate::url_cleaner::clean_url(raw_trimmed);
                if clean.is_empty() {
                    continue;
                }

                let existing_bookmark_id: Option<String> = conn
                    .query_row(
                        "SELECT id FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 0 LIMIT 1",
                        rusqlite::params![clean, raw_trimmed],
                        |r| r.get(0),
                    )
                    .ok();

                let b_id = if let Some(eid) = existing_bookmark_id {
                    stats.total_bookmarks_skipped += 1;
                    eid
                } else {
                    let new_id = Uuid::new_v4().to_string();
                    let domain = crate::url_cleaner::extract_domain(&clean);

                    conn.execute(
                        r#"
                        INSERT INTO bookmarks (
                            id, folder_id, url, clean_url, domain, title,
                            link_status, is_pinned, tags, created_at, updated_at, is_deleted
                        )
                        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'UNCHECKED', 0, '[]', ?7, ?7, 0)
                        "#,
                        rusqlite::params![new_id, parent_folder_id, raw_trimmed, clean, domain, name, now],
                    )
                    .map_err(|e| e.to_string())?;

                    stats.total_bookmarks_imported += 1;
                    new_id
                };

                // Link to this account
                let m_id = Uuid::new_v4().to_string();
                conn.execute(
                    r#"
                    INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at)
                    VALUES (?1, ?2, ?3, ?4, 0, ?4)
                    ON CONFLICT(bookmark_id, account_id) DO NOTHING
                    "#,
                    rusqlite::params![m_id, b_id, account_id, now],
                ).ok();
            }
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSyncResult {
    pub account_id: String,
    pub backup_path: Option<String>,
    pub synced_count: usize,
    pub message: String,
}

#[tauri::command]
pub fn sync_account_to_browser(
    state: tauri::State<DbState>,
    ws_state: tauri::State<crate::ws_server::WsServerState>,
    account_id: String,
) -> Result<AccountSyncResult, String> {
    let conn = state.conn.lock().unwrap();
    let account = conn
        .query_row(
            "SELECT id, browser_type, bookmarks_file_path, display_name FROM browser_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, String>(3)?,
                ))
            },
        )
        .map_err(|_| "Account not found.".to_string())?;

    if account.1 == "zen" {
        crate::ws_server::zen_request_browser_sync(ws_state)?;
        return Ok(AccountSyncResult {
            account_id,
            backup_path: None,
            synced_count: 0,
            message: format!("Triggered live sync with {}", account.3),
        });
    }

    if let Some(ref file_path_str) = account.2 {
        let p = PathBuf::from(file_path_str);
        if p.exists() {
            // 1. Create safety backup
            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let backup_path = p.with_extension(format!("bookmanage_bak_{}", timestamp));
            fs::copy(&p, &backup_path).map_err(|e| format!("Failed to create safety backup: {}", e))?;

            // 2. Fetch bookmarks mapped to this account
            let mut stmt = conn.prepare(
                r#"
                SELECT b.url, b.title, b.created_at
                FROM bookmarks b
                JOIN bookmark_account_mappings m ON m.bookmark_id = b.id
                WHERE m.account_id = ?1 AND b.is_deleted = 0
                "#,
            ).map_err(|e| e.to_string())?;

            let rows = stmt.query_map(rusqlite::params![account_id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            }).map_err(|e| e.to_string())?;

            let mut bookmark_nodes = Vec::new();
            let mut count = 0;
            for r in rows.flatten() {
                count += 1;
                bookmark_nodes.push(serde_json::json!({
                    "date_added": "13300000000000000",
                    "id": format!("{}", count + 100),
                    "name": r.1,
                    "type": "url",
                    "url": r.0,
                }));
            }

            // Write back Chromium JSON with standard structure
            let chromium_json = serde_json::json!({
                "checksum": "",
                "roots": {
                    "bookmark_bar": {
                        "children": bookmark_nodes,
                        "date_added": "13300000000000000",
                        "date_modified": "13300000000000000",
                        "id": "1",
                        "name": "Bookmarks bar",
                        "type": "folder"
                    },
                    "other": {
                        "children": [],
                        "date_added": "13300000000000000",
                        "date_modified": "0",
                        "id": "2",
                        "name": "Other bookmarks",
                        "type": "folder"
                    },
                    "synced": {
                        "children": [],
                        "date_added": "13300000000000000",
                        "date_modified": "0",
                        "id": "3",
                        "name": "Mobile bookmarks",
                        "type": "folder"
                    }
                },
                "version": 1
            });

            fs::write(&p, serde_json::to_string_pretty(&chromium_json).unwrap())
                .map_err(|e| format!("Failed to update browser bookmarks file: {}", e))?;

            return Ok(AccountSyncResult {
                account_id,
                backup_path: Some(backup_path.to_string_lossy().to_string()),
                synced_count: count,
                message: format!("Successfully synced {} bookmarks to {}", count, account.3),
            });
        }
    }

    Err(format!("Could not locate browser bookmarks file for {}", account.3))
}


