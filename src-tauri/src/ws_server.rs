use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

pub const WS_PORT: u16 = 49152;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenSyncStatus {
    pub is_running: bool,
    pub connected_clients: usize,
    pub port: u16,
    pub connected_browser: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ExtensionMessage {
    #[serde(rename = "PING")]
    Ping,
    #[serde(rename = "PONG")]
    Pong,
    #[serde(rename = "CLIENT_HELLO")]
    ClientHello {
        browser: String,
        version: Option<String>,
    },
    #[serde(rename = "BROWSER_TREE")]
    BrowserTree(serde_json::Value),
    #[serde(rename = "BOOKMARK_CREATED")]
    BookmarkCreated {
        guid: String,
        url: String,
        title: String,
        parent_guid: Option<String>,
        date_added: Option<u64>,
    },
    #[serde(rename = "BOOKMARK_UPDATED")]
    BookmarkUpdated {
        guid: String,
        title: Option<String>,
        url: Option<String>,
    },
    #[serde(rename = "BOOKMARK_MOVED")]
    BookmarkMoved {
        guid: String,
        parent_guid: Option<String>,
        index: Option<i32>,
    },
    #[serde(rename = "BOOKMARK_REMOVED")]
    BookmarkRemoved { guid: String },
    #[serde(rename = "FOLDER_CREATED")]
    FolderCreated {
        guid: String,
        title: String,
        parent_guid: Option<String>,
    },
    #[serde(rename = "FOLDER_UPDATED")]
    FolderUpdated {
        guid: String,
        title: String,
    },
    #[serde(rename = "FOLDER_REMOVED")]
    FolderRemoved { guid: String },
    #[serde(rename = "MUTATE_TREE")]
    MutateTree(serde_json::Value),
}

pub struct WsServerState {
    pub is_running: Arc<AtomicBool>,
    pub connected_clients: Arc<AtomicUsize>,
    pub last_browser_name: Arc<std::sync::Mutex<Option<String>>>,
    pub broadcast_tx: broadcast::Sender<String>,
}

impl Default for WsServerState {
    fn default() -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            connected_clients: Arc::new(AtomicUsize::new(0)),
            last_browser_name: Arc::new(std::sync::Mutex::new(None)),
            broadcast_tx,
        }
    }
}

pub fn broadcast_desktop_mutation(
    app: &AppHandle,
    event_type: &str,
    payload: serde_json::Value,
) {
    if let Some(ws_state) = app.try_state::<WsServerState>() {
        let msg = serde_json::json!({
            "type": event_type,
            "mutationId": uuid::Uuid::new_v4().to_string(),
            "payload": payload,
        })
        .to_string();
        let _ = ws_state.broadcast_tx.send(msg);
    }
}

