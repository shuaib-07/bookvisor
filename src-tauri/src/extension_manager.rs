use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

// Embedded extension files guaranteed to be bundled with the binary
const CHROME_MANIFEST: &str = include_str!("../../extension/chrome/manifest.json");
const GECKO_MANIFEST: &str = include_str!("../../extension/manifest.gecko.json");
const BACKGROUND_JS: &str = include_str!("../../extension/background.js");
const POPUP_HTML: &str = include_str!("../../extension/popup.html");
const POPUP_JS: &str = include_str!("../../extension/popup.js");
const ICON_48: &[u8] = include_bytes!("../../extension/icon-48.png");
const ICON_128: &[u8] = include_bytes!("../../extension/icon-128.png");

/// Ensures unpacked extension directories exist in AppData and have the latest files.
pub fn ensure_extension_files(app: &tauri::AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let ext_root = app_data.join("extensions");
    let chrome_dir = ext_root.join("chrome");
    let firefox_dir = ext_root.join("firefox");

    fs::create_dir_all(&chrome_dir).map_err(|e| format!("Failed to create chrome ext dir: {}", e))?;
    fs::create_dir_all(&firefox_dir).map_err(|e| format!("Failed to create firefox ext dir: {}", e))?;

    // Write Chrome unpacked extension
    fs::write(chrome_dir.join("manifest.json"), CHROME_MANIFEST).ok();
    fs::write(chrome_dir.join("background.js"), BACKGROUND_JS).ok();
    fs::write(chrome_dir.join("popup.html"), POPUP_HTML).ok();
    fs::write(chrome_dir.join("popup.js"), POPUP_JS).ok();
    fs::write(chrome_dir.join("icon-48.png"), ICON_48).ok();
    fs::write(chrome_dir.join("icon-128.png"), ICON_128).ok();

    // Write Firefox/Zen unpacked extension (with Gecko manifest as manifest.json)
    fs::write(firefox_dir.join("manifest.json"), GECKO_MANIFEST).ok();
    fs::write(firefox_dir.join("background.js"), BACKGROUND_JS).ok();
    fs::write(firefox_dir.join("popup.html"), POPUP_HTML).ok();
    fs::write(firefox_dir.join("popup.js"), POPUP_JS).ok();
    fs::write(firefox_dir.join("icon-48.png"), ICON_48).ok();
    fs::write(firefox_dir.join("icon-128.png"), ICON_128).ok();

    Ok((chrome_dir, firefox_dir))
}

/// Resolves the unpacked extension directory for a target browser.
pub fn resolve_extension_dir(app: &tauri::AppHandle, browser: Option<&str>) -> Result<PathBuf, String> {
    let (chrome_dir, firefox_dir) = ensure_extension_files(app)?;
    let target = browser.unwrap_or("chrome").to_lowercase();
    if target == "zen" || target == "firefox" || target == "gecko" {
        Ok(firefox_dir)
    } else {
        Ok(chrome_dir)
    }
}

