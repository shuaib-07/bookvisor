use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub browser_guid: Option<String>,
    pub title: String,
    pub position: i32,
    pub is_locked: bool,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
    #[serde(default)]
    pub is_hidden: bool,
    pub bookmark_count: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderTreeNode {
    #[serde(flatten)]
    pub folder: Folder,
    pub children: Vec<FolderTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub folder_id: Option<String>,
    pub browser_guid: Option<String>,
    pub url: String,
    pub clean_url: String,
    pub domain: String,
    pub title: String,
    pub description: Option<String>,
    pub user_notes: Option<String>,
    pub cover_image_url: Option<String>,
    pub reminder_at: Option<String>,
    pub expires_at: Option<String>,
    pub scraped_title: Option<String>,
    pub scraped_summary: Option<String>,
    pub favicon_url: Option<String>,
    pub link_status: String,
    pub http_code: Option<i32>,
    pub wayback_url: Option<String>,
    pub is_pinned: bool,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default)]
    pub is_hidden: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
    #[serde(default)]
    pub account_ids: Vec<String>,
    #[serde(default)]
    pub list_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomList {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub bookmark_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartListCounts {
    pub favorites: i64,
    pub trash: i64,
    pub reminders: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub bookmark_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderItem {
    pub id: String,
    pub bookmark_id: String,
    pub title: String,
    pub url: String,
    pub due_at: String,
    pub is_delivered: bool,
    pub delivered_at: Option<String>,
    pub dismissed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatSession {
    pub id: String,
    pub title: String,
    pub scope_folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatMessageItem {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub cited_bookmarks_json: Option<String>,
    pub created_at: String,
}

pub const BOOKMARK_SELECT_FIELDS: &str = "id, folder_id, browser_guid, url, clean_url, domain, title, description, user_notes, cover_image_url, reminder_at, expires_at, scraped_title, scraped_summary, favicon_url, link_status, http_code, wayback_url, is_pinned, is_favorite, tags, created_at, updated_at, is_deleted, is_hidden";

pub fn map_bookmark_row(row: &rusqlite::Row) -> rusqlite::Result<Bookmark> {
    let tags_str: String = row.get(20)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(Bookmark {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        browser_guid: row.get(2)?,
        url: row.get(3)?,
        clean_url: row.get(4)?,
        domain: row.get(5)?,
        title: row.get(6)?,
        description: row.get(7)?,
        user_notes: row.get(8)?,
        cover_image_url: row.get(9)?,
        reminder_at: row.get(10)?,
        expires_at: row.get(11)?,
        scraped_title: row.get(12)?,
        scraped_summary: row.get(13)?,
        favicon_url: row.get(14)?,
        link_status: row.get(15)?,
        http_code: row.get(16)?,
        wayback_url: row.get(17)?,
        is_pinned: row.get::<_, i32>(18)? != 0,
        is_favorite: row.get::<_, i32>(19)? != 0,
        tags,
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
        is_deleted: row.get::<_, i32>(23)? != 0,
        is_hidden: row.get::<_, Option<i32>>(24)?.unwrap_or(0) != 0,
        account_ids: Vec::new(),
        list_ids: Vec::new(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserAccount {
    pub id: String,
    pub browser_type: String,
    pub profile_folder_name: String,
    pub display_name: String,
    pub user_email: Option<String>,
    pub color_dot: String,
    pub icon_name: String,
    pub bookmarks_file_path: Option<String>,
    pub is_active: bool,
    pub sync_mode: String,
    pub last_synced_at: Option<String>,
    pub created_at: String,
    pub bookmark_count: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkAccountMapping {
    pub id: String,
    pub bookmark_id: String,
    pub account_id: String,
    pub account_folder_path: Option<String>,
    pub account_guid: Option<String>,
    pub synced_at: Option<String>,
    pub is_dirty: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagedSyncMutation {
    pub id: String,
    pub account_id: String,
    pub account_name: Option<String>,
    pub action_type: String, // "ADD" | "REMOVE" | "MOVE" | "UPDATE"
    pub bookmark_id: String,
    pub bookmark_title: Option<String>,
    pub bookmark_url: Option<String>,
    pub payload_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub clean_url: String,
    pub domain: String,
    pub count: i64,
    pub bookmarks: Vec<Bookmark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryStats {
    pub total_bookmarks: i64,
    pub unorganized_count: i64,
    pub dead_links_count: i64,
    pub duplicate_count: i64,
    pub folder_count: i64,
    pub scraped_count: i64,
}

pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Performance optimizations: WAL mode & busy timeout
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        let state = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        state.run_migrations()?;
        Ok(state)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                browser_guid TEXT,
                title TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                is_locked INTEGER DEFAULT 0,
                color TEXT,
                icon TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
            CREATE INDEX IF NOT EXISTS idx_folders_deleted ON folders(is_deleted);

            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                folder_id TEXT,
                browser_guid TEXT,
                url TEXT NOT NULL,
                clean_url TEXT NOT NULL,
                domain TEXT NOT NULL,
                title TEXT NOT NULL,
                scraped_title TEXT,
                scraped_summary TEXT,
                favicon_url TEXT,
                link_status TEXT DEFAULT 'UNCHECKED',
                http_code INTEGER,
                wayback_url TEXT,
                is_pinned INTEGER DEFAULT 0,
                tags TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_clean_url ON bookmarks(clean_url);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_domain ON bookmarks(domain);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(link_status);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_deleted ON bookmarks(is_deleted);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_pinned_created ON bookmarks(is_deleted, is_pinned, created_at);

            CREATE TABLE IF NOT EXISTS bookmark_embeddings (
                bookmark_id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL,
                embedding BLOB,
                FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                synced_browser INTEGER DEFAULT 0,
                synced_cloud INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS browser_accounts (
                id TEXT PRIMARY KEY,
                browser_type TEXT NOT NULL,
                profile_folder_name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                user_email TEXT,
                color_dot TEXT NOT NULL DEFAULT '#3b82f6',
                icon_name TEXT NOT NULL DEFAULT 'chrome',
                bookmarks_file_path TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                sync_mode TEXT NOT NULL DEFAULT 'live',
                last_synced_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookmark_account_mappings (
                id TEXT PRIMARY KEY,
                bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
                account_id TEXT NOT NULL REFERENCES browser_accounts(id) ON DELETE CASCADE,
                account_folder_path TEXT,
                account_guid TEXT,
                synced_at TEXT,
                is_dirty INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                UNIQUE(bookmark_id, account_id)
            );

            CREATE INDEX IF NOT EXISTS idx_bam_bookmark ON bookmark_account_mappings(bookmark_id);
            CREATE INDEX IF NOT EXISTS idx_bam_account ON bookmark_account_mappings(account_id);

            CREATE TABLE IF NOT EXISTS staged_sync_mutations (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                bookmark_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            "#,
        )?;

        // Migrations for Bookmark Advanced Features
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN description TEXT", []);
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN user_notes TEXT", []);
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN cover_image_url TEXT", []);
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN reminder_at TEXT", []);
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN expires_at TEXT", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_reminder ON bookmarks(reminder_at)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_expires ON bookmarks(expires_at)", []);

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                icon TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                due_at TEXT NOT NULL,
                is_delivered INTEGER NOT NULL DEFAULT 0,
                delivered_at TEXT,
                dismissed_at TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, is_delivered);
            "#
        )?;

        // Migrations for Lists and Favoriting System
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_favorite ON bookmarks(is_favorite)", []);

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                icon TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_lists_pos ON lists(position);

            CREATE TABLE IF NOT EXISTS bookmark_lists (
                bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
                list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                position INTEGER NOT NULL DEFAULT 0,
                added_at TEXT NOT NULL,
                PRIMARY KEY (bookmark_id, list_id)
            );
            CREATE INDEX IF NOT EXISTS idx_bookmark_lists_list ON bookmark_lists(list_id);
            CREATE INDEX IF NOT EXISTS idx_bookmark_lists_bm ON bookmark_lists(bookmark_id);

            CREATE TABLE IF NOT EXISTS ai_chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                scope_folder_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated ON ai_chat_sessions(updated_at DESC);

            CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                cited_bookmarks_json TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at ASC);
            "#
        )?;

        // Migrations for Hidden Folders & Bookmarks
        let _ = conn.execute("ALTER TABLE folders ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE bookmarks ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_folders_hidden ON folders(is_hidden)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_hidden ON bookmarks(is_hidden)", []);

        // Ensure any existing subfolders and bookmarks inside hidden folders are synchronized as hidden
        let _ = conn.execute(
            r#"
            WITH RECURSIVE hidden_tree AS (
                SELECT id FROM folders WHERE is_hidden = 1 AND is_deleted = 0
                UNION ALL
                SELECT f.id FROM folders f JOIN hidden_tree h ON f.parent_id = h.id WHERE f.is_deleted = 0
            )
            UPDATE folders SET is_hidden = 1 WHERE id IN (SELECT id FROM hidden_tree) AND is_hidden = 0;
            "#,
            [],
        );
        let _ = conn.execute(
            r#"
            WITH RECURSIVE hidden_tree AS (
                SELECT id FROM folders WHERE is_hidden = 1 AND is_deleted = 0
                UNION ALL
                SELECT f.id FROM folders f JOIN hidden_tree h ON f.parent_id = h.id WHERE f.is_deleted = 0
            )
            UPDATE bookmarks SET is_hidden = 1 WHERE folder_id IN (SELECT id FROM hidden_tree) AND is_hidden = 0;
            "#,
            [],
        );

        Ok(())
    }
}

// ── Folder Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_folders(
    state: tauri::State<DbState>,
    account_id: Option<String>,
) -> Result<Vec<Folder>, String> {
    let conn = state.conn.lock().unwrap();

    let folders: Vec<Folder> = if let Some(ref acc_id) = account_id {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT f.id, f.parent_id, f.browser_guid, f.title, f.position, f.is_locked, f.color, f.icon,
                       f.created_at, f.updated_at, f.is_deleted, f.is_hidden,
                       COUNT(b.id) as bookmark_count
                FROM folders f
                LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.is_deleted = 0
                     AND b.id IN (SELECT bookmark_id FROM bookmark_account_mappings WHERE account_id = ?1)
                WHERE f.is_deleted = 0
                GROUP BY f.id
                ORDER BY f.position ASC, f.title ASC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([acc_id], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    browser_guid: row.get(2)?,
                    title: row.get(3)?,
                    position: row.get(4)?,
                    is_locked: row.get::<_, i32>(5)? != 0,
                    color: row.get(6)?,
                    icon: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    is_deleted: row.get::<_, i32>(10)? != 0,
                    is_hidden: row.get::<_, Option<i32>>(11)?.unwrap_or(0) != 0,
                    bookmark_count: Some(row.get(12)?),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for folder in rows {
            list.push(folder.map_err(|e| e.to_string())?);
        }
        list
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT f.id, f.parent_id, f.browser_guid, f.title, f.position, f.is_locked, f.color, f.icon,
                       f.created_at, f.updated_at, f.is_deleted, f.is_hidden,
                       COUNT(b.id) as bookmark_count
                FROM folders f
                LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.is_deleted = 0
                WHERE f.is_deleted = 0
                GROUP BY f.id
                ORDER BY f.position ASC, f.title ASC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    browser_guid: row.get(2)?,
                    title: row.get(3)?,
                    position: row.get(4)?,
                    is_locked: row.get::<_, i32>(5)? != 0,
                    color: row.get(6)?,
                    icon: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    is_deleted: row.get::<_, i32>(10)? != 0,
                    is_hidden: row.get::<_, Option<i32>>(11)?.unwrap_or(0) != 0,
                    bookmark_count: Some(row.get(12)?),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for folder in rows {
            list.push(folder.map_err(|e| e.to_string())?);
        }
        list
    };

    Ok(folders)
}

pub fn get_folder_path(conn: &rusqlite::Connection, folder_id: &str) -> Option<String> {
    let mut segments = Vec::new();
    let mut current_id = Some(folder_id.to_string());

    while let Some(id) = current_id {
        let res: Result<(String, Option<String>), _> = conn.query_row(
            "SELECT title, parent_id FROM folders WHERE id = ?1",
            rusqlite::params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        );

        match res {
            Ok((title, parent_id)) => {
                segments.push(title);
                current_id = parent_id;
            }
            Err(_) => break,
        }
    }

    if segments.is_empty() {
        None
    } else {
        segments.reverse();
        Some(segments.join(" / "))
    }
}

#[tauri::command]
pub fn db_create_folder(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    title: String,
    parent_id: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Folder, String> {
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // If creating inside a hidden parent, inherit hidden status
    let is_hidden: bool = if let Some(ref pid) = parent_id {
        conn.query_row(
            "SELECT is_hidden FROM folders WHERE id = ?1",
            params![pid],
            |r| r.get::<_, i32>(0),
        )
        .unwrap_or(0) != 0
    } else {
        false
    };

    conn.execute(
        r#"
        INSERT INTO folders (id, parent_id, title, position, is_locked, color, icon, created_at, updated_at, is_deleted, is_hidden)
        VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?6, 0, ?7)
        "#,
        params![id, parent_id, title, color, icon, now, if is_hidden { 1 } else { 0 }],
    )
    .map_err(|e| e.to_string())?;

    let parent_path = parent_id.as_ref().and_then(|pid| get_folder_path(&conn, pid));
    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_FOLDER_CREATED",
        serde_json::json!({
            "id": id,
            "title": title,
            "parent_id": parent_id,
            "parent_path": parent_path,
        }),
    );

    Ok(Folder {
        id,
        parent_id,
        browser_guid: None,
        title,
        position: 0,
        is_locked: false,
        color,
        icon,
        created_at: now.clone(),
        updated_at: now,
        is_deleted: false,
        is_hidden,
        bookmark_count: Some(0),
    })
}

#[tauri::command]
pub fn db_update_folder(
    state: tauri::State<DbState>,
    id: String,
    title: String,
    parent_id: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    is_locked: bool,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"
        UPDATE folders
        SET title = ?1, parent_id = ?2, color = ?3, icon = ?4, is_locked = ?5, updated_at = ?6
        WHERE id = ?7
        "#,
        params![title, parent_id, color, icon, if is_locked { 1 } else { 0 }, now, id],
    )
    .map_err(|e| e.to_string())?;

    // If moved into a hidden parent folder, cascade hidden state to this folder, its subfolders and bookmarks
    if let Some(ref pid) = parent_id {
        let parent_is_hidden: i32 = conn
            .query_row("SELECT is_hidden FROM folders WHERE id = ?1", params![pid], |r| r.get(0))
            .unwrap_or(0);
        if parent_is_hidden == 1 {
            let _ = conn.execute(
                r#"
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE id = ?1
                    UNION ALL
                    SELECT f.id FROM folders f JOIN subfolders s ON f.parent_id = s.id
                )
                UPDATE folders SET is_hidden = 1, updated_at = ?2 WHERE id IN (SELECT id FROM subfolders);
                "#,
                params![id, now],
            );
            let _ = conn.execute(
                r#"
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE id = ?1
                    UNION ALL
                    SELECT f.id FROM folders f JOIN subfolders s ON f.parent_id = s.id
                )
                UPDATE bookmarks SET is_hidden = 1, updated_at = ?2 WHERE folder_id IN (SELECT id FROM subfolders);
                "#,
                params![id, now],
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub fn db_toggle_folder_lock(state: tauri::State<DbState>, id: String) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current: i32 = conn
        .query_row("SELECT is_locked FROM folders WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let new_lock = if current == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE folders SET is_locked = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_lock, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_lock != 0)
}

#[tauri::command]
pub fn db_toggle_folder_hidden(state: tauri::State<DbState>, id: String) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current: i32 = conn
        .query_row("SELECT is_hidden FROM folders WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let new_val = if current == 0 { 1 } else { 0 };

    // 1. Cascade hidden state to the target folder and ALL of its descendant subfolders (recursively)
    conn.execute(
        r#"
        WITH RECURSIVE subfolders AS (
            SELECT id FROM folders WHERE id = ?1
            UNION ALL
            SELECT f.id FROM folders f JOIN subfolders s ON f.parent_id = s.id
        )
        UPDATE folders SET is_hidden = ?2, updated_at = ?3 WHERE id IN (SELECT id FROM subfolders);
        "#,
        params![id, new_val, now],
    )
    .map_err(|e| e.to_string())?;

    // 2. Cascade hidden state to ALL bookmarks belonging to the target folder or ANY of its descendant subfolders
    conn.execute(
        r#"
        WITH RECURSIVE subfolders AS (
            SELECT id FROM folders WHERE id = ?1
            UNION ALL
            SELECT f.id FROM folders f JOIN subfolders s ON f.parent_id = s.id
        )
        UPDATE bookmarks SET is_hidden = ?2, updated_at = ?3 WHERE folder_id IN (SELECT id FROM subfolders);
        "#,
        params![id, new_val, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_val != 0)
}

#[tauri::command]
pub fn db_delete_folder(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let (browser_guid, title): (Option<String>, String) = conn
        .query_row(
            "SELECT browser_guid, title FROM folders WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((None, String::new()));

    // Soft delete folder
    conn.execute(
        "UPDATE folders SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    // Move child bookmarks to unorganized (folder_id = NULL)
    conn.execute(
        "UPDATE bookmarks SET folder_id = NULL, updated_at = ?1 WHERE folder_id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_FOLDER_DELETED",
        serde_json::json!({
            "id": id,
            "browser_guid": browser_guid,
            "title": title,
        }),
    );

    Ok(())
}

// ── Bookmark Commands ───────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_bookmarks(
    state: tauri::State<DbState>,
    folder_id: Option<String>,
    search: Option<String>,
    filter_status: Option<String>,
    filter_tag: Option<String>,
    account_id: Option<String>,
    list_id: Option<String>,
    include_hidden: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Bookmark>, String> {
    let conn = state.conn.lock().unwrap();
    let limit = limit.unwrap_or(200);
    let offset = offset.unwrap_or(0);
    let now = Utc::now().to_rfc3339();

    let is_trash = list_id.as_deref() == Some("trash");

    let mut query = if is_trash {
        format!(
            r#"
            SELECT {}
            FROM bookmarks
            WHERE (is_deleted = 1 OR (expires_at IS NOT NULL AND expires_at <= ?))
            "#,
            BOOKMARK_SELECT_FIELDS
        )
    } else {
        format!(
            r#"
            SELECT {}
            FROM bookmarks
            WHERE is_deleted = 0
            "#,
            BOOKMARK_SELECT_FIELDS
        )
    };

    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    let inc_hidden = include_hidden.unwrap_or(false);
    let is_search = search.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);

    if !is_trash && (is_search || !inc_hidden) {
        query.push_str(" AND is_hidden = 0 AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1))");
    }

    if is_trash {
        param_values.push(Box::new(now.clone()));
    } else if let Some(ref lid) = list_id {
        if lid == "favorites" {
            query.push_str(" AND is_favorite = 1");
        } else if lid == "reminders" {
            query.push_str(" AND reminder_at IS NOT NULL");
        } else if !lid.trim().is_empty() {
            query.push_str(" AND id IN (SELECT bookmark_id FROM bookmark_lists WHERE list_id = ?)");
            param_values.push(Box::new(lid.clone()));
        }
    }

    if let Some(ref acc_id) = account_id {
        if !acc_id.trim().is_empty() && acc_id != "all" {
            query.push_str(" AND id IN (SELECT bookmark_id FROM bookmark_account_mappings WHERE account_id = ?)");
            param_values.push(Box::new(acc_id.clone()));
        }
    }

    if is_search {
        // GLOBAL SCOPED SEARCH: Searches all bookmarks in the entire library,
        // prioritizing results in the current folder (and its nested subfolders) first!
        if let Some(s) = search {
            let pattern = format!("%{}%", s.trim());
            query.push_str(" AND (title LIKE ? OR clean_url LIKE ? OR domain LIKE ? OR scraped_summary LIKE ? OR description LIKE ? OR user_notes LIKE ?)");
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }

        if let Some(status) = filter_status {
            if status == "dead" {
                query.push_str(" AND link_status IN ('DEAD', 'TIMEOUT')");
            } else if status == "live" {
                query.push_str(" AND link_status = 'LIVE'");
            } else if status == "unchecked" {
                query.push_str(" AND link_status = 'UNCHECKED'");
            }
        }

        if let Some(tag) = filter_tag {
            if !tag.trim().is_empty() {
                let tag_pattern = format!("%\"{}\"%", tag.trim());
                query.push_str(" AND tags LIKE ?");
                param_values.push(Box::new(tag_pattern));
            }
        }

        // Prioritize active folder (and its nested subfolders) first, then other folders
        if let Some(fid) = folder_id {
            if fid == "unorganized" {
                query.push_str(" ORDER BY (CASE WHEN folder_id IS NULL THEN 0 ELSE 1 END) ASC, is_pinned DESC, created_at DESC LIMIT ? OFFSET ?");
            } else {
                query.push_str(
                    r#" ORDER BY (CASE 
                        WHEN folder_id = ? OR folder_id IN (
                            WITH RECURSIVE sub AS (
                                SELECT id FROM folders WHERE id = ?
                                UNION ALL
                                SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id
                            ) SELECT id FROM sub
                        ) THEN 0 ELSE 1 END) ASC, is_pinned DESC, created_at DESC LIMIT ? OFFSET ?"#
                );
                param_values.push(Box::new(fid.clone()));
                param_values.push(Box::new(fid));
            }
        } else {
            query.push_str(" ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?");
        }
    } else {
        // NON-SEARCH BROWSING: Folder scoped view
        if let Some(fid) = folder_id {
            if fid == "unorganized" {
                query.push_str(" AND folder_id IS NULL");
            } else {
                query.push_str(" AND folder_id = ?");
                param_values.push(Box::new(fid));
            }
        }

        if let Some(status) = filter_status {
            if status == "dead" {
                query.push_str(" AND link_status IN ('DEAD', 'TIMEOUT')");
            } else if status == "live" {
                query.push_str(" AND link_status = 'LIVE'");
            } else if status == "unchecked" {
                query.push_str(" AND link_status = 'UNCHECKED'");
            }
        }

        if let Some(tag) = filter_tag {
            if !tag.trim().is_empty() {
                let tag_pattern = format!("%\"{}\"%", tag.trim());
                query.push_str(" AND tags LIKE ?");
                param_values.push(Box::new(tag_pattern));
            }
        }

        query.push_str(" ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?");
    }

    param_values.push(Box::new(limit));
    param_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), map_bookmark_row)
        .map_err(|e| e.to_string())?;

    let mut bookmarks = Vec::new();
    for b in rows {
        bookmarks.push(b.map_err(|e| e.to_string())?);
    }

    if !bookmarks.is_empty() {
        let b_ids: Vec<String> = bookmarks.iter().map(|b| b.id.clone()).collect();
        let placeholders = b_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let id_refs: Vec<&dyn rusqlite::ToSql> = b_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

        let map_query = format!(
            "SELECT bookmark_id, account_id FROM bookmark_account_mappings WHERE bookmark_id IN ({})",
            placeholders
        );
        if let Ok(mut m_stmt) = conn.prepare(&map_query) {
            if let Ok(m_rows) = m_stmt.query_map(id_refs.as_slice(), |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            }) {
                let mut id_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
                for r in m_rows.flatten() {
                    id_map.entry(r.0).or_default().push(r.1);
                }
                for b in &mut bookmarks {
                    if let Some(accs) = id_map.remove(&b.id) {
                        b.account_ids = accs;
                    }
                }
            }
        }

        let list_query = format!(
            "SELECT bookmark_id, list_id FROM bookmark_lists WHERE bookmark_id IN ({})",
            placeholders
        );
        if let Ok(mut l_stmt) = conn.prepare(&list_query) {
            if let Ok(l_rows) = l_stmt.query_map(id_refs.as_slice(), |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            }) {
                let mut l_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
                for r in l_rows.flatten() {
                    l_map.entry(r.0).or_default().push(r.1);
                }
                for b in &mut bookmarks {
                    if let Some(lists) = l_map.remove(&b.id) {
                        b.list_ids = lists;
                    }
                }
            }
        }
    }

    Ok(bookmarks)
}

#[tauri::command]
pub fn db_create_bookmark(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    url: String,
    title: String,
    folder_id: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Bookmark, String> {
    let raw_trimmed = url.trim();
    if raw_trimmed.is_empty() {
        return Err("URL cannot be empty.".to_string());
    }
    let clean_url = crate::url_cleaner::clean_url(raw_trimmed);
    let domain = crate::url_cleaner::extract_domain(&clean_url);
    let now = Utc::now().to_rfc3339();
    let tags_vec = tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&tags_vec).unwrap_or_else(|_| "[]".to_string());

    let conn = state.conn.lock().unwrap();

    // Check if active bookmark already exists in library
    let existing_active: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT id, folder_id FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 0 LIMIT 1",
            params![clean_url, raw_trimmed],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();

    if let Some((_, f_id)) = existing_active {
        let folder_name: String = match f_id {
            Some(fid) => conn
                .query_row("SELECT title FROM folders WHERE id = ?1", [fid], |r| r.get(0))
                .unwrap_or_else(|_| "Unknown Folder".to_string()),
            None => "Unorganized / Inbox".to_string(),
        };
        return Err(format!("This bookmark already exists in your library (in '{}').", folder_name));
    }

    let folder_path = folder_id.as_ref().and_then(|fid| get_folder_path(&conn, fid));

    let folder_is_hidden: bool = if let Some(ref fid) = folder_id {
        conn.query_row(
            "SELECT is_hidden FROM folders WHERE id = ?1",
            params![fid],
            |r| r.get::<_, i32>(0),
        )
        .unwrap_or(0) != 0
    } else {
        false
    };

    // Check if soft-deleted bookmark exists — un-delete and update!
    let existing_deleted_id: Option<String> = conn
        .query_row(
            "SELECT id FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 1 LIMIT 1",
            params![clean_url, raw_trimmed],
            |r| r.get(0),
        )
        .ok();

    if let Some(del_id) = existing_deleted_id {
        conn.execute(
            r#"
            UPDATE bookmarks
            SET is_deleted = 0, folder_id = ?1, title = ?2, tags = ?3, updated_at = ?4, is_hidden = ?5
            WHERE id = ?6
            "#,
            params![folder_id, title, tags_json, now, if folder_is_hidden { 1 } else { 0 }, del_id],
        )
        .map_err(|e| e.to_string())?;

        crate::ws_server::broadcast_desktop_mutation(
            &app,
            "DESKTOP_BOOKMARK_CREATED",
            serde_json::json!({
                "id": del_id,
                "url": raw_trimmed,
                "clean_url": clean_url,
                "title": title,
                "folder_id": folder_id,
                "folder_path": folder_path,
            }),
        );

        return Ok(Bookmark {
            id: del_id,
            folder_id,
            browser_guid: None,
            url: raw_trimmed.to_string(),
            clean_url,
            domain,
            title,
            description: None,
            user_notes: None,
            cover_image_url: None,
            reminder_at: None,
            expires_at: None,
            scraped_title: None,
            scraped_summary: None,
            favicon_url: None,
            link_status: "UNCHECKED".to_string(),
            http_code: None,
            wayback_url: None,
            is_pinned: false,
            is_favorite: false,
            tags: tags_vec,
            created_at: now.clone(),
            updated_at: now,
            is_deleted: false,
            is_hidden: folder_is_hidden,
            account_ids: Vec::new(),
            list_ids: Vec::new(),
        });
    }

    let id = Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO bookmarks (
            id, folder_id, url, clean_url, domain, title,
            link_status, is_pinned, is_favorite, tags, created_at, updated_at, is_deleted, is_hidden
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'UNCHECKED', 0, 0, ?7, ?8, ?8, 0, ?9)
        "#,
        params![id, folder_id, raw_trimmed, clean_url, domain, title, tags_json, now, if folder_is_hidden { 1 } else { 0 }],
    )
    .map_err(|e| e.to_string())?;

    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_BOOKMARK_CREATED",
        serde_json::json!({
            "id": id,
            "url": raw_trimmed,
            "clean_url": clean_url,
            "title": title,
            "folder_id": folder_id,
            "folder_path": folder_path,
        }),
    );

    Ok(Bookmark {
        id,
        folder_id,
        browser_guid: None,
        url: raw_trimmed.to_string(),
        clean_url,
        domain,
        title,
        description: None,
        user_notes: None,
        cover_image_url: None,
        reminder_at: None,
        expires_at: None,
        scraped_title: None,
        scraped_summary: None,
        favicon_url: None,
        link_status: "UNCHECKED".to_string(),
        http_code: None,
        wayback_url: None,
        is_pinned: false,
        is_favorite: false,
        tags: tags_vec,
        created_at: now.clone(),
        updated_at: now,
        is_deleted: false,
        is_hidden: folder_is_hidden,
        account_ids: Vec::new(),
        list_ids: Vec::new(),
    })
}

#[tauri::command]
pub fn db_update_bookmark(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    id: String,
    title: String,
    url: String,
    folder_id: Option<String>,
    tags: Vec<String>,
    is_pinned: bool,
) -> Result<(), String> {
    let clean_url = crate::url_cleaner::clean_url(&url);
    let domain = crate::url_cleaner::extract_domain(&clean_url);
    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    let now = Utc::now().to_rfc3339();

    let conn = state.conn.lock().unwrap();

    let (browser_guid, folder_path) = {
        let b_guid: Option<String> = conn
            .query_row("SELECT browser_guid FROM bookmarks WHERE id = ?1", params![id], |r| r.get(0))
            .ok();
        let f_path = folder_id.as_ref().and_then(|fid| get_folder_path(&conn, fid));
        (b_guid, f_path)
    };

    let folder_is_hidden: i32 = if let Some(ref fid) = folder_id {
        conn.query_row(
            "SELECT is_hidden FROM folders WHERE id = ?1",
            params![fid],
            |r| r.get(0),
        )
        .unwrap_or(0)
    } else {
        0
    };

    if folder_is_hidden == 1 {
        conn.execute(
            r#"
            UPDATE bookmarks
            SET title = ?1, url = ?2, clean_url = ?3, domain = ?4, folder_id = ?5,
                tags = ?6, is_pinned = ?7, updated_at = ?8, is_hidden = 1
            WHERE id = ?9
            "#,
            params![
                title,
                url,
                clean_url,
                domain,
                folder_id,
                tags_json,
                if is_pinned { 1 } else { 0 },
                now,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            r#"
            UPDATE bookmarks
            SET title = ?1, url = ?2, clean_url = ?3, domain = ?4, folder_id = ?5,
                tags = ?6, is_pinned = ?7, updated_at = ?8
            WHERE id = ?9
            "#,
            params![
                title,
                url,
                clean_url,
                domain,
                folder_id,
                tags_json,
                if is_pinned { 1 } else { 0 },
                now,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_BOOKMARK_UPDATED",
        serde_json::json!({
            "id": id,
            "browser_guid": browser_guid,
            "url": url,
            "clean_url": clean_url,
            "title": title,
            "folder_id": folder_id,
            "folder_path": folder_path,
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn db_update_bookmark_extended(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    id: String,
    title: Option<String>,
    url: Option<String>,
    description: Option<String>,
    user_notes: Option<String>,
    cover_image_url: Option<String>,
    folder_id: Option<String>,
    tags: Option<Vec<String>>,
    is_pinned: Option<bool>,
    is_favorite: Option<bool>,
    reminder_at: Option<String>,
    expires_at: Option<String>,
) -> Result<Bookmark, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current = conn
        .query_row(
            &format!("SELECT {} FROM bookmarks WHERE id = ?1", BOOKMARK_SELECT_FIELDS),
            params![id],
            map_bookmark_row,
        )
        .map_err(|e| format!("Bookmark not found: {}", e))?;

    let new_title = title.unwrap_or(current.title);
    let new_url = url.unwrap_or(current.url);
    let clean_url = crate::url_cleaner::clean_url(&new_url);
    let domain = crate::url_cleaner::extract_domain(&clean_url);
    let new_desc = description;
    let new_notes = user_notes;
    let new_cover = cover_image_url;
    let new_folder = folder_id;
    let new_tags = tags.unwrap_or(current.tags);
    let new_pinned = is_pinned.unwrap_or(current.is_pinned);
    let new_fav = is_favorite.unwrap_or(current.is_favorite);
    let new_reminder = reminder_at;
    let new_expires = expires_at;
    let tags_json = serde_json::to_string(&new_tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        r#"
        UPDATE bookmarks
        SET title = ?1, url = ?2, clean_url = ?3, domain = ?4,
            description = ?5, user_notes = ?6, cover_image_url = ?7,
            folder_id = ?8, tags = ?9, is_pinned = ?10, is_favorite = ?11,
            reminder_at = ?12, expires_at = ?13, updated_at = ?14
        WHERE id = ?15
        "#,
        params![
            new_title,
            new_url,
            clean_url,
            domain,
            new_desc,
            new_notes,
            new_cover,
            new_folder,
            tags_json,
            if new_pinned { 1 } else { 0 },
            if new_fav { 1 } else { 0 },
            new_reminder,
            new_expires,
            now,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Clean up any existing reminder record for this bookmark
    let _ = conn.execute("DELETE FROM reminders WHERE bookmark_id = ?1", params![id]);

    if let Some(ref due) = new_reminder {
        let _ = conn.execute(
            r#"
            INSERT INTO reminders (id, bookmark_id, title, url, due_at, is_delivered, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)
            "#,
            params![
                Uuid::new_v4().to_string(),
                id,
                new_title,
                new_url,
                due,
                now,
            ],
        );
    }

    let mut updated = conn
        .query_row(
            &format!("SELECT {} FROM bookmarks WHERE id = ?1", BOOKMARK_SELECT_FIELDS),
            params![id],
            map_bookmark_row,
        )
        .map_err(|e| e.to_string())?;

    if let Ok(mut stmt) = conn.prepare("SELECT account_id FROM bookmark_account_mappings WHERE bookmark_id = ?1") {
        if let Ok(rows) = stmt.query_map(params![id], |r| r.get::<_, String>(0)) {
            updated.account_ids = rows.flatten().collect();
        }
    }

    if let Ok(mut stmt) = conn.prepare("SELECT list_id FROM bookmark_lists WHERE bookmark_id = ?1") {
        if let Ok(rows) = stmt.query_map(params![id], |r| r.get::<_, String>(0)) {
            updated.list_ids = rows.flatten().collect();
        }
    }

    let _ = app.emit("bookmark://updated", &updated);
    Ok(updated)
}

// ── Tag Management Commands ─────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_tags(state: tauri::State<DbState>) -> Result<Vec<Tag>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            r#"
            SELECT t.id, t.name, t.color, t.icon, t.created_at,
                   (SELECT COUNT(*) FROM bookmarks b WHERE b.is_deleted = 0 AND b.tags LIKE '%"' || t.name || '"%') as bookmark_count
            FROM tags t
            ORDER BY t.name ASC
            "#
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                created_at: row.get(4)?,
                bookmark_count: row.get(5).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for r in rows {
        tags.push(r.map_err(|e| e.to_string())?);
    }
    Ok(tags)
}

#[tauri::command]
pub fn db_create_tag(
    state: tauri::State<DbState>,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Tag, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO tags (id, name, color, icon, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, trimmed, color, icon, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Tag {
        id,
        name: trimmed,
        color,
        icon,
        created_at: now,
        bookmark_count: Some(0),
    })
}

#[tauri::command]
pub fn db_update_tag(
    state: tauri::State<DbState>,
    id: String,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Tag, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }
    let conn = state.conn.lock().unwrap();

    let old_name: String = conn
        .query_row("SELECT name FROM tags WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE tags SET name = ?1, color = ?2, icon = ?3 WHERE id = ?4",
        params![trimmed, color, icon, id],
    )
    .map_err(|e| e.to_string())?;

    if old_name != trimmed {
        let mut stmt = conn
            .prepare("SELECT id, tags FROM bookmarks WHERE tags LIKE ?1")
            .map_err(|e| e.to_string())?;
        let pattern = format!("%\"{}\"%", old_name);
        let rows = stmt
            .query_map(params![pattern], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut to_update = Vec::new();
        for r in rows {
            if let Ok((b_id, tags_json)) = r {
                let mut tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                let mut changed = false;
                for t in &mut tags {
                    if *t == old_name {
                        *t = trimmed.clone();
                        changed = true;
                    }
                }
                if changed {
                    to_update.push((b_id, serde_json::to_string(&tags).unwrap_or_default()));
                }
            }
        }
        for (b_id, updated_tags) in to_update {
            let _ = conn.execute(
                "UPDATE bookmarks SET tags = ?1 WHERE id = ?2",
                params![updated_tags, b_id],
            );
        }
    }

    Ok(Tag {
        id,
        name: trimmed,
        color,
        icon,
        created_at: Utc::now().to_rfc3339(),
        bookmark_count: None,
    })
}

#[tauri::command]
pub fn db_delete_tag(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let old_name: Result<String, _> = conn.query_row("SELECT name FROM tags WHERE id = ?1", params![id], |r| r.get(0));
    if let Ok(name) = old_name {
        let mut stmt = conn
            .prepare("SELECT id, tags FROM bookmarks WHERE tags LIKE ?1")
            .map_err(|e| e.to_string())?;
        let pattern = format!("%\"{}\"%", name);
        let rows = stmt
            .query_map(params![pattern], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut to_update = Vec::new();
        for r in rows {
            if let Ok((b_id, tags_json)) = r {
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                let filtered: Vec<String> = tags.into_iter().filter(|t| t != &name).collect();
                to_update.push((b_id, serde_json::to_string(&filtered).unwrap_or_default()));
            }
        }
        for (b_id, updated_tags) in to_update {
            let _ = conn.execute(
                "UPDATE bookmarks SET tags = ?1 WHERE id = ?2",
                params![updated_tags, b_id],
            );
        }
    }

    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Reminders & Expiration Commands ─────────────────────────────────────────

#[tauri::command]
pub fn db_get_due_reminders(state: tauri::State<DbState>) -> Result<Vec<ReminderItem>, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT r.id, r.bookmark_id, b.title, b.url, r.due_at, r.is_delivered,
                   r.delivered_at, r.dismissed_at, r.created_at
            FROM reminders r
            JOIN bookmarks b ON b.id = r.bookmark_id
            WHERE r.due_at <= ?1 AND r.dismissed_at IS NULL AND b.is_deleted = 0
            ORDER BY r.due_at ASC
            "#
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![now], |row| {
            Ok(ReminderItem {
                id: row.get(0)?,
                bookmark_id: row.get(1)?,
                title: row.get(2)?,
                url: row.get(3)?,
                due_at: row.get(4)?,
                is_delivered: row.get::<_, i32>(5)? != 0,
                delivered_at: row.get(6)?,
                dismissed_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn db_dismiss_reminder(state: tauri::State<DbState>, reminder_id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE reminders SET dismissed_at = ?1 WHERE id = ?2",
        params![now, reminder_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_check_expired_bookmarks(state: tauri::State<DbState>) -> Result<usize, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    // 1. Soft-delete bookmarks that have passed expires_at
    let count = conn.execute(
        "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE expires_at IS NOT NULL AND expires_at <= ?1 AND is_deleted = 0",
        params![now],
    ).unwrap_or(0);

    // 2. Permanently purge bookmarks that have been in Trash (is_deleted = 1) for > 7 days
    let seven_days_ago = (Utc::now() - chrono::Duration::days(7)).to_rfc3339();
    let _ = conn.execute(
        "DELETE FROM bookmarks WHERE is_deleted = 1 AND updated_at <= ?1",
        params![seven_days_ago],
    );

    Ok(count)
}

// ── Cover Image Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn db_save_cover_image(
    state: tauri::State<DbState>,
    bookmark_id: String,
    image_data: String,
) -> Result<String, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE bookmarks SET cover_image_url = ?1, updated_at = ?2 WHERE id = ?3",
        params![image_data, now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(image_data)
}

#[tauri::command]
pub fn db_move_bookmark(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    bookmark_id: String,
    target_folder_id: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let (browser_guid, clean_url, target_folder_path) = {
        let row: Result<(Option<String>, String), _> = conn.query_row(
            "SELECT browser_guid, clean_url FROM bookmarks WHERE id = ?1",
            params![bookmark_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        );
        let (b_guid, c_url) = row.unwrap_or((None, String::new()));
        let f_path = target_folder_id.as_ref().and_then(|fid| get_folder_path(&conn, fid));
        (b_guid, c_url, f_path)
    };

    let folder_is_hidden: i32 = if let Some(ref fid) = target_folder_id {
        conn.query_row(
            "SELECT is_hidden FROM folders WHERE id = ?1",
            params![fid],
            |r| r.get(0),
        )
        .unwrap_or(0)
    } else {
        0
    };

    if folder_is_hidden == 1 {
        conn.execute(
            "UPDATE bookmarks SET folder_id = ?1, is_hidden = 1, updated_at = ?2 WHERE id = ?3",
            params![target_folder_id, now, bookmark_id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE bookmarks SET folder_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![target_folder_id, now, bookmark_id],
        )
        .map_err(|e| e.to_string())?;
    }

    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_BOOKMARK_MOVED",
        serde_json::json!({
            "id": bookmark_id,
            "browser_guid": browser_guid,
            "clean_url": clean_url,
            "target_folder_id": target_folder_id,
            "target_folder_path": target_folder_path,
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn db_delete_bookmark(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let (browser_guid, clean_url): (Option<String>, String) = conn
        .query_row(
            "SELECT browser_guid, clean_url FROM bookmarks WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((None, String::new()));

    conn.execute(
        "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    crate::ws_server::broadcast_desktop_mutation(
        &app,
        "DESKTOP_BOOKMARK_DELETED",
        serde_json::json!({
            "id": id,
            "browser_guid": browser_guid,
            "clean_url": clean_url,
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn db_toggle_bookmark_pin(state: tauri::State<DbState>, id: String) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current: i32 = conn
        .query_row("SELECT is_pinned FROM bookmarks WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let new_pin = if current == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE bookmarks SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_pin, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_pin != 0)
}

#[tauri::command]
pub fn db_toggle_bookmark_hidden(
    state: tauri::State<DbState>,
    id: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current: i32 = conn
        .query_row("SELECT is_hidden FROM bookmarks WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let new_val = if current == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE bookmarks SET is_hidden = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_val, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_val != 0)
}

// ── Lists & Favoriting Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn db_toggle_bookmark_favorite(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    bookmark_id: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let current: i32 = conn
        .query_row("SELECT is_favorite FROM bookmarks WHERE id = ?1", params![bookmark_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let new_fav = if current == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE bookmarks SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_fav, now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(mut updated) = conn.query_row(
        &format!("SELECT {} FROM bookmarks WHERE id = ?1", BOOKMARK_SELECT_FIELDS),
        params![bookmark_id],
        map_bookmark_row,
    ) {
        if let Ok(mut stmt) = conn.prepare("SELECT account_id FROM bookmark_account_mappings WHERE bookmark_id = ?1") {
            if let Ok(rows) = stmt.query_map(params![bookmark_id], |r| r.get::<_, String>(0)) {
                updated.account_ids = rows.flatten().collect();
            }
        }
        if let Ok(mut stmt) = conn.prepare("SELECT list_id FROM bookmark_lists WHERE bookmark_id = ?1") {
            if let Ok(rows) = stmt.query_map(params![bookmark_id], |r| r.get::<_, String>(0)) {
                updated.list_ids = rows.flatten().collect();
            }
        }
        let _ = app.emit("bookmark://updated", &updated);
    }

    Ok(new_fav != 0)
}

#[tauri::command]
pub fn db_get_lists(state: tauri::State<DbState>) -> Result<Vec<CustomList>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            r#"
            SELECT l.id, l.name, l.description, l.color, l.icon, l.position, l.created_at, l.updated_at,
                   COUNT(bl.bookmark_id) as bookmark_count
            FROM lists l
            LEFT JOIN bookmark_lists bl ON bl.list_id = l.id
            LEFT JOIN bookmarks b ON b.id = bl.bookmark_id AND b.is_deleted = 0
            GROUP BY l.id
            ORDER BY l.position ASC, l.name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(CustomList {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                color: r.get(3)?,
                icon: r.get(4)?,
                position: r.get(5)?,
                created_at: r.get(6)?,
                updated_at: r.get(7)?,
                bookmark_count: Some(r.get(8)?),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn db_create_list(
    state: tauri::State<DbState>,
    name: String,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<CustomList, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("List name cannot be empty".to_string());
    }
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let max_pos: i64 = conn
        .query_row("SELECT COALESCE(MAX(position), 0) FROM lists", [], |r| r.get(0))
        .unwrap_or(0);

    conn.execute(
        r#"
        INSERT INTO lists (id, name, description, color, icon, position, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
        "#,
        params![id, trimmed, description, color, icon, max_pos + 1, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(CustomList {
        id,
        name: trimmed,
        description,
        color,
        icon,
        position: max_pos + 1,
        created_at: now.clone(),
        updated_at: now,
        bookmark_count: Some(0),
    })
}

#[tauri::command]
pub fn db_update_list(
    state: tauri::State<DbState>,
    id: String,
    name: String,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<CustomList, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("List name cannot be empty".to_string());
    }
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"
        UPDATE lists
        SET name = ?1, description = ?2, color = ?3, icon = ?4, updated_at = ?5
        WHERE id = ?6
        "#,
        params![trimmed, description, color, icon, now, id],
    )
    .map_err(|e| e.to_string())?;

    let list = conn
        .query_row(
            r#"
            SELECT l.id, l.name, l.description, l.color, l.icon, l.position, l.created_at, l.updated_at,
                   (SELECT COUNT(*) FROM bookmark_lists bl JOIN bookmarks b ON b.id = bl.bookmark_id WHERE bl.list_id = l.id AND b.is_deleted = 0) as bookmark_count
            FROM lists l
            WHERE l.id = ?1
            "#,
            params![id],
            |r| {
                Ok(CustomList {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    description: r.get(2)?,
                    color: r.get(3)?,
                    icon: r.get(4)?,
                    position: r.get(5)?,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                    bookmark_count: Some(r.get(8)?),
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(list)
}

#[tauri::command]
pub fn db_delete_list(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM bookmark_lists WHERE list_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM lists WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_add_bookmark_to_list(
    state: tauri::State<DbState>,
    bookmark_id: String,
    list_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        r#"
        INSERT OR IGNORE INTO bookmark_lists (bookmark_id, list_id, position, added_at)
        VALUES (?1, ?2, 0, ?3)
        "#,
        params![bookmark_id, list_id, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_remove_bookmark_from_list(
    state: tauri::State<DbState>,
    bookmark_id: String,
    list_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM bookmark_lists WHERE bookmark_id = ?1 AND list_id = ?2",
        params![bookmark_id, list_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_bookmark_lists(
    state: tauri::State<DbState>,
    bookmark_id: String,
) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT list_id FROM bookmark_lists WHERE bookmark_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![bookmark_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut lists = Vec::new();
    for r in rows {
        if let Ok(lid) = r {
            lists.push(lid);
        }
    }
    Ok(lists)
}

#[tauri::command]
pub fn db_empty_trash(state: tauri::State<DbState>) -> Result<usize, String> {
    let conn = state.conn.lock().unwrap();
    let count = conn
        .execute("DELETE FROM bookmarks WHERE is_deleted = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn db_restore_bookmark(
    state: tauri::State<DbState>,
    bookmark_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE bookmarks SET is_deleted = 0, expires_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_purge_bookmark(
    state: tauri::State<DbState>,
    bookmark_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![bookmark_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_smart_list_counts(state: tauri::State<DbState>) -> Result<SmartListCounts, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let favorites: i64 = conn
        .query_row("SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 0 AND is_favorite = 1", [], |r| r.get(0))
        .unwrap_or(0);

    let trash: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 1 OR (expires_at IS NOT NULL AND expires_at <= ?1)",
            params![now],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let reminders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 0 AND reminder_at IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(SmartListCounts {
        favorites,
        trash,
        reminders,
    })
}

// ── Duplicates & Stats ──────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_duplicates(
    state: tauri::State<DbState>,
    folder_id: Option<String>,
) -> Result<Vec<DuplicateGroup>, String> {
    let conn = state.conn.lock().unwrap();

    let duplicate_urls: Vec<(String, String, i64)> = if let Some(fid) = folder_id {
        let mut stmt = conn
            .prepare(
                r#"
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE id = ?1
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT clean_url, domain, COUNT(*) as count
                FROM bookmarks
                WHERE is_deleted = 0
                  AND folder_id IN (SELECT id FROM subfolders)
                GROUP BY clean_url
                HAVING count > 1
                ORDER BY count DESC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![fid], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item.map_err(|e| e.to_string())?);
        }
        list
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT clean_url, domain, COUNT(*) as count
                FROM bookmarks
                WHERE is_deleted = 0
                GROUP BY clean_url
                HAVING count > 1
                ORDER BY count DESC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item.map_err(|e| e.to_string())?);
        }
        list
    };

    let mut groups = Vec::new();
    for (clean_url, domain, count) in duplicate_urls {
        let mut b_stmt = conn
            .prepare(&format!(
                r#"
                SELECT {}
                FROM bookmarks
                WHERE clean_url = ?1 AND is_deleted = 0
                ORDER BY created_at ASC
                "#,
                BOOKMARK_SELECT_FIELDS
            ))
            .map_err(|e| e.to_string())?;

        let bookmarks = b_stmt
            .query_map(params![clean_url], map_bookmark_row)
            .map_err(|e| e.to_string())?;

        let mut b_list = Vec::new();
        for b in bookmarks {
            b_list.push(b.map_err(|e| e.to_string())?);
        }

        groups.push(DuplicateGroup {
            clean_url,
            domain,
            count,
            bookmarks: b_list,
        });
    }

    Ok(groups)
}

#[tauri::command]
pub fn db_merge_duplicates(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    keep_id: String,
    remove_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    for id in remove_ids {
        if id != keep_id {
            let (browser_guid, clean_url): (Option<String>, String) = conn
                .query_row(
                    "SELECT browser_guid, clean_url FROM bookmarks WHERE id = ?1",
                    params![id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .unwrap_or((None, String::new()));

            conn.execute(
                "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
                params![now, id],
            )
            .map_err(|e| e.to_string())?;

            crate::ws_server::broadcast_desktop_mutation(
                &app,
                "DESKTOP_BOOKMARK_DELETED",
                serde_json::json!({
                    "id": id,
                    "browser_guid": browser_guid,
                    "clean_url": clean_url,
                }),
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub fn db_delete_dead_links(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    folder_id: Option<String>,
) -> Result<usize, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let dead_links: Vec<(String, Option<String>, String)> = if let Some(fid) = folder_id {
        let mut stmt = conn
            .prepare(
                r#"
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE id = ?1
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT id, browser_guid, clean_url
                FROM bookmarks
                WHERE is_deleted = 0
                  AND link_status IN ('DEAD', 'TIMEOUT')
                  AND folder_id IN (SELECT id FROM subfolders)
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![fid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r.map_err(|e| e.to_string())?);
        }
        list
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, browser_guid, clean_url
                FROM bookmarks
                WHERE is_deleted = 0
                  AND link_status IN ('DEAD', 'TIMEOUT')
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r.map_err(|e| e.to_string())?);
        }
        list
    };

    let count = dead_links.len();

    for (id, browser_guid, clean_url) in dead_links {
        let _ = conn.execute(
            "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        );

        crate::ws_server::broadcast_desktop_mutation(
            &app,
            "DESKTOP_BOOKMARK_DELETED",
            serde_json::json!({
                "id": id,
                "browser_guid": browser_guid,
                "clean_url": clean_url,
            }),
        );
    }

    Ok(count)
}

#[tauri::command]
pub fn db_get_dead_links(
    state: tauri::State<DbState>,
    folder_id: Option<String>,
) -> Result<Vec<Bookmark>, String> {
    let conn = state.conn.lock().unwrap();

    let (query, has_param) = if folder_id.is_some() {
        (
            format!(
                r#"
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE id = ?1
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT {}
                FROM bookmarks
                WHERE is_deleted = 0
                  AND link_status IN ('DEAD', 'TIMEOUT')
                  AND folder_id IN (SELECT id FROM subfolders)
                ORDER BY created_at DESC
                "#,
                BOOKMARK_SELECT_FIELDS
            ),
            true,
        )
    } else {
        (
            format!(
                r#"
                SELECT {}
                FROM bookmarks
                WHERE is_deleted = 0
                  AND link_status IN ('DEAD', 'TIMEOUT')
                ORDER BY created_at DESC
                "#,
                BOOKMARK_SELECT_FIELDS
            ),
            false,
        )
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let rows: Vec<Bookmark> = if has_param {
        let fid = folder_id.unwrap();
        let mapped = stmt.query_map(params![fid], map_bookmark_row).map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in mapped {
            list.push(r.map_err(|e| e.to_string())?);
        }
        list
    } else {
        let mapped = stmt.query_map([], map_bookmark_row).map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for r in mapped {
            list.push(r.map_err(|e| e.to_string())?);
        }
        list
    };

    Ok(rows)
}

#[tauri::command]
pub fn db_delete_bookmarks_batch(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    ids: Vec<String>,
) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }

    let mut conn = state.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let mut deleted_info: Vec<(Option<String>, String)> = Vec::new();

    {
        for id in &ids {
            let mut stmt = tx
                .prepare("SELECT browser_guid, clean_url FROM bookmarks WHERE id = ?1 AND is_deleted = 0")
                .map_err(|e| e.to_string())?;
            if let Ok(info) = stmt.query_row(params![id], |r| Ok((r.get(0)?, r.get(1)?))) {
                deleted_info.push(info);
            }

            tx.execute(
                "UPDATE bookmarks SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
                params![now, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Broadcast deletions to connected browsers via WebSocket bridge
    for (b_guid, clean_url) in deleted_info {
        crate::ws_server::broadcast_desktop_mutation(
            &app,
            "DESKTOP_BOOKMARK_DELETED",
            serde_json::json!({
                "browserGuid": b_guid,
                "cleanUrl": clean_url,
            }),
        );
    }

    Ok(ids.len())
}

#[tauri::command]
pub fn db_get_library_stats(state: tauri::State<DbState>) -> Result<LibraryStats, String> {
    let conn = state.conn.lock().unwrap();

    let total_bookmarks: i64 = conn
        .query_row("SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 0", [], |r| r.get(0))
        .unwrap_or(0);

    let unorganized_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE folder_id IS NULL AND is_deleted = 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let dead_links_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE link_status IN ('DEAD', 'TIMEOUT') AND is_deleted = 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let duplicate_count: i64 = conn
        .query_row(
            r#"
            SELECT COALESCE(SUM(c - 1), 0) FROM (
                SELECT COUNT(*) as c FROM bookmarks WHERE is_deleted = 0 GROUP BY clean_url HAVING c > 1
            )
            "#,
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let folder_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM folders WHERE is_deleted = 0", [], |r| r.get(0))
        .unwrap_or(0);

    let scraped_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE scraped_summary IS NOT NULL AND is_deleted = 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(LibraryStats {
        total_bookmarks,
        unorganized_count,
        dead_links_count,
        duplicate_count,
        folder_count,
        scraped_count,
    })
}

#[tauri::command]
pub fn db_reset_library(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute_batch(
        r#"
        DELETE FROM bookmark_embeddings;
        DELETE FROM sync_queue;
        DELETE FROM staged_sync_mutations;
        DELETE FROM bookmark_account_mappings;
        DELETE FROM bookmark_lists;
        DELETE FROM reminders;
        DELETE FROM tags;
        DELETE FROM lists;
        DELETE FROM ai_chat_messages;
        DELETE FROM ai_chat_sessions;
        DELETE FROM bookmarks;
        DELETE FROM folders;
        DELETE FROM browser_accounts;
        "#
    ).map_err(|e| e.to_string())?;

    let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
    Ok(())
}

#[tauri::command]
pub fn db_delete_all_bookmarks(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute_batch(
        r#"
        DELETE FROM bookmark_embeddings;
        DELETE FROM sync_queue;
        DELETE FROM staged_sync_mutations;
        DELETE FROM bookmark_account_mappings;
        DELETE FROM bookmark_lists;
        DELETE FROM reminders;
        DELETE FROM bookmarks;
        "#
    ).map_err(|e| e.to_string())?;

    let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
    Ok(())
}

#[tauri::command]
pub fn db_delete_all_folders(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("UPDATE bookmarks SET folder_id = NULL", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM folders", [])
        .map_err(|e| e.to_string())?;
    let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
    Ok(())
}

#[tauri::command]
pub fn db_delete_empty_folders(state: tauri::State<DbState>) -> Result<usize, String> {
    let conn = state.conn.lock().unwrap();
    let mut total_deleted = 0;
    loop {
        let deleted = conn.execute(
            "DELETE FROM folders WHERE id NOT IN (SELECT DISTINCT folder_id FROM bookmarks WHERE folder_id IS NOT NULL) AND id NOT IN (SELECT DISTINCT parent_id FROM folders WHERE parent_id IS NOT NULL)",
            [],
        ).map_err(|e| e.to_string())?;
        if deleted == 0 {
            break;
        }
        total_deleted += deleted;
    }
    Ok(total_deleted)
}

#[tauri::command]
pub fn db_mark_bookmark_live(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    bookmark_id: String,
) -> Result<Bookmark, String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.conn.lock().unwrap();

    conn.execute(
        r#"
        UPDATE bookmarks
        SET link_status = 'LIVE',
            http_code = 200,
            updated_at = ?1
        WHERE id = ?2
        "#,
        params![now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;

    let updated_bookmark = conn
        .query_row(
            &format!(
                r#"
                SELECT {}
                FROM bookmarks
                WHERE id = ?1
                "#,
                BOOKMARK_SELECT_FIELDS
            ),
            params![bookmark_id],
            map_bookmark_row,
        )
        .map_err(|e| e.to_string())?;

    let _ = app.emit("bookmark://updated", &updated_bookmark);
    Ok(updated_bookmark)
}

#[tauri::command]
pub fn db_set_bookmark_status(
    app: tauri::AppHandle,
    state: tauri::State<DbState>,
    bookmark_id: String,
    status: String,
    http_code: Option<i32>,
) -> Result<Bookmark, String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.conn.lock().unwrap();

    let code = http_code.unwrap_or_else(|| {
        if status == "LIVE" {
            200
        } else if status == "DEAD" {
            404
        } else {
            0
        }
    });

    conn.execute(
        r#"
        UPDATE bookmarks
        SET link_status = ?1,
            http_code = ?2,
            updated_at = ?3
        WHERE id = ?4
        "#,
        params![status, code, now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;

    let mut updated_bookmark = conn
        .query_row(
            &format!(
                r#"
                SELECT {}
                FROM bookmarks
                WHERE id = ?1
                "#,
                BOOKMARK_SELECT_FIELDS
            ),
            params![bookmark_id],
            map_bookmark_row,
        )
        .map_err(|e| e.to_string())?;

    if let Ok(mut stmt) = conn.prepare("SELECT account_id FROM bookmark_account_mappings WHERE bookmark_id = ?1") {
        if let Ok(rows) = stmt.query_map(params![bookmark_id], |r| r.get::<_, String>(0)) {
            updated_bookmark.account_ids = rows.filter_map(|r| r.ok()).collect();
        }
    }
    if let Ok(mut stmt) = conn.prepare("SELECT list_id FROM bookmark_lists WHERE bookmark_id = ?1") {
        if let Ok(rows) = stmt.query_map(params![bookmark_id], |r| r.get::<_, String>(0)) {
            updated_bookmark.list_ids = rows.filter_map(|r| r.ok()).collect();
        }
    }

    let _ = app.emit("bookmark://updated", &updated_bookmark);
    Ok(updated_bookmark)
}

pub fn auto_heal_accounts(conn: &rusqlite::Connection) {
    // 1. Auto-heal Zen accounts:
    // If a Zen account has 0 mappings, map all active bookmarks in library to it
    let _ = conn.execute_batch(
        r#"
        INSERT OR IGNORE INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at)
        SELECT lower(hex(randomblob(16))), b.id, a.id, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP
        FROM browser_accounts a
        CROSS JOIN bookmarks b
        WHERE a.browser_type = 'zen' AND b.is_deleted = 0
        AND NOT EXISTS (
            SELECT 1 FROM bookmark_account_mappings m WHERE m.account_id = a.id
        );
        "#
    );

    // 2. Auto-heal Chromium accounts (Chrome, Edge, Brave):
    // Check if any Chromium account has 0 mappings or is pointing to an outdated bookmarks file
    if let Ok(mut stmt) = conn.prepare(
        "SELECT id, browser_type, profile_folder_name, bookmarks_file_path FROM browser_accounts WHERE browser_type IN ('chrome', 'edge', 'brave')"
    ) {
        let accounts: Vec<(String, String, String, Option<String>)> = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            })
            .map(|rows| rows.flatten().collect())
            .unwrap_or_default();

        for (acc_id, b_type, profile_folder, _) in accounts {
            let count: usize = conn
                .query_row(
                    "SELECT COUNT(*) FROM bookmark_account_mappings WHERE account_id = ?1",
                    [&acc_id],
                    |r| r.get(0),
                )
                .unwrap_or(0);

            if count == 0 {
                if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                    let user_data_path = match b_type.as_str() {
                        "chrome" => std::path::PathBuf::from(&local_app_data).join("Google").join("Chrome").join("User Data"),
                        "edge" => std::path::PathBuf::from(&local_app_data).join("Microsoft").join("Edge").join("User Data"),
                        "brave" => std::path::PathBuf::from(&local_app_data).join("BraveSoftware").join("Brave-Browser").join("User Data"),
                        _ => std::path::PathBuf::new(),
                    };

                    let profile_dir = user_data_path.join(&profile_folder);
                    if let Some(resolved_bm) = crate::browser_importer::resolve_chromium_bookmarks_path(&profile_dir) {
                        let path_str = resolved_bm.to_string_lossy().to_string();
                        let _ = conn.execute(
                            "UPDATE browser_accounts SET bookmarks_file_path = ?1 WHERE id = ?2",
                            rusqlite::params![path_str, acc_id],
                        );

                        let mut paths_to_import = vec![resolved_bm.clone()];
                        if let Some(parent) = resolved_bm.parent() {
                            let companion = if resolved_bm.file_name().and_then(|n| n.to_str()) == Some("Bookmarks") {
                                parent.join("AccountBookmarks")
                            } else {
                                parent.join("Bookmarks")
                            };
                            if companion.exists() && companion != resolved_bm {
                                if let Ok(meta) = std::fs::metadata(&companion) {
                                    if meta.len() > 1200 {
                                        paths_to_import.push(companion);
                                    }
                                }
                            }
                        }

                        let now = chrono::Utc::now().to_rfc3339();
                        for p in paths_to_import {
                            if let Ok(content) = std::fs::read_to_string(&p) {
                                if let Ok(parsed) = serde_json::from_str::<crate::browser_importer::ChromiumBookmarksRoot>(&content) {
                                    let mut stats = crate::html_parser::ImportResult {
                                        total_bookmarks_imported: 0,
                                        total_folders_created: 0,
                                        total_bookmarks_skipped: 0,
                                    };
                                    if let Some(roots) = parsed.roots {
                                        if let Some(bar) = roots.bookmark_bar {
                                            if let Some(children) = bar.children {
                                                crate::browser_importer::import_and_link_chromium_items(
                                                    conn, &children, None, &acc_id, &mut stats, &now,
                                                ).ok();
                                            }
                                        }
                                        if let Some(other) = roots.other {
                                            if let Some(children) = other.children {
                                                crate::browser_importer::import_and_link_chromium_items(
                                                    conn, &children, None, &acc_id, &mut stats, &now,
                                                ).ok();
                                            }
                                        }
                                        if let Some(synced) = roots.synced {
                                            if let Some(children) = synced.children {
                                                crate::browser_importer::import_and_link_chromium_items(
                                                    conn, &children, None, &acc_id, &mut stats, &now,
                                                ).ok();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Browser Accounts & Multi-Origin Profile Commands ─────────────────────────

#[tauri::command]
pub fn db_get_accounts(state: tauri::State<DbState>) -> Result<Vec<BrowserAccount>, String> {
    let conn = state.conn.lock().unwrap();
    auto_heal_accounts(&conn);
    let mut stmt = conn
        .prepare(
            r#"
            SELECT a.id, a.browser_type, a.profile_folder_name, a.display_name, a.user_email,
                   a.color_dot, a.icon_name, a.bookmarks_file_path, a.is_active, a.sync_mode,
                   a.last_synced_at, a.created_at,
                   (SELECT COUNT(*) FROM bookmark_account_mappings WHERE account_id = a.id) as count
            FROM browser_accounts a
            ORDER BY a.created_at ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BrowserAccount {
                id: row.get(0)?,
                browser_type: row.get(1)?,
                profile_folder_name: row.get(2)?,
                display_name: row.get(3)?,
                user_email: row.get(4)?,
                color_dot: row.get(5)?,
                icon_name: row.get(6)?,
                bookmarks_file_path: row.get(7)?,
                is_active: row.get::<_, i32>(8)? != 0,
                sync_mode: row.get(9)?,
                last_synced_at: row.get(10)?,
                created_at: row.get(11)?,
                bookmark_count: Some(row.get(12)?),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut accounts = Vec::new();
    for a in rows {
        accounts.push(a.map_err(|e| e.to_string())?);
    }
    Ok(accounts)
}

#[tauri::command]
pub fn db_upsert_account(
    state: tauri::State<DbState>,
    id: Option<String>,
    browser_type: String,
    profile_folder_name: String,
    display_name: String,
    user_email: Option<String>,
    color_dot: String,
    icon_name: String,
    bookmarks_file_path: Option<String>,
    sync_mode: Option<String>,
) -> Result<BrowserAccount, String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.conn.lock().unwrap();
    let acc_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let s_mode = sync_mode.unwrap_or_else(|| "live".to_string());

    conn.execute(
        r#"
        INSERT INTO browser_accounts (
            id, browser_type, profile_folder_name, display_name, user_email,
            color_dot, icon_name, bookmarks_file_path, is_active, sync_mode, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            color_dot = excluded.color_dot,
            sync_mode = excluded.sync_mode,
            bookmarks_file_path = COALESCE(excluded.bookmarks_file_path, browser_accounts.bookmarks_file_path),
            user_email = COALESCE(excluded.user_email, browser_accounts.user_email)
        "#,
        params![
            acc_id,
            browser_type,
            profile_folder_name,
            display_name,
            user_email,
            color_dot,
            icon_name,
            bookmarks_file_path,
            s_mode,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(BrowserAccount {
        id: acc_id,
        browser_type,
        profile_folder_name,
        display_name,
        user_email,
        color_dot,
        icon_name,
        bookmarks_file_path,
        is_active: true,
        sync_mode: s_mode,
        last_synced_at: None,
        created_at: now,
        bookmark_count: Some(0),
    })
}

#[tauri::command]
pub fn db_delete_account(
    state: tauri::State<DbState>,
    account_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM bookmark_account_mappings WHERE account_id = ?1", params![account_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM staged_sync_mutations WHERE account_id = ?1", params![account_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM browser_accounts WHERE id = ?1", params![account_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_assign_bookmark_to_account(
    state: tauri::State<DbState>,
    bookmark_id: String,
    account_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    let mapping_id = Uuid::new_v4().to_string();

    conn.execute(
        r#"
        INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at)
        VALUES (?1, ?2, ?3, ?4, 0, ?4)
        ON CONFLICT(bookmark_id, account_id) DO NOTHING
        "#,
        params![mapping_id, bookmark_id, account_id, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_remove_bookmark_from_account(
    state: tauri::State<DbState>,
    bookmark_id: String,
    account_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM bookmark_account_mappings WHERE bookmark_id = ?1 AND account_id = ?2",
        params![bookmark_id, account_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_transfer_bookmark_account(
    state: tauri::State<DbState>,
    bookmark_id: String,
    from_account_id: String,
    to_account_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    let mapping_id = Uuid::new_v4().to_string();

    conn.execute(
        "DELETE FROM bookmark_account_mappings WHERE bookmark_id = ?1 AND account_id = ?2",
        params![bookmark_id, from_account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at)
        VALUES (?1, ?2, ?3, ?4, 0, ?4)
        ON CONFLICT(bookmark_id, account_id) DO NOTHING
        "#,
        params![mapping_id, bookmark_id, to_account_id, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_batch_assign_accounts(
    state: tauri::State<DbState>,
    bookmark_ids: Vec<String>,
    account_id: String,
    is_move: bool,
    from_account_id: Option<String>,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let mut count = 0;

    for b_id in bookmark_ids {
        if is_move {
            if let Some(ref from_id) = from_account_id {
                tx.execute(
                    "DELETE FROM bookmark_account_mappings WHERE bookmark_id = ?1 AND account_id = ?2",
                    params![b_id, from_id],
                ).ok();
            }
        }
        let m_id = Uuid::new_v4().to_string();
        let affected = tx.execute(
            r#"
            INSERT INTO bookmark_account_mappings (id, bookmark_id, account_id, synced_at, is_dirty, created_at)
            VALUES (?1, ?2, ?3, ?4, 0, ?4)
            ON CONFLICT(bookmark_id, account_id) DO NOTHING
            "#,
            params![m_id, b_id, account_id, now],
        ).unwrap_or(0);
        if affected > 0 {
            count += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

fn map_staged_row(row: &rusqlite::Row) -> rusqlite::Result<StagedSyncMutation> {
    Ok(StagedSyncMutation {
        id: row.get(0)?,
        account_id: row.get(1)?,
        account_name: row.get(2)?,
        action_type: row.get(3)?,
        bookmark_id: row.get(4)?,
        bookmark_title: row.get(5)?,
        bookmark_url: row.get(6)?,
        payload_json: row.get(7)?,
        created_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn db_get_staged_mutations(
    state: tauri::State<DbState>,
    account_id: Option<String>,
) -> Result<Vec<StagedSyncMutation>, String> {
    let conn = state.conn.lock().unwrap();
    let base_query = r#"
        SELECT m.id, m.account_id, a.display_name, m.action_type, m.bookmark_id,
               b.title, b.url, m.payload_json, m.created_at
        FROM staged_sync_mutations m
        LEFT JOIN browser_accounts a ON a.id = m.account_id
        LEFT JOIN bookmarks b ON b.id = m.bookmark_id
    "#;

    let (query, has_param) = match account_id {
        Some(ref aid) if !aid.is_empty() => (format!("{} WHERE m.account_id = ?1 ORDER BY m.created_at ASC", base_query), true),
        _ => (format!("{} ORDER BY m.created_at ASC", base_query), false),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = if has_param {
        let aid = account_id.unwrap();
        stmt.query_map(params![aid], map_staged_row).map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], map_staged_row).map_err(|e| e.to_string())?
    };

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn db_clear_staged_mutations(
    state: tauri::State<DbState>,
    account_id: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    if let Some(aid) = account_id {
        conn.execute("DELETE FROM staged_sync_mutations WHERE account_id = ?1", params![aid])
            .map_err(|e| e.to_string())?;
    } else {
        conn.execute("DELETE FROM staged_sync_mutations", [])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── AI Chat Session & History Commands ──────────────────────────────────────

#[tauri::command]
pub fn db_get_ai_chat_sessions(state: tauri::State<DbState>) -> Result<Vec<AIChatSession>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        r#"
        SELECT s.id, s.title, s.scope_folder_id, s.created_at, s.updated_at,
               (SELECT COUNT(*) FROM ai_chat_messages m WHERE m.session_id = s.id) as message_count
        FROM ai_chat_sessions s
        ORDER BY s.updated_at DESC
        "#
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(AIChatSession {
            id: row.get(0)?,
            title: row.get(1)?,
            scope_folder_id: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            message_count: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for r in rows {
        if let Ok(s) = r {
            sessions.push(s);
        }
    }
    Ok(sessions)
}

#[tauri::command]
pub fn db_create_ai_chat_session(
    state: tauri::State<DbState>,
    id: Option<String>,
    title: String,
    scope_folder_id: Option<String>,
) -> Result<AIChatSession, String> {
    let conn = state.conn.lock().unwrap();
    let session_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO ai_chat_sessions (id, title, scope_folder_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![session_id, title, scope_folder_id, now],
    ).map_err(|e| e.to_string())?;

    Ok(AIChatSession {
        id: session_id,
        title,
        scope_folder_id,
        created_at: now.clone(),
        updated_at: now,
        message_count: Some(0),
    })
}

#[tauri::command]
pub fn db_rename_ai_chat_session(
    state: tauri::State<DbState>,
    session_id: String,
    new_title: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE ai_chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![new_title, now, session_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_ai_chat_session(
    state: tauri::State<DbState>,
    session_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM ai_chat_sessions WHERE id = ?1", rusqlite::params![session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_ai_chat_messages(
    state: tauri::State<DbState>,
    session_id: String,
) -> Result<Vec<AIChatMessageItem>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, cited_bookmarks_json, created_at FROM ai_chat_messages WHERE session_id = ?1 ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([session_id], |row| {
        Ok(AIChatMessageItem {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            cited_bookmarks_json: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    for r in rows {
        if let Ok(m) = r {
            messages.push(m);
        }
    }
    Ok(messages)
}

#[tauri::command]
pub fn db_save_ai_chat_message(
    state: tauri::State<DbState>,
    session_id: String,
    role: String,
    content: String,
    cited_bookmarks_json: Option<String>,
) -> Result<AIChatMessageItem, String> {
    let conn = state.conn.lock().unwrap();
    let msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO ai_chat_messages (id, session_id, role, content, cited_bookmarks_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![msg_id, session_id, role, content, cited_bookmarks_json, now],
    ).map_err(|e| e.to_string())?;

    // Touch session updated_at
    let _ = conn.execute(
        "UPDATE ai_chat_sessions SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, session_id],
    );

    Ok(AIChatMessageItem {
        id: msg_id,
        session_id,
        role,
        content,
        cited_bookmarks_json,
        created_at: now,
    })
}

