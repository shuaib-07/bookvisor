use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedBookmark {
    pub url: String,
    pub title: String,
    pub add_date: Option<String>,
    pub icon: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedFolder {
    pub title: String,
    pub add_date: Option<String>,
    pub bookmarks: Vec<ParsedBookmark>,
    pub subfolders: Vec<ParsedFolder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub total_bookmarks_imported: usize,
    pub total_folders_created: usize,
    #[serde(default)]
    pub total_bookmarks_skipped: usize,
}

/// Parses standard Netscape Bookmark HTML format
pub fn parse_netscape_html(html: &str) -> Vec<ParsedFolder> {
    let mut root_folders = Vec::new();
    let mut folder_stack: Vec<ParsedFolder> = Vec::new();

    // Line-by-line / tag-based parsing
    for line in html.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Folder start: <DT><H3 ...>Folder Title</H3>
        if let Some(h3_start) = trimmed.find("<H3") {
            if let Some(h3_end) = trimmed[h3_start..].find('>') {
                let tag_content = &trimmed[h3_start + 3..h3_start + h3_end];
                let title_start = h3_start + h3_end + 1;
                let title_end = trimmed[title_start..].find("</H3>").unwrap_or(trimmed[title_start..].len());
                let title = unescape_html(&trimmed[title_start..title_start + title_end]);

                let add_date = extract_attr(tag_content, "ADD_DATE").and_then(|ts| parse_epoch_ts(&ts));

                folder_stack.push(ParsedFolder {
                    title: if title.trim().is_empty() { "Untitled Folder".to_string() } else { title.trim().to_string() },
                    add_date,
                    bookmarks: Vec::new(),
                    subfolders: Vec::new(),
                });
            }
        }
        // Bookmark item: <DT><A HREF="..." ...>Title</A>
        else if let Some(a_start) = trimmed.find("<A ") {
            if let Some(a_end) = trimmed[a_start..].find('>') {
                let tag_content = &trimmed[a_start + 2..a_start + a_end];
                let title_start = a_start + a_end + 1;
                let title_end = trimmed[title_start..].find("</A>").unwrap_or(trimmed[title_start..].len());
                let title = unescape_html(&trimmed[title_start..title_start + title_end]);

                if let Some(url) = extract_attr(tag_content, "HREF") {
                    let add_date = extract_attr(tag_content, "ADD_DATE").and_then(|ts| parse_epoch_ts(&ts));
                    let icon = extract_attr(tag_content, "ICON");
                    let tags = extract_attr(tag_content, "TAGS")
                        .map(|t| t.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
                        .unwrap_or_default();

                    let bookmark = ParsedBookmark {
                        url: unescape_html(&url),
                        title: if title.trim().is_empty() { url.clone() } else { title.trim().to_string() },
                        add_date,
                        icon,
                        tags,
                    };

                    if let Some(curr_folder) = folder_stack.last_mut() {
                        curr_folder.bookmarks.push(bookmark);
                    } else {
                        // Root bookmark, create a virtual Unorganized folder if needed
                        if root_folders.is_empty() {
                            root_folders.push(ParsedFolder {
                                title: "Imported Bookmarks".to_string(),
                                add_date: None,
                                bookmarks: Vec::new(),
                                subfolders: Vec::new(),
                            });
                        }
                        root_folders[0].bookmarks.push(bookmark);
                    }
                }
            }
        }
        // Folder closing: </DL>
        else if trimmed.contains("</DL>") || trimmed.contains("</dl>") {
            if let Some(closed_folder) = folder_stack.pop() {
                if let Some(parent) = folder_stack.last_mut() {
                    parent.subfolders.push(closed_folder);
                } else {
                    root_folders.push(closed_folder);
                }
            }
        }
    }

    // Flush remaining open folders in stack
    while let Some(closed) = folder_stack.pop() {
        if let Some(parent) = folder_stack.last_mut() {
            parent.subfolders.push(closed);
        } else {
            root_folders.push(closed);
        }
    }

    root_folders
}

fn extract_attr(tag_content: &str, attr_name: &str) -> Option<String> {
    let needle = format!("{}=\"", attr_name);
    if let Some(start) = tag_content.find(&needle) {
        let val_start = start + needle.len();
        if let Some(val_end) = tag_content[val_start..].find('"') {
            return Some(tag_content[val_start..val_start + val_end].to_string());
        }
    }
    // Try without quotes
    let needle_noq = format!("{}=", attr_name);
    if let Some(start) = tag_content.find(&needle_noq) {
        let val_start = start + needle_noq.len();
        let val_end = tag_content[val_start..]
            .find(|c: char| c.is_whitespace() || c == '>')
            .unwrap_or(tag_content[val_start..].len());
        return Some(tag_content[val_start..val_start + val_end].to_string());
    }
    None
}

fn parse_epoch_ts(ts_str: &str) -> Option<String> {
    if let Ok(secs) = ts_str.parse::<i64>() {
        if let Some(dt) = Utc.timestamp_opt(secs, 0).single() {
            return Some(dt.to_rfc3339());
        }
    }
    None
}

fn unescape_html(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Recursively writes folders and bookmarks into SQLite database with full deduplication
pub fn import_folders_to_db(
    conn: &rusqlite::Connection,
    folders: &[ParsedFolder],
    parent_folder_id: Option<String>,
    stats: &mut ImportResult,
) -> Result<(), rusqlite::Error> {
    let now = Utc::now().to_rfc3339();

    for f in folders {
        let trimmed_title = f.title.trim();
        if trimmed_title.is_empty() {
            continue;
        }

        // Reuse existing folder if same title already exists under this parent
        let existing_folder_id: Option<String> = match &parent_folder_id {
            Some(pid) => conn
                .query_row(
                    "SELECT id FROM folders WHERE title = ?1 AND parent_id = ?2 AND is_deleted = 0",
                    rusqlite::params![trimmed_title, pid],
                    |r| r.get(0),
                )
                .ok(),
            None => conn
                .query_row(
                    "SELECT id FROM folders WHERE title = ?1 AND parent_id IS NULL AND is_deleted = 0",
                    rusqlite::params![trimmed_title],
                    |r| r.get(0),
                )
                .ok(),
        };

        let folder_id = if let Some(fid) = existing_folder_id {
            fid
        } else {
            let fid = Uuid::new_v4().to_string();
            let folder_date = f.add_date.clone().unwrap_or_else(|| now.clone());
            conn.execute(
                r#"
                INSERT INTO folders (id, parent_id, title, position, is_locked, created_at, updated_at, is_deleted)
                VALUES (?1, ?2, ?3, 0, 0, ?4, ?4, 0)
                "#,
                rusqlite::params![fid, parent_folder_id, trimmed_title, folder_date],
            )?;
            stats.total_folders_created += 1;
            fid
        };

        // Insert bookmarks in this folder (strictly deduplicating)
        for b in &f.bookmarks {
            let raw_url = b.url.trim();
            if raw_url.is_empty() || (!raw_url.starts_with("http://") && !raw_url.starts_with("https://")) {
                continue;
            }

            let clean = crate::url_cleaner::clean_url(raw_url);
            if clean.is_empty() {
                continue;
            }

            // Check if active bookmark already exists in database
            let already_active: bool = conn
                .query_row(
                    "SELECT 1 FROM bookmarks WHERE (clean_url = ?1 OR url = ?2) AND is_deleted = 0 LIMIT 1",
                    rusqlite::params![clean, raw_url],
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
                    rusqlite::params![clean, raw_url],
                    |r| r.get(0),
                )
                .ok();

            if let Some(del_id) = existing_deleted_id {
                conn.execute(
                    "UPDATE bookmarks SET is_deleted = 0, folder_id = ?1, title = ?2, updated_at = ?3 WHERE id = ?4",
                    rusqlite::params![folder_id, b.title, now, del_id],
                )?;
                stats.total_bookmarks_imported += 1;
            } else {
                let b_id = Uuid::new_v4().to_string();
                let domain = crate::url_cleaner::extract_domain(&clean);
                let b_date = b.add_date.clone().unwrap_or_else(|| now.clone());
                let tags_json = serde_json::to_string(&b.tags).unwrap_or_else(|_| "[]".to_string());

                conn.execute(
                    r#"
                    INSERT INTO bookmarks (
                        id, folder_id, url, clean_url, domain, title,
                        link_status, is_pinned, tags, created_at, updated_at, is_deleted
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'UNCHECKED', 0, ?7, ?8, ?8, 0)
                    "#,
                    rusqlite::params![b_id, folder_id, raw_url, clean, domain, b.title, tags_json, b_date],
                )?;
                stats.total_bookmarks_imported += 1;
            }
        }

        // Recursively insert subfolders
        import_folders_to_db(conn, &f.subfolders, Some(folder_id), stats)?;
    }

    Ok(())
}

/// Generates standard Netscape Bookmark HTML from current DB
pub fn export_netscape_html(
    conn: &rusqlite::Connection,
    replace_dead_with_wayback: bool,
) -> Result<String, rusqlite::Error> {
    let mut html = String::new();
    html.push_str("<!DOCTYPE NETSCAPE-Bookmark-file-1>\n");
    html.push_str("<!-- This is an automatically generated file. It will be read and overwritten. Do Not Edit! -->\n");
    html.push_str("<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n");
    html.push_str("<TITLE>Bookmarks</TITLE>\n");
    html.push_str("<H1>Bookmarks</H1>\n\n");
    html.push_str("<DL><p>\n");

    // Fetch all folders
    let mut f_stmt = conn.prepare(
        "SELECT id, parent_id, title, created_at FROM folders WHERE is_deleted = 0 ORDER BY position ASC, title ASC",
    )?;
    let folders: Vec<(String, Option<String>, String, String)> = f_stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
        .filter_map(|r| r.ok())
        .collect();

    // Fetch all bookmarks
    let mut b_stmt = conn.prepare(
        "SELECT id, folder_id, url, title, link_status, wayback_url, tags, created_at FROM bookmarks WHERE is_deleted = 0",
    )?;
    let bookmarks: Vec<(String, Option<String>, String, String, String, Option<String>, String, String)> = b_stmt
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Map bookmarks by folder_id
    let mut bm_by_folder: HashMap<Option<String>, Vec<&(String, Option<String>, String, String, String, Option<String>, String, String)>> =
        HashMap::new();
    for b in &bookmarks {
        bm_by_folder.entry(b.1.clone()).or_default().push(b);
    }

    // Export root-level bookmarks first
    if let Some(root_bms) = bm_by_folder.get(&None) {
        for b in root_bms {
            let final_url = if replace_dead_with_wayback && (b.4 == "DEAD" || b.4 == "TIMEOUT") && b.5.is_some() {
                b.5.as_ref().unwrap()
            } else {
                &b.2
            };
            let tags: Vec<String> = serde_json::from_str(&b.6).unwrap_or_default();
            let tags_attr = if tags.is_empty() {
                String::new()
            } else {
                format!(" TAGS=\"{}\"", escape_html(&tags.join(",")))
            };
            let epoch = DateTime::parse_from_rfc3339(&b.7)
                .map(|dt| dt.timestamp())
                .unwrap_or(0);

            html.push_str(&format!(
                "    <DT><A HREF=\"{}\" ADD_DATE=\"{}\"{}>{}</A>\n",
                escape_html(final_url),
                epoch,
                tags_attr,
                escape_html(&b.3)
            ));
        }
    }

    // Export folders recursively
    write_folder_tree_html(&mut html, &folders, &bm_by_folder, None, 1, replace_dead_with_wayback);

    html.push_str("</DL><p>\n");
    Ok(html)
}

fn write_folder_tree_html(
    html: &mut String,
    all_folders: &[(String, Option<String>, String, String)],
    bm_by_folder: &HashMap<Option<String>, Vec<&(String, Option<String>, String, String, String, Option<String>, String, String)>>,
    current_parent_id: Option<&str>,
    depth: usize,
    replace_dead_with_wayback: bool,
) {
    let indent = "    ".repeat(depth);

    for (f_id, p_id, title, created_at) in all_folders {
        if p_id.as_deref() == current_parent_id {
            let epoch = DateTime::parse_from_rfc3339(created_at)
                .map(|dt| dt.timestamp())
                .unwrap_or(0);

            html.push_str(&format!(
                "{}<DT><H3 ADD_DATE=\"{}\" LAST_MODIFIED=\"{}\">{}</H3>\n",
                indent,
                epoch,
                epoch,
                escape_html(title)
            ));
            html.push_str(&format!("{}<DL><p>\n", indent));

            // Write bookmarks in this folder
            if let Some(bms) = bm_by_folder.get(&Some(f_id.clone())) {
                for b in bms {
                    let final_url = if replace_dead_with_wayback && (b.4 == "DEAD" || b.4 == "TIMEOUT") && b.5.is_some() {
                        b.5.as_ref().unwrap()
                    } else {
                        &b.2
                    };
                    let tags: Vec<String> = serde_json::from_str(&b.6).unwrap_or_default();
                    let tags_attr = if tags.is_empty() {
                        String::new()
                    } else {
                        format!(" TAGS=\"{}\"", escape_html(&tags.join(",")))
                    };
                    let b_epoch = DateTime::parse_from_rfc3339(&b.7)
                        .map(|dt| dt.timestamp())
                        .unwrap_or(0);

                    html.push_str(&format!(
                        "{}    <DT><A HREF=\"{}\" ADD_DATE=\"{}\"{}>{}</A>\n",
                        indent,
                        escape_html(final_url),
                        b_epoch,
                        tags_attr,
                        escape_html(&b.3)
                    ));
                }
            }

            // Recurse into subfolders
            write_folder_tree_html(
                html,
                all_folders,
                bm_by_folder,
                Some(f_id.as_str()),
                depth + 1,
                replace_dead_with_wayback,
            );

            html.push_str(&format!("{}</DL><p>\n", indent));
        }
    }
}