/// Finds the executable path for a given browser on Windows.
pub fn find_browser_exe(browser: &str) -> Option<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let program_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());

    let candidates: Vec<PathBuf> = match browser.to_lowercase().as_str() {
        "chrome" | "google-chrome" => vec![
            Path::new(&program_files).join("Google\\Chrome\\Application\\chrome.exe"),
            Path::new(&program_files_x86).join("Google\\Chrome\\Application\\chrome.exe"),
            Path::new(&local_app_data).join("Google\\Chrome\\Application\\chrome.exe"),
        ],
        "edge" | "msedge" => vec![
            Path::new(&program_files_x86).join("Microsoft\\Edge\\Application\\msedge.exe"),
            Path::new(&program_files).join("Microsoft\\Edge\\Application\\msedge.exe"),
        ],
        "brave" => vec![
            Path::new(&program_files).join("BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
            Path::new(&local_app_data).join("BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
        ],
        "zen" => vec![
            Path::new(&program_files).join("Zen Browser\\zen.exe"),
            Path::new(&local_app_data).join("zen\\zen.exe"),
            Path::new(&local_app_data).join("Programs\\zen\\zen.exe"),
        ],
        "firefox" => vec![
            Path::new(&program_files).join("Mozilla Firefox\\firefox.exe"),
            Path::new(&program_files_x86).join("Mozilla Firefox\\firefox.exe"),
        ],
        _ => vec![],
    };

    candidates.into_iter().find(|p| p.exists())
}

#[tauri::command]
pub fn get_extension_directory(app: tauri::AppHandle, browser: Option<String>) -> Result<String, String> {
    let dir = resolve_extension_dir(&app, browser.as_deref())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_extension_directory(app: tauri::AppHandle, browser: Option<String>) -> Result<String, String> {
    let dir = resolve_extension_dir(&app, browser.as_deref())?;
    let path_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        // Open Windows Explorer directly with the guaranteed directory
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = open::that(&dir);
    }

    Ok(path_str)
}

pub fn generate_setup_guide_html(app_data_dir: &std::path::Path, extension_path: &str, browser: &str) -> PathBuf {
    let setup_dir = app_data_dir.join("extensions");
    let _ = fs::create_dir_all(&setup_dir);
    let setup_html_path = setup_dir.join("setup.html");

    let ext_url = match browser.to_lowercase().as_str() {
        "edge" => "edge://extensions",
        "brave" => "brave://extensions",
        _ => "chrome://extensions",
    };
    let browser_name = match browser.to_lowercase().as_str() {
        "edge" => "Microsoft Edge",
        "brave" => "Brave Browser",
        _ => "Google Chrome",
    };

    let html_content = format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BookVisor Extension Setup</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #0b0a0e;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 16px;
      -webkit-font-smoothing: antialiased;
    }}
    .container {{
      width: 100%;
      max-width: 580px;
      background: rgba(20, 18, 24, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 32px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(20px);
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.12);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.25);
      margin-bottom: 14px;
    }}
    .badge svg {{
      color: #60a5fa;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #ffffff;
      margin-bottom: 6px;
    }}
    p.desc {{
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.5;
      margin-bottom: 22px;
    }}
    .steps {{
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 22px;
    }}
    .step-item {{
      display: flex;
      gap: 14px;
      padding: 13px 15px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      align-items: flex-start;
      transition: background-color 0.15s ease;
    }}
    .step-item:hover {{
      background: rgba(255, 255, 255, 0.04);
    }}
    .step-num {{
      width: 24px;
      height: 24px;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f4f4f5;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      shrink: 0;
    }}
    .step-content {{
      flex: 1;
    }}
    .step-title {{
      font-size: 13px;
      font-weight: 600;
      color: #f4f4f5;
      margin-bottom: 3px;
    }}
    .step-text {{
      font-size: 12px;
      color: #a1a1aa;
      line-height: 1.45;
    }}
    kbd, code {{
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #93c5fd;
    }}
    .actions {{
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }}
    .btn {{
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      font-size: 12px;
      font-weight: 600;
      padding: 9px 14px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      text-decoration: none;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                  background-color 0.18s ease,
                  border-color 0.18s ease,
                  box-shadow 0.2s ease,
                  color 0.18s ease;
    }}
    .btn:hover {{
      transform: translateY(-1.5px);
    }}
    .btn:active {{
      transform: translateY(0.5px) scale(0.97);
    }}
    .btn-primary {{
      background: #2563eb;
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
    }}
    .btn-primary:hover {{
      background: #1d4ed8;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }}
    .btn-secondary {{
      background: rgba(255, 255, 255, 0.04);
      color: #e4e4e7;
      border-color: rgba(255, 255, 255, 0.08);
    }}
    .btn-secondary:hover {{
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.14);
      color: #ffffff;
    }}
    .btn svg {{
      shrink: 0;
      transition: transform 0.2s ease;
    }}
    .btn:hover svg {{
      transform: scale(1.08);
    }}
    .security-hint {{
      display: none;
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 12px;
      line-height: 1.45;
      color: #d4d4d8;
    }}
    .status-card {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12px;
    }}
    .status-indicator {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .dot {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #eab308;
      box-shadow: 0 0 8px rgba(234, 179, 8, 0.7);
      animation: pulse 1.8s infinite ease-in-out;
    }}
    .connected .dot {{
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
      animation: none;
    }}
    @keyframes pulse {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.45; transform: scale(0.85); }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      BookVisor Universal Bridge
    </div>
    <h1>{browser_name} Setup</h1>
    <p class="desc">
      Chromium browsers protect internal settings from external desktop apps. Follow these 3 steps to finish loading the bridge extension:
    </p>

    <div class="steps">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">Open the Extensions Tab</div>
          <div class="step-text">
            Press <kbd>Ctrl+L</kbd> in your address bar, paste (<kbd>Ctrl+V</kbd>), and press <kbd>Enter</kbd> (we automatically copied <code>{ext_url}</code> to your clipboard).
          </div>
        </div>
      </div>

      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">Turn On Developer Mode</div>
          <div class="step-text">
            Toggle the <strong>Developer mode</strong> switch at the top-right corner of your browser.
          </div>
        </div>
      </div>

      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">Drag & Drop the Extension Folder</div>
          <div class="step-text">
            Drag the opened folder from Windows Explorer directly into your browser window, or click <strong>Load unpacked</strong> and paste the path.
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <a href="{ext_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" id="btnOpenExt" onclick="handleOpenExt(event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        <span id="openBtnText">Open {ext_url}</span>
      </a>
      <button class="btn btn-secondary" id="btnCopyUrl" onclick="copyExtUrl()">
        <svg id="copyUrlIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span id="copyUrlText">Copy URL</span>
      </button>
      <button class="btn btn-secondary" id="btnCopyPath" onclick="copyExtPath()">
        <svg id="copyPathIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
        <span id="copyPathText">Copy Folder Path</span>
      </button>
    </div>

    <div id="securityHint" class="security-hint">
      <strong>Clipboard Ready:</strong> If your browser blocked opening internal settings directly from a local file, press <kbd>Ctrl+T</kbd> (New Tab) then <kbd>Ctrl+V</kbd> and <kbd>Enter</kbd>. <code>{ext_url}</code> is already in your clipboard.
    </div>

    <div class="status-card" id="statusCard">
      <div class="status-indicator">
        <div class="dot" id="statusDot"></div>
        <span id="statusText">Waiting for extension connection...</span>
      </div>
      <span style="color: #71717a; font-family: ui-monospace, monospace; font-size: 11px;">ws://127.0.0.1:49152</span>
    </div>
  </div>

  <script>
    const extUrl = "{ext_url}";
    const folderPath = "{extension_path_escaped}";

    const checkSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const origCopySvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    const origFolderSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

    function handleOpenExt(e) {{
      navigator.clipboard.writeText(extUrl).catch(() => {{}});
      try {{
        window.open(extUrl, '_blank');
      }} catch(err) {{}}

      const hint = document.getElementById('securityHint');
      if (hint) {{
        hint.style.display = 'block';
      }}
      const text = document.getElementById('openBtnText');
      if (text) {{
        text.innerText = 'Opening Tab...';
        setTimeout(() => {{
          text.innerText = 'Open ' + extUrl;
        }}, 2000);
      }}
    }}

    function copyExtUrl() {{
      navigator.clipboard.writeText(extUrl).then(() => {{
        const icon = document.getElementById('copyUrlIcon');
        const text = document.getElementById('copyUrlText');
        if (icon) icon.outerHTML = checkSvg;
        if (text) text.innerText = 'Copied';
        setTimeout(() => {{
          const btn = document.getElementById('btnCopyUrl');
          btn.innerHTML = origCopySvg + '<span id="copyUrlText">Copy URL</span>';
        }}, 2000);
      }});
    }}

    function copyExtPath() {{
      navigator.clipboard.writeText(folderPath).then(() => {{
        const icon = document.getElementById('copyPathIcon');
        const text = document.getElementById('copyPathText');
        if (icon) icon.outerHTML = checkSvg;
        if (text) text.innerText = 'Path Copied';
        setTimeout(() => {{
          const btn = document.getElementById('btnCopyPath');
          btn.innerHTML = origFolderSvg + '<span id="copyPathText">Copy Folder Path</span>';
        }}, 2000);
      }});
    }}

    // Auto-copy extUrl to clipboard on load
    window.addEventListener('load', () => {{
      navigator.clipboard.writeText(extUrl).catch(() => {{}});
    }});

    // Connect to WebSocket server to detect live connection
    try {{
      const ws = new WebSocket('ws://127.0.0.1:49152');
      ws.onmessage = (event) => {{
        try {{
          const data = JSON.parse(event.data);
          if (data.type === 'STATUS' || data.type === 'PONG') {{
            document.getElementById('statusCard').classList.add('connected');
            document.getElementById('statusText').innerText = 'Extension Bridge Connected';
          }}
        }} catch(e) {{}}
      }};
      setInterval(() => {{
        if (ws.readyState === WebSocket.OPEN) {{
          ws.send(JSON.stringify({{ type: 'PING' }}));
        }}
      }}, 1500);
    }} catch(err) {{}}
  </script>