pub fn init_ws_server(app: AppHandle) {
    let ws_state = app.state::<WsServerState>();
    let broadcast_tx = ws_state.broadcast_tx.clone();
    let is_running = ws_state.is_running.clone();
    let connected_clients = ws_state.connected_clients.clone();
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Zen WebSocket] Failed to create Tokio runtime: {}", e);
                return;
            }
        };

        rt.block_on(async move {
            let addr: SocketAddr = ([127, 0, 0, 1], WS_PORT).into();
            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => {
                    is_running.store(true, Ordering::SeqCst);
                    let _ = app_handle.emit(
                        "zen_sync://status",
                        ZenSyncStatus {
                            is_running: true,
                            connected_clients: 0,
                            port: WS_PORT,
                            connected_browser: None,
                        },
                    );
                    l
                }
                Err(e) => {
                    eprintln!("[Zen WebSocket] Failed to bind 127.0.0.1:{}: {}", WS_PORT, e);
                    return;
                }
            };

            println!("[Zen WebSocket] Listening for Zen Browser on ws://127.0.0.1:{}", WS_PORT);

            while let Ok((stream, client_addr)) = listener.accept().await {
                let client_app = app_handle.clone();
                let mut rx = broadcast_tx.subscribe();
                let client_connected = connected_clients.clone();
                let _client_broadcast_tx = broadcast_tx.clone();

                tokio::spawn(async move {
                    let ws_stream = match accept_async(stream).await {
                        Ok(s) => s,
                        Err(e) => {
                            eprintln!("[Zen WebSocket] Handshake failed from {}: {}", client_addr, e);
                            return;
                        }
                    };

                    let count = client_connected.fetch_add(1, Ordering::SeqCst) + 1;
                    let last_browser = client_app.state::<WsServerState>().last_browser_name.lock().ok().and_then(|b| b.clone());
                    let _ = client_app.emit(
                        "zen_sync://status",
                        ZenSyncStatus {
                            is_running: true,
                            connected_clients: count,
                            port: WS_PORT,
                            connected_browser: last_browser.clone(),
                        },
                    );
                    println!("[Zen WebSocket] Client connected: {} (total: {})", client_addr, count);

                    // Note: We deliberately do NOT automatically send REQUEST_TREE upon every connection.
                    // Requesting the full tree is done on explicit user demand (e.g. clicking "Sync Zen Browser"
                    // or "Trigger Full Resync"), preventing wiped libraries and deleted bookmarks from being
                    // unexpectedly re-imported whenever BookVisor starts up.

                    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                    let mut send_task = tokio::spawn(async move {
                        while let Ok(msg_str) = rx.recv().await {
                            if ws_sender.send(Message::Text(msg_str.into())).await.is_err() {
                                break;
                            }
                        }
                    });

                    let app_inner = client_app.clone();
                    let mut recv_task = tokio::spawn(async move {
                        while let Some(msg_res) = ws_receiver.next().await {
                            match msg_res {
                                Ok(Message::Text(text)) => {
                                    handle_incoming_extension_message(&app_inner, &text).await;
                                }
                                Ok(Message::Close(_)) => break,
                                Err(_) => break,
                                _ => {}
                            }
                        }
                    });

                    tokio::select! {
                        _ = (&mut send_task) => {},
                        _ = (&mut recv_task) => {},
                    };

                    let remaining = client_connected.fetch_sub(1, Ordering::SeqCst) - 1;
                    let _ = client_app.emit(
                        "zen_sync://status",
                        ZenSyncStatus {
                            is_running: true,
                            connected_clients: remaining,
                            port: WS_PORT,
                            connected_browser: if remaining > 0 { last_browser } else { None },
                        },
                    );
                    println!("[Zen WebSocket] Client disconnected: {} (remaining: {})", client_addr, remaining);
                });
            }
        });
    });
}

