use reqwest::header::USER_AGENT;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeResult {
    pub bookmark_id: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub favicon_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub link_status: String,
    pub http_code: Option<i32>,
    pub wayback_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScraperProgress {
    pub is_running: bool,
    pub is_paused: bool,
    pub total: usize,
    pub completed: usize,
    pub current_url: Option<String>,
}

#[derive(Default)]
pub struct ScraperState {
    pub is_running: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
}

#[derive(Deserialize)]
struct WaybackResponse {
    archived_snapshots: WaybackSnapshots,
}

#[derive(Deserialize)]
struct WaybackSnapshots {
    closest: Option<WaybackSnapshot>,
}

#[derive(Deserialize)]
struct WaybackSnapshot {
    available: bool,
    url: String,
}

pub async fn scrape_single_url(
    client: &reqwest::Client,
    bookmark_id: &str,
    target_url: &str,
) -> ScrapeResult {
    let mut result = ScrapeResult {
        bookmark_id: bookmark_id.to_string(),
        title: None,
        summary: None,
        favicon_url: None,
        cover_image_url: None,
        link_status: "UNCHECKED".to_string(),
        http_code: None,
        wayback_url: None,
    };

    let resp = client
        .get(target_url)
        .header(
            USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        )
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Sec-Ch-Ua", "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"")
        .header("Sec-Ch-Ua-Mobile", "?0")
        .header("Sec-Ch-Ua-Platform", "\"Windows\"")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1")
        .header("Upgrade-Insecure-Requests", "1")
        .timeout(Duration::from_secs(8))
        .send()
        .await;

    match resp {
        Ok(response) => {
            let status = response.status();
            let code = status.as_u16() as i32;
            result.http_code = Some(code);

            let is_cf_waf = response.headers().contains_key("cf-ray")
                || response
                    .headers()
                    .get("server")
                    .and_then(|s| s.to_str().ok())
                    .map(|s| s.to_lowercase().contains("cloudflare"))
                    .unwrap_or(false);

            if status.is_success() {
                result.link_status = "LIVE".to_string();

                // Read body text limit to 1MB
                if let Ok(text) = response.text().await {
                    let text_lower = text.to_lowercase();
                    // Detect if a Cloudflare / Turnstile challenge was returned even with 200 OK
                    if text_lower.contains("challenges.cloudflare.com")
                        || text_lower.contains("cf-browser-verification")
                        || text_lower.contains("just a moment...")
                    {
                        result.link_status = "BOT CHECK".to_string();
                    } else {
                        let document = Html::parse_document(&text);

                        // 1. Title
                        let title_sel = Selector::parse("title").ok();
                        let og_title_sel = Selector::parse("meta[property='og:title']").ok();

                        let og_title = og_title_sel.and_then(|sel| {
                            document.select(&sel).next().and_then(|el| el.value().attr("content"))
                        });

                        let page_title = title_sel.and_then(|sel| {
                            document.select(&sel).next().map(|el| el.text().collect::<Vec<_>>().join(" "))
                        });

                        result.title = og_title.map(|s| s.trim().to_string()).or_else(|| page_title.map(|s| s.trim().to_string()));

                        // 2. Description / Summary
                        let desc_sel = Selector::parse("meta[name='description'], meta[property='og:description']").ok();
                        let meta_desc = desc_sel.and_then(|sel| {
                            document.select(&sel).next().and_then(|el| el.value().attr("content"))
                        });

                        if let Some(desc) = meta_desc {
                            let trimmed = desc.trim();
                            if !trimmed.is_empty() {
                                result.summary = Some(trimmed.chars().take(400).collect());
                            }
                        }

                        // Fallback to article / main / body snippet if no meta description
                        if result.summary.is_none() {
                            let body_sel = Selector::parse("article, main, p").ok();
                            if let Some(sel) = body_sel {
                                let mut snippet = String::new();
                                for el in document.select(&sel) {
                                    let t = el.text().collect::<Vec<_>>().join(" ");
                                    let cleaned = t.split_whitespace().collect::<Vec<_>>().join(" ");
                                    if cleaned.len() > 30 {
                                        snippet.push_str(&cleaned);
                                        snippet.push(' ');
                                        if snippet.len() >= 250 {
                                            break;
                                        }
                                    }
                                }
                                if !snippet.trim().is_empty() {
                                    result.summary = Some(snippet.trim().chars().take(300).collect());
                                }
                            }
                        }

                        // 3. Favicon
                        let icon_sel = Selector::parse("link[rel*='icon']").ok();
                        if let Some(sel) = icon_sel {
                            if let Some(el) = document.select(&sel).next() {
                                if let Some(href) = el.value().attr("href") {
                                    if let Ok(base) = url::Url::parse(target_url) {
                                        if let Ok(full_icon) = base.join(href) {
                                            result.favicon_url = Some(full_icon.to_string());
                                        }
                                    }
                                }
                            }
                        }

                        // 4. Cover Picture (og:image / twitter:image)
                        let cover_sel = Selector::parse("meta[property='og:image'], meta[property='og:image:secure_url'], meta[name='twitter:image'], meta[name='twitter:image:src'], link[rel='image_src']").ok();
                        if let Some(sel) = cover_sel {
                            if let Some(el) = document.select(&sel).next() {
                                if let Some(src) = el.value().attr("content").or_else(|| el.value().attr("href")) {
                                    let trimmed = src.trim();
                                    if !trimmed.is_empty() {
                                        if let Ok(base) = url::Url::parse(target_url) {
                                            if let Ok(full_cover) = base.join(trimmed) {
                                                result.cover_image_url = Some(full_cover.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Automatic screenshot fallback if no meta cover was found
                        if result.cover_image_url.is_none() {
                            result.cover_image_url = Some(format!(
                                "https://v1.screenshot.11ty.dev/{}/opengraph/",
                                urlencoding::encode(target_url)
                            ));
                        }
                    }
                }
            } else if status.is_redirection() {
                result.link_status = "REDIRECT".to_string();
            } else if status == reqwest::StatusCode::FORBIDDEN
                || status == reqwest::StatusCode::TOO_MANY_REQUESTS
                || is_cf_waf
            {
                // Cloudflare, Turnstile, or WAF bot challenges (never mark as DEAD)
                result.link_status = "BOT CHECK".to_string();
            } else if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::GONE {
                result.link_status = "DEAD".to_string();
                // Query Wayback Machine
                result.wayback_url = check_wayback_machine(client, target_url).await;
            } else if status.is_client_error() || status.is_server_error() {
                result.link_status = "DEAD".to_string();
                result.wayback_url = check_wayback_machine(client, target_url).await;
            } else {
                result.link_status = "DEAD".to_string();
            }
        }
        Err(e) => {
            if e.is_timeout() {
                result.link_status = "TIMEOUT".to_string();
            } else {
                result.link_status = "DEAD".to_string();
            }
            result.wayback_url = check_wayback_machine(client, target_url).await;
        }
    }

    // Fallback: If no favicon found in HTML, use Google/DuckDuckGo high-res favicons
    if result.favicon_url.is_none() {
        if let Ok(base) = url::Url::parse(target_url) {
            if let Some(host) = base.host_str() {
                result.favicon_url = Some(format!("https://www.google.com/s2/favicons?domain={}&sz=64", host));
            }
        }
    }

    result
}

pub async fn check_wayback_machine(client: &reqwest::Client, url: &str) -> Option<String> {
    let api_url = format!("https://archive.org/wayback/available?url={}", url);
    if let Ok(resp) = client.get(&api_url).timeout(Duration::from_secs(5)).send().await {
        if let Ok(wb) = resp.json::<WaybackResponse>().await {
            if let Some(closest) = wb.archived_snapshots.closest {
                if closest.available && !closest.url.is_empty() {
                    return Some(closest.url);
                }
            }
        }
    }
    None
}

// ── Background Worker Orchestration ─────────────────────────────────────────

#[tauri::command]
pub async fn start_background_scrape(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    scraper_state: tauri::State<'_, ScraperState>,
    folder_id: Option<String>,
    force_all: Option<bool>,
) -> Result<(), String> {
    if scraper_state.is_running.load(Ordering::SeqCst) {
        return Ok(());
    }

    scraper_state.is_running.store(true, Ordering::SeqCst);
    scraper_state.is_paused.store(false, Ordering::SeqCst);

    let is_running = scraper_state.is_running.clone();
    let is_paused = scraper_state.is_paused.clone();
    let conn_arc = state.conn.clone();
    let force = force_all.unwrap_or(false);

    // Fetch bookmarks scoped to folder or entire library
    let bookmarks_to_scrape: Vec<(String, String)> = {
        let conn = conn_arc.lock().unwrap();

        let mut list = Vec::new();

        if let Some(ref fid) = folder_id {
            if fid == "unorganized" {
                let sql = if force {
                    "SELECT id, clean_url FROM bookmarks WHERE folder_id IS NULL AND is_deleted = 0 AND is_hidden = 0 LIMIT 5000"
                } else {
                    "SELECT id, clean_url FROM bookmarks WHERE folder_id IS NULL AND link_status = 'UNCHECKED' AND is_deleted = 0 AND is_hidden = 0 LIMIT 5000"
                };
                let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
                let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
                for r in rows {
                    if let Ok(item) = r { list.push(item); }
                }
                // If 0 unchecked and not forced, fallback to all in unorganized
                if list.is_empty() && !force {
                    let mut fallback = conn.prepare("SELECT id, clean_url FROM bookmarks WHERE folder_id IS NULL AND is_deleted = 0 AND is_hidden = 0 LIMIT 5000").map_err(|e| e.to_string())?;
                    let f_rows = fallback.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
                    for r in f_rows { if let Ok(item) = r { list.push(item); } }
                }
            } else {
                // Recursive CTE to include this folder and all nested descendant folders!
                let sql = if force {
                    r#"
                    WITH RECURSIVE subfolders AS (
                        SELECT id FROM folders WHERE id = ?1
                        UNION ALL
                        SELECT f.id FROM folders f
                        JOIN subfolders s ON f.parent_id = s.id
                        WHERE f.is_deleted = 0
                    )
                    SELECT id, clean_url FROM bookmarks
                    WHERE folder_id IN (SELECT id FROM subfolders) AND is_deleted = 0 AND is_hidden = 0
                      AND folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)
                    LIMIT 5000
                    "#
                } else {
                    r#"
                    WITH RECURSIVE subfolders AS (
                        SELECT id FROM folders WHERE id = ?1
                        UNION ALL
                        SELECT f.id FROM folders f
                        JOIN subfolders s ON f.parent_id = s.id
                        WHERE f.is_deleted = 0
                    )
                    SELECT id, clean_url FROM bookmarks
                    WHERE folder_id IN (SELECT id FROM subfolders)
                      AND link_status = 'UNCHECKED' AND is_deleted = 0 AND is_hidden = 0
                      AND folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)
                    LIMIT 5000
                    "#
                };
                let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
                let rows = stmt.query_map([fid], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
                for r in rows {
                    if let Ok(item) = r { list.push(item); }
                }

                // If 0 unchecked and not forced, fallback to all in this folder tree
                if list.is_empty() && !force {
                    let fallback_sql = r#"
                    WITH RECURSIVE subfolders AS (
                        SELECT id FROM folders WHERE id = ?1
                        UNION ALL
                        SELECT f.id FROM folders f
                        JOIN subfolders s ON f.parent_id = s.id
                        WHERE f.is_deleted = 0
                    )
                    SELECT id, clean_url FROM bookmarks
                    WHERE folder_id IN (SELECT id FROM subfolders) AND is_deleted = 0 AND is_hidden = 0
                      AND folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)
                    LIMIT 5000
                    "#;
                    let mut fallback = conn.prepare(fallback_sql).map_err(|e| e.to_string())?;
                    let f_rows = fallback.query_map([fid], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
                    for r in f_rows { if let Ok(item) = r { list.push(item); } }
                }
            }
        } else {
            // Entire library: exclude hidden bookmarks and bookmarks whose folder is hidden
            let sql = if force {
                "SELECT id, clean_url FROM bookmarks WHERE is_deleted = 0 AND is_hidden = 0 AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)) LIMIT 5000"
            } else {
                "SELECT id, clean_url FROM bookmarks WHERE link_status = 'UNCHECKED' AND is_deleted = 0 AND is_hidden = 0 AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)) LIMIT 5000"
            };
            let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
            for r in rows {
                if let Ok(item) = r { list.push(item); }
            }
            if list.is_empty() && !force {
                let mut fallback = conn.prepare("SELECT id, clean_url FROM bookmarks WHERE is_deleted = 0 AND is_hidden = 0 AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1)) LIMIT 5000").map_err(|e| e.to_string())?;
                let f_rows = fallback.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
                for r in f_rows { if let Ok(item) = r { list.push(item); } }
            }
        }

        list
    };

    let total = bookmarks_to_scrape.len();
    if total == 0 {
        is_running.store(false, Ordering::SeqCst);
        let _ = app.emit(
            "scraper://progress",
            ScraperProgress {
                is_running: false,
                is_paused: false,
                total: 0,
                completed: 0,
                current_url: None,
            },
        );
        return Ok(());
    }

    tokio::spawn(async move {
        let client = Arc::new(
            reqwest::Client::builder()
                .timeout(Duration::from_secs(8))
                .build()
                .unwrap_or_default(),
        );

        let completed = Arc::new(AtomicUsize::new(0));
        let semaphore = Arc::new(tokio::sync::Semaphore::new(16));
        let last_emit = Arc::new(Mutex::new(std::time::Instant::now()));

        let mut tasks = Vec::new();

        for (id, url) in bookmarks_to_scrape {
            if !is_running.load(Ordering::SeqCst) {
                break;
            }

            // Pause loop
            while is_paused.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(400)).await;
                if !is_running.load(Ordering::SeqCst) {
                    break;
                }
            }

            let permit = match semaphore.clone().acquire_owned().await {
                Ok(p) => p,
                Err(_) => break,
            };

            let client = client.clone();
            let conn_arc = conn_arc.clone();
            let is_running = is_running.clone();
            let completed = completed.clone();
            let app = app.clone();
            let last_emit = last_emit.clone();
            let url_clone = url.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = permit;
                if !is_running.load(Ordering::SeqCst) {
                    return;
                }

                let res = scrape_single_url(&client, &id, &url_clone).await;

                // Commit to SQLite
                if let Ok(conn) = conn_arc.lock() {
                    let now = chrono::Utc::now().to_rfc3339();
                    let _ = conn.execute(
                        r#"
                        UPDATE bookmarks
                        SET scraped_title = COALESCE(?1, scraped_title),
                            scraped_summary = COALESCE(?2, scraped_summary),
                            description = COALESCE(description, ?2),
                            cover_image_url = COALESCE(cover_image_url, ?3),
                            favicon_url = COALESCE(?4, favicon_url),
                            link_status = ?5,
                            http_code = ?6,
                            wayback_url = ?7,
                            updated_at = ?8
                        WHERE id = ?9
                        "#,
                        rusqlite::params![
                            res.title,
                            res.summary,
                            res.cover_image_url,
                            res.favicon_url,
                            res.link_status,
                            res.http_code,
                            res.wayback_url,
                            now,
                            id
                        ],
                    );
                }

                let cur_completed = completed.fetch_add(1, Ordering::SeqCst) + 1;

                // Throttled progress emission to prevent IPC message flooding
                let should_emit = {
                    if let Ok(mut last) = last_emit.lock() {
                        if last.elapsed() >= Duration::from_millis(120) || cur_completed == total {
                            *last = std::time::Instant::now();
                            true
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                if should_emit {
                    let _ = app.emit(
                        "scraper://progress",
                        ScraperProgress {
                            is_running: true,
                            is_paused: false,
                            total,
                            completed: cur_completed,
                            current_url: Some(url_clone),
                        },
                    );
                }
            }));
        }

        // Wait for all concurrent scrape tasks to conclude
        for t in tasks {
            let _ = t.await;
        }

        let final_completed = completed.load(Ordering::SeqCst);
        is_running.store(false, Ordering::SeqCst);
        let _ = app.emit(
            "scraper://progress",
            ScraperProgress {
                is_running: false,
                is_paused: false,
                total,
                completed: final_completed,
                current_url: None,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn pause_background_scrape(scraper_state: tauri::State<ScraperState>) -> Result<(), String> {
    scraper_state.is_paused.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn resume_background_scrape(scraper_state: tauri::State<ScraperState>) -> Result<(), String> {
    scraper_state.is_paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn stop_background_scrape(scraper_state: tauri::State<ScraperState>) -> Result<(), String> {
    scraper_state.is_running.store(false, Ordering::SeqCst);
    scraper_state.is_paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn check_single_bookmark_health(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    bookmark_id: String,
) -> Result<crate::db::Bookmark, String> {
    let conn_arc = state.conn.clone();
    let (url, clean_url) = {
        let conn = conn_arc.lock().unwrap();
        conn.query_row(
            "SELECT url, clean_url FROM bookmarks WHERE id = ?1",
            [&bookmark_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        )
        .map_err(|e| format!("Bookmark not found: {}", e))?
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_default();

    let mut res = scrape_single_url(&client, &bookmark_id, &clean_url).await;

    // If clean_url failed, try raw URL
    if (res.link_status == "DEAD" || res.link_status == "TIMEOUT") && url != clean_url {
        let alt_res = scrape_single_url(&client, &bookmark_id, &url).await;
        if alt_res.link_status == "LIVE" || alt_res.link_status == "BOT CHECK" {
            res = alt_res;
        }
    }

    // Ensure fallback favicon is set
    if res.favicon_url.is_none() {
        if let Ok(base) = url::Url::parse(&clean_url) {
            if let Some(host) = base.host_str() {
                res.favicon_url = Some(format!("https://www.google.com/s2/favicons?domain={}&sz=64", host));
            }
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = conn_arc.lock().unwrap();
        conn.execute(
            r#"
            UPDATE bookmarks
            SET scraped_title = COALESCE(?1, scraped_title),
                scraped_summary = COALESCE(?2, scraped_summary),
                description = COALESCE(description, ?2),
                cover_image_url = COALESCE(cover_image_url, ?3),
                favicon_url = COALESCE(?4, favicon_url),
                link_status = ?5,
                http_code = ?6,
                wayback_url = ?7,
                updated_at = ?8
            WHERE id = ?9
            "#,
            rusqlite::params![
                res.title,
                res.summary,
                res.cover_image_url,
                res.favicon_url,
                res.link_status,
                res.http_code,
                res.wayback_url,
                now,
                bookmark_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // Retrieve updated bookmark record
    let updated_bookmark = {
        let conn = conn_arc.lock().unwrap();
        conn.query_row(
            &format!(
                r#"
                SELECT {}
                FROM bookmarks
                WHERE id = ?1
                "#,
                crate::db::BOOKMARK_SELECT_FIELDS
            ),
            [&bookmark_id],
            crate::db::map_bookmark_row,
        )
        .map_err(|e| e.to_string())?
    };

    let _ = app.emit("bookmark://updated", &updated_bookmark);

    Ok(updated_bookmark)
}

#[tauri::command]
pub async fn db_fetch_website_cover(
    state: tauri::State<'_, crate::db::DbState>,
    bookmark_id: String,
    url: String,
) -> Result<Option<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_default();

    let resp = client
        .get(&url)
        .header(
            USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        )
        .send()
        .await;

    let mut found_image: Option<String> = None;
    if let Ok(res) = resp {
        if res.status().is_success() {
            if let Ok(html) = res.text().await {
                let doc = Html::parse_document(&html);
                let sel = Selector::parse("meta[property='og:image'], meta[property='og:image:secure_url'], meta[name='twitter:image'], meta[name='twitter:image:src'], link[rel='image_src']").ok();
                if let Some(s) = sel {
                    for el in doc.select(&s) {
                        if let Some(src) = el.value().attr("content").or_else(|| el.value().attr("href")) {
                            let trimmed = src.trim();
                            if !trimmed.is_empty() {
                                if let Ok(base) = url::Url::parse(&url) {
                                    if let Ok(full) = base.join(trimmed) {
                                        found_image = Some(full.to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if found_image.is_none() {
        let fallback = format!(
            "https://v1.screenshot.11ty.dev/{}/opengraph/",
            urlencoding::encode(&url)
        );
        found_image = Some(fallback);
    }

    if let Some(ref img_url) = found_image {
        let conn = state.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let _ = conn.execute(
            "UPDATE bookmarks SET cover_image_url = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![img_url, now, bookmark_id],
        );
    }

    Ok(found_image)
}