</body>
</html>"##,
        browser_name = browser_name,
        ext_url = ext_url,
        extension_path_escaped = extension_path.replace('\\', "\\\\")
    );

    let _ = fs::write(&setup_html_path, html_content);
    setup_html_path
}

#[tauri::command]
pub fn launch_browser_for_extension_setup(
    app: tauri::AppHandle,
    browser: String,
    profile_directory: Option<String>,
) -> Result<String, String> {
    let dir = resolve_extension_dir(&app, Some(&browser))?;
    let path_str = dir.to_string_lossy().to_string();

    let b_lower = browser.to_lowercase();
    let profile_folder = profile_directory.unwrap_or_else(|| "Default".to_string());

    let app_data = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let setup_html_path = generate_setup_guide_html(&app_data, &path_str, &browser);
    let file_url = format!("file:///{}", setup_html_path.to_string_lossy().replace('\\', "/"));

    if let Some(exe_path) = find_browser_exe(&browser) {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = std::process::Command::new(&exe_path);
            match b_lower.as_str() {
                "chrome" => {
                    cmd.arg(format!("--profile-directory={}", profile_folder))
                        .arg("--no-first-run")
                        .arg(&file_url);
                }
                "edge" => {
                    cmd.arg(format!("--profile-directory={}", profile_folder))
                        .arg(&file_url);
                }
                "brave" => {
                    cmd.arg(format!("--profile-directory={}", profile_folder))
                        .arg(&file_url);
                }
                "zen" | "firefox" => {
                    cmd.arg("about:debugging#/runtime/this-firefox");
                }
                _ => {
                    cmd.arg(&file_url);
                }
            }
            let _ = cmd.spawn();
        }
    } else {
        #[cfg(target_os = "windows")]
        {
            let target_url = match b_lower.as_str() {
                "zen" | "firefox" => "about:debugging#/runtime/this-firefox".to_string(),
                _ => file_url.clone(),
            };
            let _ = std::process::Command::new("cmd")
                .args(["/C", "start", &target_url])
                .spawn();
        }
    }

    // Open Windows Explorer directly with the unpacked extension folder
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&dir)
            .spawn();
    }

    Ok(path_str)
}