async fn handle_incoming_extension_message(app: &AppHandle, text: &str) {
    if let Ok(msg) = serde_json::from_str::<ExtensionMessage>(text) {
        match msg {
            ExtensionMessage::Ping => {
                let ws_state = app.state::<WsServerState>();
                let pong = serde_json::json!({ "type": "PONG" }).to_string();
                let _ = ws_state.broadcast_tx.send(pong);
            }
            ExtensionMessage::BookmarkCreated {
                guid,
                url,
                title,
                parent_guid,
                date_added: _,
            } => {
                let raw_trimmed = url.trim();
                if raw_trimmed.starts_with("http://") || raw_trimmed.starts_with("https://") {
                    let db_state = app.state::<crate::db::DbState>();
                    let clean_url = crate::url_cleaner::clean_url(raw_trimmed);
                    let domain = crate::url_cleaner::extract_domain(&clean_url);
                    let now = chrono::Utc::now().to_rfc3339();

                    if let Ok(conn) = db_state.conn.lock() {
                        // Check if active bookmark already exists
                        let already_active: bool = conn
                            .query_row(
                                "SELECT 1 FROM bookmarks WHERE (clean_url = ?1 OR browser_guid = ?2 OR url = ?3) AND is_deleted = 0 LIMIT 1",
                                rusqlite::params![clean_url, guid, raw_trimmed],
                                |_| Ok(true),
                            )
                            .unwrap_or(false);

                        if !already_active {
                            // Resolve parent folder ID from parent_guid if possible
                            let parent_folder_id: Option<String> = parent_guid.as_ref().and_then(|pguid| {
                                conn.query_row(
                                    "SELECT id FROM folders WHERE browser_guid = ?1 AND is_deleted = 0",
                                    [pguid],
                                    |r| r.get(0),
                                ).ok()
                            });

                            // Check if soft-deleted bookmark exists — un-delete it!
                            let existing_deleted_id: Option<String> = conn
                                .query_row(
                                    "SELECT id FROM bookmarks WHERE (clean_url = ?1 OR browser_guid = ?2 OR url = ?3) AND is_deleted = 1 LIMIT 1",
                                    rusqlite::params![clean_url, guid, raw_trimmed],
                                    |r| r.get(0),
                                )
                                .ok();

                            let active_b_id = if let Some(del_id) = existing_deleted_id {
                                let _ = conn.execute(
                                    "UPDATE bookmarks SET is_deleted = 0, folder_id = ?1, browser_guid = ?2, title = ?3, updated_at = ?4 WHERE id = ?5",
                                    rusqlite::params![parent_folder_id, guid, title, now, del_id],
                                );
                                del_id
                            } else {
                                let new_id = uuid::Uuid::new_v4().to_string();
                                let _ = conn.execute(
                                    r#"
                                    INSERT INTO bookmarks (
                                        id, folder_id, browser_guid, url, clean_url, domain, title,
                                        link_status, is_pinned, tags, created_at, updated_at, is_deleted
                                    )
                                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'UNCHECKED', 0, '[]', ?8, ?8, 0)
                                    "#,
                                    rusqlite::params![new_id, parent_folder_id, guid, raw_trimmed, clean_url, domain, title, now],
                                );
                                new_id
                            };

                            // Auto-map to Zen account in bookmark_account_mappings
                            if let Ok(zen_acc_id) = conn.query_row::<String, _, _>(
                                "SELECT id FROM browser_accounts WHERE browser_type = 'zen' ORDER BY created_at ASC LIMIT 1",
                                [],
                                |r| r.get(0),
                            ) {
                                let m_id = uuid::Uuid::new_v4().to_string();
                                let _ = conn.execute(
                                    "INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?4) ON CONFLICT(bookmark_id, account_id) DO NOTHING",
                                    rusqlite::params![m_id, active_b_id, zen_acc_id, now],
                                );
                            }

                            // Notify frontend to refresh
                            let _ = app.emit("zen_sync://bookmark_added", serde_json::json!({ "url": raw_trimmed, "title": title }));
                        }
                    };
                }
            }
            ExtensionMessage::ClientHello { browser, version } => {
                let ws_state = app.state::<WsServerState>();
                if let Ok(mut lock) = ws_state.last_browser_name.lock() {
                    *lock = Some(browser.clone());
                }
                let count = ws_state.connected_clients.load(Ordering::SeqCst);
                let _ = app.emit(
                    "zen_sync://status",
                    ZenSyncStatus {
                        is_running: true,
                        connected_clients: count,
                        port: WS_PORT,
                        connected_browser: Some(browser.clone()),
                    },
                );
                println!("[WebSocket Bridge] Client identified: {} (v: {:?})", browser, version);
            }
            ExtensionMessage::BookmarkUpdated { guid, title, url } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    if let Some(new_url) = url {
                        let raw_trimmed = new_url.trim();
                        if raw_trimmed.starts_with("http://") || raw_trimmed.starts_with("https://") {
                            let clean_url = crate::url_cleaner::clean_url(raw_trimmed);
                            let domain = crate::url_cleaner::extract_domain(&clean_url);
                            if let Some(new_title) = title {
                                let _ = conn.execute(
                                    "UPDATE bookmarks SET title = ?1, url = ?2, clean_url = ?3, domain = ?4, updated_at = ?5 WHERE browser_guid = ?6",
                                    rusqlite::params![new_title, raw_trimmed, clean_url, domain, now, guid],
                                );
                            } else {
                                let _ = conn.execute(
                                    "UPDATE bookmarks SET url = ?1, clean_url = ?2, domain = ?3, updated_at = ?4 WHERE browser_guid = ?5",
                                    rusqlite::params![raw_trimmed, clean_url, domain, now, guid],
                                );
                            }
                        }
                    } else if let Some(new_title) = title {
                        let _ = conn.execute(
                            "UPDATE bookmarks SET title = ?1, updated_at = ?2 WHERE browser_guid = ?3",
                            rusqlite::params![new_title, now, guid],
                        );
                    }
                }
                let _ = app.emit("zen_sync://bookmark_updated", serde_json::json!({ "guid": guid }));
            }
            ExtensionMessage::BookmarkMoved { guid, parent_guid, index: _ } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    let target_folder_id: Option<String> = parent_guid.as_ref().and_then(|pguid| {
                        conn.query_row(
                            "SELECT id FROM folders WHERE browser_guid = ?1 AND is_deleted = 0",
                            [pguid],
                            |r| r.get(0),
                        ).ok()
                    });
                    let _ = conn.execute(
                        "UPDATE bookmarks SET folder_id = ?1, updated_at = ?2 WHERE browser_guid = ?3",
                        rusqlite::params![target_folder_id, now, guid],
                    );
                }
                let _ = app.emit("zen_sync://bookmark_moved", serde_json::json!({ "guid": guid }));
            }
            ExtensionMessage::BookmarkRemoved { guid } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    let _ = conn.execute(
                        "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE browser_guid = ?2",
                        rusqlite::params![now, guid],
                    );
                }
                let _ = app.emit("zen_sync://bookmark_removed", serde_json::json!({ "guid": guid }));
            }
            ExtensionMessage::FolderCreated { guid, title, parent_guid } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    let parent_id: Option<String> = parent_guid.as_ref().and_then(|pguid| {
                        conn.query_row(
                            "SELECT id FROM folders WHERE browser_guid = ?1 AND is_deleted = 0",
                            [pguid],
                            |r| r.get(0),
                        ).ok()
                    });

                    let existing_id: Option<String> = conn
                        .query_row(
                            "SELECT id FROM folders WHERE browser_guid = ?1",
                            [&guid],
                            |r| r.get(0),
                        )
                        .ok();

                    if let Some(fid) = existing_id {
                        let _ = conn.execute(
                            "UPDATE folders SET is_deleted = 0, title = ?1, parent_id = ?2, updated_at = ?3 WHERE id = ?4",
                            rusqlite::params![title, parent_id, now, fid],
                        );
                    } else {
                        let new_fid = uuid::Uuid::new_v4().to_string();
                        let _ = conn.execute(
                            "INSERT INTO folders (id, parent_id, browser_guid, title, position, is_locked, created_at, updated_at, is_deleted) VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?5, 0)",
                            rusqlite::params![new_fid, parent_id, guid, title, now],
                        );
                    }
                }
                let _ = app.emit("zen_sync://folder_created", serde_json::json!({ "guid": guid, "title": title }));
            }
            ExtensionMessage::FolderUpdated { guid, title } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    let _ = conn.execute(
                        "UPDATE folders SET title = ?1, updated_at = ?2 WHERE browser_guid = ?3",
                        rusqlite::params![title, now, guid],
                    );
                }
                let _ = app.emit("zen_sync://folder_updated", serde_json::json!({ "guid": guid, "title": title }));
            }
            ExtensionMessage::FolderRemoved { guid } => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                if let Ok(conn) = db_state.conn.lock() {
                    let folder_id: Option<String> = conn
                        .query_row("SELECT id FROM folders WHERE browser_guid = ?1", [&guid], |r| r.get(0))
                        .ok();
                    if let Some(fid) = folder_id {
                        let _ = conn.execute("UPDATE folders SET is_deleted = 1, updated_at = ?1 WHERE id = ?2", rusqlite::params![now, fid]);
                        let _ = conn.execute("UPDATE bookmarks SET folder_id = NULL, updated_at = ?1 WHERE folder_id = ?2", rusqlite::params![now, fid]);
                    }
                }
                let _ = app.emit("zen_sync://folder_removed", serde_json::json!({ "guid": guid }));
            }
            ExtensionMessage::BrowserTree(tree) => {
                let db_state = app.state::<crate::db::DbState>();
                let now = chrono::Utc::now().to_rfc3339();
                let mut stats = crate::html_parser::ImportResult {
                    total_bookmarks_imported: 0,
                    total_folders_created: 0,
                    total_bookmarks_skipped: 0,
                };

                if let Ok(mut conn) = db_state.conn.lock() {
                    if let Ok(tx) = conn.transaction() {
                        if let Some(nodes) = tree.as_array() {
                            ingest_zen_nodes(&tx, nodes, None, &mut stats, &now);
                        } else if tree.is_object() {
                            ingest_zen_nodes(&tx, &[tree], None, &mut stats, &now);
                        }
                        let _ = tx.commit();
                    }
                }

                println!(
                    "[Zen WebSocket] Ingested Zen tree: {} bookmarks, {} folders",
                    stats.total_bookmarks_imported, stats.total_folders_created
                );

                let _ = app.emit(
                    "zen_sync://tree_imported",
                    serde_json::json!({
                        "imported": stats.total_bookmarks_imported,
                        "folders": stats.total_folders_created,
                    }),
                );
            }
            _ => {}
        }
    }
}

fn ingest_zen_nodes(
    conn: &rusqlite::Connection,
    nodes: &[serde_json::Value],
    parent_folder_id: Option<String>,
    stats: &mut crate::html_parser::ImportResult,
    now: &str,
) {
    for node in nodes {
        let title = node
            .get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .trim();
        let url_opt = node.get("url").and_then(|u| u.as_str());
        let guid = node.get("id").and_then(|id| id.as_str()).unwrap_or("");

        if let Some(url) = url_opt {
            let raw_trimmed = url.trim();
            if !raw_trimmed.starts_with("http://") && !raw_trimmed.starts_with("https://") {
                continue;
            }
            let clean = crate::url_cleaner::clean_url(raw_trimmed);
            if clean.is_empty() {
                continue;
            }

            // Check if bookmark already active in library by clean_url, browser_guid, or url
            let already_active: bool = conn
                .query_row(
                    "SELECT 1 FROM bookmarks WHERE (clean_url = ?1 OR browser_guid = ?2 OR url = ?3) AND is_deleted = 0 LIMIT 1",
                    rusqlite::params![clean, guid, raw_trimmed],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if already_active {
                stats.total_bookmarks_skipped += 1;
                continue;
            }

            // Check if soft-deleted bookmark exists — un-delete and assign!
            let existing_deleted_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM bookmarks WHERE (clean_url = ?1 OR browser_guid = ?2 OR url = ?3) AND is_deleted = 1 LIMIT 1",
                    rusqlite::params![clean, guid, raw_trimmed],
                    |r| r.get(0),
                )
                .ok();

            let active_b_id = if let Some(del_id) = existing_deleted_id {
                let res = conn.execute(
                    "UPDATE bookmarks SET is_deleted = 0, folder_id = ?1, browser_guid = ?2, title = ?3, updated_at = ?4 WHERE id = ?5",
                    rusqlite::params![parent_folder_id, guid, if title.is_empty() { &clean } else { title }, now, del_id],
                );
                if res.is_ok() {
                    stats.total_bookmarks_imported += 1;
                }
                del_id
            } else {
                let domain = crate::url_cleaner::extract_domain(&clean);
                let b_id = uuid::Uuid::new_v4().to_string();
                let res = conn.execute(
                    r#"
                    INSERT INTO bookmarks (
                        id, folder_id, browser_guid, url, clean_url, domain, title,
                        link_status, is_pinned, tags, created_at, updated_at, is_deleted
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'UNCHECKED', 0, '[]', ?8, ?8, 0)
                    "#,
                    rusqlite::params![
                        b_id,
                        parent_folder_id,
                        guid,
                        raw_trimmed,
                        clean,
                        domain,
                        if title.is_empty() { &domain } else { title },
                        now
                    ],
                );
                if res.is_ok() {
                    stats.total_bookmarks_imported += 1;
                }
                b_id
            };

            if let Ok(zen_acc_id) = conn.query_row::<String, _, _>(
                "SELECT id FROM browser_accounts WHERE browser_type = 'zen' ORDER BY created_at ASC LIMIT 1",
                [],
                |r| r.get(0),
            ) {
                let m_id = uuid::Uuid::new_v4().to_string();
                let _ = conn.execute(
                    "INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?4) ON CONFLICT(bookmark_id, account_id) DO NOTHING",
                    rusqlite::params![m_id, active_b_id, zen_acc_id, now],
                );
            }
        } else if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            // It's a folder or root container
            if guid == "root________" || title.is_empty() {
                ingest_zen_nodes(conn, children, None, stats, now);
            } else {
                // Check if folder already exists with this browser_guid OR with same title and parent
                let existing_folder_id: Option<String> = if !guid.is_empty() {
                    conn.query_row(
                        "SELECT id FROM folders WHERE browser_guid = ?1 AND is_deleted = 0",
                        [guid],
                        |r| r.get(0),
                    )
                    .ok()
                } else {
                    None
                }.or_else(|| {
                    match &parent_folder_id {
                        Some(pid) => conn
                            .query_row(
                                "SELECT id FROM folders WHERE title = ?1 AND parent_id = ?2 AND is_deleted = 0",
                                rusqlite::params![title, pid],
                                |r| r.get(0),
                            )
                            .ok(),
                        None => conn
                            .query_row(
                                "SELECT id FROM folders WHERE title = ?1 AND parent_id IS NULL AND is_deleted = 0",
                                rusqlite::params![title],
                                |r| r.get(0),
                            )
                            .ok(),
                    }
                });

                let folder_id = if let Some(fid) = existing_folder_id {
                    if !guid.is_empty() {
                        let _ = conn.execute(
                            "UPDATE folders SET browser_guid = ?1 WHERE id = ?2 AND (browser_guid IS NULL OR browser_guid = '')",
                            rusqlite::params![guid, fid],
                        );
                    }
                    fid
                } else {
                    let fid = uuid::Uuid::new_v4().to_string();
                    let res = conn.execute(
                        r#"
                        INSERT INTO folders (id, parent_id, browser_guid, title, position, is_locked, created_at, updated_at, is_deleted)
                        VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?5, 0)
                        "#,
                        rusqlite::params![fid, parent_folder_id, guid, title, now],
                    );
                    if res.is_ok() {
                        stats.total_folders_created += 1;
                    }
                    fid
                };

                ingest_zen_nodes(conn, children, Some(folder_id), stats, now);
            }
        }
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn zen_get_sync_status(ws_state: tauri::State<WsServerState>) -> ZenSyncStatus {
    let browser_name = ws_state.last_browser_name.lock().ok().and_then(|g| g.clone());
    ZenSyncStatus {
        is_running: ws_state.is_running.load(Ordering::SeqCst),
        connected_clients: ws_state.connected_clients.load(Ordering::SeqCst),
        port: WS_PORT,
        connected_browser: browser_name,
    }
}

#[tauri::command]
pub fn zen_request_browser_sync(ws_state: tauri::State<WsServerState>) -> Result<(), String> {
    if ws_state.connected_clients.load(Ordering::SeqCst) == 0 {
        return Err("Zen Browser Extension is not connected. Please ensure Zen Browser is running with the BookVisor extension installed.".to_string());
    }

    let payload = serde_json::json!({ "type": "REQUEST_TREE" }).to_string();
    ws_state
        .broadcast_tx
        .send(payload)
        .map_err(|e| format!("Broadcast error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn zen_push_tree_mutations(
    ws_state: tauri::State<WsServerState>,
    moves: Vec<crate::ai_engine::BookmarkMove>,
) -> Result<(), String> {
    if ws_state.connected_clients.load(Ordering::SeqCst) == 0 {
        return Err("Zen Browser Extension is not connected".to_string());
    }

    let payload = serde_json::json!({
        "type": "MUTATE_TREE",
        "moves": moves,
    })
    .to_string();

    ws_state
        .broadcast_tx
        .send(payload)
        .map_err(|e| format!("Broadcast error: {}", e))?;

    Ok(())
}