#[tauri::command]
pub fn launch_browser_with_extension(app: tauri::AppHandle, browser: String) -> Result<String, String> {
    let dir = resolve_extension_dir(&app, Some(&browser))?;
    let path_str = dir.to_string_lossy().to_string();

    let exe_path = find_browser_exe(&browser)
        .ok_or_else(|| format!("Could not find executable for {}", browser))?;

    let b_lower = browser.to_lowercase();
    if b_lower == "chrome" || b_lower == "edge" || b_lower == "brave" {
        let app_data = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let test_profile_dir = app_data.join("test_profiles").join(&b_lower);
        fs::create_dir_all(&test_profile_dir)
            .map_err(|e| format!("Failed to create test profile dir: {}", e))?;

        let ext_page = match b_lower.as_str() {
            "edge" => "edge://extensions",
            "brave" => "brave://extensions",
            _ => "chrome://extensions",
        };

        #[cfg(target_os = "windows")]
        {
            std::process::Command::new(&exe_path)
                .arg(format!("--user-data-dir={}", test_profile_dir.to_string_lossy()))
                .arg(format!("--load-extension={}", path_str))
                .arg("--no-first-run")
                .arg("--no-default-browser-check")
                .arg(ext_page)
                .spawn()
                .map_err(|e| format!("Failed to launch browser: {}", e))?;
        }
        Ok(format!("Launched {} instance with BookVisor extension pre-loaded!", browser))
    } else {
        Err(format!("Direct command-line flag loading is supported for Chromium browsers (Chrome, Edge, Brave). For {}, use 1-Click Setup to load via about:debugging.", browser))
    }
}

