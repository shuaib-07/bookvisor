use crate::db::{Bookmark, DbState, Folder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedFolder {
    pub name: String,
    pub description: String,
    pub subfolders: Vec<ProposedFolder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkMove {
    pub bookmark_id: String,
    pub bookmark_title: String,
    pub clean_url: String,
    pub current_folder: String,
    pub target_folder_path: String,
    pub suggested_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AITaxonomyStrategy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub proposed_tree: Vec<ProposedFolder>,
    pub moves: Vec<BookmarkMove>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIOrganizationPlan {
    pub strategies: Vec<AITaxonomyStrategy>,
    pub total_bookmarks_analyzed: usize,
    pub locked_folders_preserved: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplyPlanRequest {
    pub moves: Vec<BookmarkMove>,
}

#[allow(dead_code)]
pub fn compute_bookmark_hash(b: &Bookmark) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b.title.as_bytes());
    hasher.update(b.clean_url.as_bytes());
    if let Some(ref s) = b.scraped_summary {
        hasher.update(s.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

/// Analyzes bookmarks and generates structured taxonomy strategies
#[tauri::command]
pub async fn ai_generate_organization_plan(
    state: tauri::State<'_, DbState>,
    scope_folder_id: Option<String>,
    user_instruction: Option<String>,
) -> Result<AIOrganizationPlan, String> {
    let (folders, bookmarks, parent_folder_title) = {
        let conn = state.conn.lock().unwrap();

        let mut f_stmt = conn
            .prepare("SELECT id, parent_id, browser_guid, title, position, is_locked, color, icon, created_at, updated_at, is_deleted FROM folders WHERE is_deleted = 0")
            .map_err(|e| e.to_string())?;

        let folders: Vec<Folder> = f_stmt
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
                    is_hidden: false,
                    bookmark_count: None,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let parent_title = if let Some(ref fid) = scope_folder_id {
            if fid == "unorganized" {
                None
            } else {
                folders.iter().find(|f| &f.id == fid).map(|f| f.title.clone())
            }
        } else {
            None
        };

        // Query bookmarks safely based on scope
        let base_query = format!("SELECT {} FROM bookmarks WHERE is_deleted = 0", crate::db::BOOKMARK_SELECT_FIELDS);

        let bookmarks: Vec<Bookmark> = match scope_folder_id.as_deref() {
            Some("unorganized") => {
                let mut b_stmt = conn
                    .prepare(&format!("{} AND folder_id IS NULL", base_query))
                    .map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[])?
            }
            Some(fid) => {
                let mut b_stmt = conn
                    .prepare(&format!("{} AND folder_id = ?1", base_query))
                    .map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[&fid])?
            }
            None => {
                let mut b_stmt = conn.prepare(&base_query).map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[])?
            }
        };

        (folders, bookmarks, parent_title)
    };

    let folder_name_map: HashMap<String, String> =
        folders.iter().map(|f| (f.id.clone(), f.title.clone())).collect();

    let locked_folder_ids: Vec<String> = folders
        .iter()
        .filter(|f| f.is_locked)
        .map(|f| f.id.clone())
        .collect();

    let locked_folders_preserved: Vec<String> = folders
        .iter()
        .filter(|f| f.is_locked)
        .map(|f| f.title.clone())
        .collect();

    // Filter out pinned bookmarks and bookmarks in locked folders
    let eligible_bookmarks: Vec<&Bookmark> = bookmarks
        .iter()
        .filter(|b| !b.is_pinned)
        .filter(|b| {
            if let Some(ref fid) = b.folder_id {
                !locked_folder_ids.contains(fid)
            } else {
                true
            }
        })
        .collect();

    // Strategy 1: Technology & Framework Focused (React, React Native, Vite, Icons, Anime)
    let strategy_tech = build_tech_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );

    // Strategy 2: Resource Type & Workflow (Component Registries, Icon Packs, Torrents, Docs)
    let strategy_resource = build_resource_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );

    // Strategy 3: Granular Deep Hybrid (Subfolders inside categories)
    let strategy_hybrid = build_hybrid_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );

    Ok(AIOrganizationPlan {
        strategies: vec![strategy_tech, strategy_resource, strategy_hybrid],
        total_bookmarks_analyzed: eligible_bookmarks.len(),
        locked_folders_preserved,
    })
}

fn map_bookmarks_query(
    stmt: &mut rusqlite::Statement,
    params: &[&dyn rusqlite::ToSql],
) -> Result<Vec<Bookmark>, String> {
    let rows = stmt
        .query_map(params, crate::db::map_bookmark_row)
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        if let Ok(b) = r {
            list.push(b);
        }
    }
    Ok(list)
}

/// Applies user-approved AI taxonomy moves transactionally
#[tauri::command]
pub fn ai_apply_organization_plan(
    state: tauri::State<'_, DbState>,
    moves: Vec<BookmarkMove>,
) -> Result<usize, String> {
    let mut conn = state.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let mut folder_path_cache: HashMap<String, String> = HashMap::new();

    // Populate existing folders
    {
        let mut stmt = tx
            .prepare("SELECT id, parent_id, title FROM folders WHERE is_deleted = 0")
            .map_err(|e| e.to_string())?;

        let rows: Vec<(String, Option<String>, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut id_to_title: HashMap<String, String> = HashMap::new();
        let mut id_to_parent: HashMap<String, Option<String>> = HashMap::new();
        for (id, parent, title) in &rows {
            id_to_title.insert(id.clone(), title.clone());
            id_to_parent.insert(id.clone(), parent.clone());
        }

        for (id, _, _) in &rows {
            let mut curr = Some(id.clone());
            let mut segments = Vec::new();
            while let Some(cid) = curr {
                if let Some(title) = id_to_title.get(&cid) {
                    segments.insert(0, title.clone());
                }
                curr = id_to_parent.get(&cid).cloned().flatten();
            }
            let full_path = segments.join(" / ");
            folder_path_cache.insert(full_path, id.clone());
        }
    }

    let mut applied_count = 0;

    for m in moves {
        let target_path = m.target_folder_path.trim();
        if target_path.is_empty() {
            continue;
        }

        let folder_id = ensure_folder_path_exists(&tx, target_path, &mut folder_path_cache, &now)?;
        let tags_json = serde_json::to_string(&m.suggested_tags).unwrap_or_else(|_| "[]".to_string());

        tx.execute(
            r#"
            UPDATE bookmarks
            SET folder_id = ?1, tags = ?2, updated_at = ?3
            WHERE id = ?4
            "#,
            rusqlite::params![folder_id, tags_json, now, m.bookmark_id],
        )
        .map_err(|e| e.to_string())?;

        applied_count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(applied_count)
}

fn ensure_folder_path_exists(
    conn: &rusqlite::Connection,
    path: &str,
    cache: &mut HashMap<String, String>,
    now: &str,
) -> Result<String, String> {
    if let Some(id) = cache.get(path) {
        return Ok(id.clone());
    }

    let segments: Vec<&str> = path.split(" / ").map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return Err("Empty folder path".to_string());
    }

    let mut current_parent_id: Option<String> = None;
    let mut current_path = String::new();

    for segment in segments {
        if current_path.is_empty() {
            current_path = segment.to_string();
        } else {
            current_path = format!("{} / {}", current_path, segment);
        }

        if let Some(id) = cache.get(&current_path) {
            current_parent_id = Some(id.clone());
        } else {
            let new_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                r#"
                INSERT INTO folders (id, parent_id, title, position, is_locked, created_at, updated_at, is_deleted)
                VALUES (?1, ?2, ?3, 0, 0, ?4, ?4, 0)
                "#,
                rusqlite::params![new_id, current_parent_id, segment, now],
            )
            .map_err(|e| e.to_string())?;

            cache.insert(current_path.clone(), new_id.clone());
            current_parent_id = Some(new_id);
        }
    }

    current_parent_id.ok_or_else(|| "Failed to create folder path".to_string())
}

// ── Taxonomy Strategy Builders ──────────────────────────────────────────────

fn build_tech_taxonomy_strategy(
    bookmarks: &[&Bookmark],
    folder_name_map: &HashMap<String, String>,
    parent_prefix: Option<&str>,
    _user_instruction: Option<&str>,
) -> AITaxonomyStrategy {
    let mut moves = Vec::new();

    for b in bookmarks {
        let (raw_path, tags) = classify_by_technology(b);
        let path = if let Some(prefix) = parent_prefix {
            // Per-Folder Subfolder Deep Dive: Nest inside the parent folder!
            let sub = raw_path.split(" / ").last().unwrap_or(&raw_path);
            format!("{} / {}", prefix, sub)
        } else {
            raw_path
        };

        let current_folder = b
            .folder_id
            .as_ref()
            .and_then(|fid| folder_name_map.get(fid))
            .cloned()
            .unwrap_or_else(|| "Unorganized".to_string());

        moves.push(BookmarkMove {
            bookmark_id: b.id.clone(),
            bookmark_title: b.title.clone(),
            clean_url: b.clean_url.clone(),
            current_folder,
            target_folder_path: path,
            suggested_tags: tags,
        });
    }

    let proposed_tree = if let Some(prefix) = parent_prefix {
        vec![ProposedFolder {
            name: prefix.to_string(),
            description: format!("Subfolders tailored for {}", prefix),
            subfolders: vec![
                ProposedFolder {
                    name: "React & Component Registries".to_string(),
                    description: "21st.dev, shadcn/ui, web components".to_string(),
                    subfolders: vec![],
                },
                ProposedFolder {
                    name: "React Native & Mobile".to_string(),
                    description: "Mobile app components, reanimated".to_string(),
                    subfolders: vec![],
                },
                ProposedFolder {
                    name: "UI Icons & Animated Assets".to_string(),
                    description: "Lucide, Hugeicons, Lordicon".to_string(),
                    subfolders: vec![],
                },
                ProposedFolder {
                    name: "Frontend Tooling & Bundlers".to_string(),
                    description: "Vite, Tauri, build tools".to_string(),
                    subfolders: vec![],
                },
            ],
        }]
    } else {
        vec![
            ProposedFolder {
                name: "Coding & Development".to_string(),
                description: "Programming languages, frameworks, and registries".to_string(),
                subfolders: vec![
                    ProposedFolder {
                        name: "React & Next.js".to_string(),
                        description: "React component registries and web libraries".to_string(),
                        subfolders: vec![],
                    },
                    ProposedFolder {
                        name: "React Native & Mobile".to_string(),
                        description: "Mobile frameworks, animations, and docs".to_string(),
                        subfolders: vec![],
                    },
                    ProposedFolder {
                        name: "UI Icons & Animated Assets".to_string(),
                        description: "Icon registries, SVGs, and Lottie assets".to_string(),
                        subfolders: vec![],
                    },
                    ProposedFolder {
                        name: "Frontend Tooling & Bundlers".to_string(),
                        description: "Vite, Tauri, build utilities".to_string(),
                        subfolders: vec![],
                    },
                ],
            },
            ProposedFolder {
                name: "Anime & Media".to_string(),
                description: "Trackers, databases, torrents, and releases".to_string(),
                subfolders: vec![
                    ProposedFolder {
                        name: "Streaming & Trackers".to_string(),
                        description: "MyAnimeList, AniList, episode trackers".to_string(),
                        subfolders: vec![],
                    },
                    ProposedFolder {
                        name: "Torrent & Release Groups".to_string(),
                        description: "Nyaa, SubsPlease, fansub releases".to_string(),
                        subfolders: vec![],
                    },
                ],
            },
            ProposedFolder {
                name: "Utilities & Web Tools".to_string(),
                description: "Archives, converters, web utilities".to_string(),
                subfolders: vec![],
            },
        ]
    };

    AITaxonomyStrategy {
        id: "by_tech".to_string(),
        name: "By Technology & Ecosystem (Recommended)".to_string(),
        description: "Separates component registries, React Native, UI icons, and build tooling into distinct subfolders.".to_string(),
        proposed_tree,
        moves,
    }
}

fn build_resource_taxonomy_strategy(
    bookmarks: &[&Bookmark],
    folder_name_map: &HashMap<String, String>,
    parent_prefix: Option<&str>,
    _user_instruction: Option<&str>,
) -> AITaxonomyStrategy {
    let mut moves = Vec::new();

    for b in bookmarks {
        let (raw_path, tags) = classify_by_resource_type(b);
        let path = if let Some(prefix) = parent_prefix {
            format!("{} / {}", prefix, raw_path)
        } else {
            raw_path
        };

        let current_folder = b
            .folder_id
            .as_ref()
            .and_then(|fid| folder_name_map.get(fid))
            .cloned()
            .unwrap_or_else(|| "Unorganized".to_string());

        moves.push(BookmarkMove {
            bookmark_id: b.id.clone(),
            bookmark_title: b.title.clone(),
            clean_url: b.clean_url.clone(),
            current_folder,
            target_folder_path: path,
            suggested_tags: tags,
        });
    }

    let proposed_tree = vec![
        ProposedFolder {
            name: "Component Registries".to_string(),
            description: "Copy-pasteable components, UI kits, design systems".to_string(),
            subfolders: vec![],
        },
        ProposedFolder {
            name: "Icon & Graphic Registries".to_string(),
            description: "Vector icons, SVG sets, animated Lottie assets".to_string(),
            subfolders: vec![],
        },
        ProposedFolder {
            name: "Documentation & Cheatsheets".to_string(),
            description: "Official guides, API references, cheatsheets".to_string(),
            subfolders: vec![],
        },
        ProposedFolder {
            name: "Torrents & Direct Downloads".to_string(),
            description: "Fansub releases, trackers, and download repositories".to_string(),
            subfolders: vec![],
        },
        ProposedFolder {
            name: "General Utilities".to_string(),
            description: "Web services, archives, miscellaneous".to_string(),
            subfolders: vec![],
        },
    ];

    AITaxonomyStrategy {
        id: "by_resource".to_string(),
        name: "By Resource Type & Role".to_string(),
        description: "Groups bookmarks strictly by their functional role (e.g. Component Registries, Icon Packs, Docs, Torrents).".to_string(),
        proposed_tree,
        moves,
    }
}

fn build_hybrid_taxonomy_strategy(
    bookmarks: &[&Bookmark],
    folder_name_map: &HashMap<String, String>,
    parent_prefix: Option<&str>,
    _user_instruction: Option<&str>,
) -> AITaxonomyStrategy {
    let mut moves = Vec::new();

    for b in bookmarks {
        let (raw_path, tags) = classify_granular_hybrid(b);
        let path = if let Some(prefix) = parent_prefix {
            format!("{} / {}", prefix, raw_path)
        } else {
            raw_path
        };

        let current_folder = b
            .folder_id
            .as_ref()
            .and_then(|fid| folder_name_map.get(fid))
            .cloned()
            .unwrap_or_else(|| "Unorganized".to_string());

        moves.push(BookmarkMove {
            bookmark_id: b.id.clone(),
            bookmark_title: b.title.clone(),
            clean_url: b.clean_url.clone(),
            current_folder,
            target_folder_path: path,
            suggested_tags: tags,
        });
    }

    let proposed_tree = vec![
        ProposedFolder {
            name: "Dev".to_string(),
            description: "Developer assets and tools".to_string(),
            subfolders: vec![
                ProposedFolder {
                    name: "Frontend".to_string(),
                    description: "React, Vue, components, icons".to_string(),
                    subfolders: vec![
                        ProposedFolder {
                            name: "Component Registries".to_string(),
                            description: "21st.dev, shadcn/ui, Aceternity".to_string(),
                            subfolders: vec![],
                        },
                        ProposedFolder {
                            name: "Icons".to_string(),
                            description: "Lucide, Hugeicons, Lordicon".to_string(),
                            subfolders: vec![],
                        },
                    ],
                },
                ProposedFolder {
                    name: "Mobile".to_string(),
                    description: "React Native, Flutter, Swift".to_string(),
                    subfolders: vec![],
                },
            ],
        },
        ProposedFolder {
            name: "Media".to_string(),
            description: "Anime, streaming, releases".to_string(),
            subfolders: vec![],
        },
    ];

    AITaxonomyStrategy {
        id: "granular_hybrid".to_string(),
        name: "Granular Deep Hybrid (3 Levels)".to_string(),
        description: "Creates deeply nested subcategories for maximum organization density.".to_string(),
        proposed_tree,
        moves,
    }
}

// ── Semantic Classifier Heuristics ──────────────────────────────────────────

fn classify_by_technology(b: &Bookmark) -> (String, Vec<String>) {
    let lower_title = b.title.to_lowercase();
    let lower_url = b.clean_url.to_lowercase();
    let lower_domain = b.domain.to_lowercase();
    let summary = b.scraped_summary.as_deref().unwrap_or("").to_lowercase();
    let hay = format!("{} {} {} {}", lower_title, lower_url, lower_domain, summary);

    // 1. Icons & Animated Assets
    if hay.contains("icon") || hay.contains("lordicon") || hay.contains("lucide") || hay.contains("hugeicon") {
        return (
            "Coding & Development / UI Icons & Animated Assets".to_string(),
            vec!["icons".to_string(), "svg".to_string(), "assets".to_string()],
        );
    }

    // 2. React Native & Mobile
    if hay.contains("react native") || hay.contains("reactnative") || hay.contains("gluestack") || hay.contains("swmansion") || hay.contains("reanimated") {
        return (
            "Coding & Development / React Native & Mobile".to_string(),
            vec!["react-native".to_string(), "mobile".to_string(), "components".to_string()],
        );
    }

    // 3. React / Next / Web Component Registries
    if hay.contains("21st.dev") || hay.contains("shadcn") || hay.contains("aceternity") || hay.contains("magicui") || hay.contains("component") || hay.contains("tailwind") {
        return (
            "Coding & Development / React & Next.js".to_string(),
            vec!["react".to_string(), "tailwind".to_string(), "components".to_string()],
        );
    }

    // 4. Frontend Tooling & Bundlers
    if hay.contains("vite") || hay.contains("tauri") || hay.contains("rust") || hay.contains("build tool") || hay.contains("webpack") {
        return (
            "Coding & Development / Frontend Tooling & Bundlers".to_string(),
            vec!["tooling".to_string(), "frontend".to_string(), "bundler".to_string()],
        );
    }

    // 5. Anime Torrents & Releases
    if hay.contains("nyaa") || hay.contains("subsplease") || hay.contains("torrent") || hay.contains("fansub") || hay.contains("download") {
        return (
            "Anime & Media / Torrent & Release Groups".to_string(),
            vec!["anime".to_string(), "torrents".to_string(), "releases".to_string()],
        );
    }

    // 6. Anime Trackers & Community
    if hay.contains("myanimelist") || hay.contains("anilist") || hay.contains("kitsu") || hay.contains("manga") || hay.contains("anime") {
        return (
            "Anime & Media / Streaming & Trackers".to_string(),
            vec!["anime".to_string(), "tracker".to_string(), "database".to_string()],
        );
    }

    // Fallback
    (
        "Utilities & Web Tools".to_string(),
        vec!["tools".to_string(), "web".to_string()],
    )
}

fn classify_by_resource_type(b: &Bookmark) -> (String, Vec<String>) {
    let lower_title = b.title.to_lowercase();
    let lower_url = b.clean_url.to_lowercase();
    let lower_domain = b.domain.to_lowercase();
    let summary = b.scraped_summary.as_deref().unwrap_or("").to_lowercase();
    let hay = format!("{} {} {} {}", lower_title, lower_url, lower_domain, summary);

    if hay.contains("icon") || hay.contains("svg") || hay.contains("lordicon") || hay.contains("hugeicon") {
        ("Icon & Graphic Registries".to_string(), vec!["icons".to_string(), "graphics".to_string()])
    } else if hay.contains("component") || hay.contains("21st.dev") || hay.contains("shadcn") || hay.contains("ui library") {
        ("Component Registries".to_string(), vec!["components".to_string(), "ui".to_string()])
    } else if hay.contains("doc") || hay.contains("getting started") || hay.contains("guide") || hay.contains("api") {
        ("Documentation & Cheatsheets".to_string(), vec!["documentation".to_string(), "docs".to_string()])
    } else if hay.contains("nyaa") || hay.contains("torrent") || hay.contains("download") || hay.contains("subsplease") {
        ("Torrents & Direct Downloads".to_string(), vec!["downloads".to_string(), "torrents".to_string()])
    } else {
        ("General Utilities".to_string(), vec!["tools".to_string()])
    }
}

fn classify_granular_hybrid(b: &Bookmark) -> (String, Vec<String>) {
    let lower_title = b.title.to_lowercase();
    let lower_url = b.clean_url.to_lowercase();
    let lower_domain = b.domain.to_lowercase();
    let summary = b.scraped_summary.as_deref().unwrap_or("").to_lowercase();
    let hay = format!("{} {} {} {}", lower_title, lower_url, lower_domain, summary);

    if hay.contains("icon") {
        ("Frontend / Icons".to_string(), vec!["icons".to_string(), "frontend".to_string()])
    } else if hay.contains("react native") || hay.contains("mobile") {
        ("Mobile".to_string(), vec!["mobile".to_string(), "react-native".to_string()])
    } else if hay.contains("component") || hay.contains("shadcn") || hay.contains("21st.dev") {
        ("Frontend / Component Registries".to_string(), vec!["components".to_string(), "react".to_string()])
    } else if hay.contains("anime") || hay.contains("torrent") || hay.contains("media") {
        ("Media".to_string(), vec!["media".to_string(), "anime".to_string()])
    } else {
        ("Tools".to_string(), vec!["tools".to_string()])
    }
}

// ----------------------------------------------------------------------------
// AI Sidepanel & Semantic Search Engine
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISearchResult {
    pub bookmark: Bookmark,
    pub score: f32,
    pub matched_terms: Vec<String>,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatMessage {
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIChatResponse {
    pub reply: String,
    pub relevant_bookmarks: Vec<Bookmark>,
}

fn tokenize_query(query: &str) -> Vec<String> {
    let stop_words = [
        "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
        "of", "from", "by", "my", "me", "i", "we", "you", "bookmark", "bookmarks",
        "find", "show", "search", "get", "give", "list", "links", "link", "url",
        "website", "websites", "page", "pages", "is", "are", "can", "please", "some",
        "any", "about", "which", "what", "where", "how"
    ];
    let cleaned: String = query
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { ' ' })
        .collect();

    let mut tokens = Vec::new();
    for word in cleaned.split_whitespace() {
        if !stop_words.contains(&word) && word.len() >= 2 {
            tokens.push(word.to_string());
        }
    }
    tokens
}

fn expand_semantic_intent(token: &str) -> Vec<&'static str> {
    match token {
        "pdf" => vec!["pdf", "adobe", "acrobat", "foxit", "ilovepdf", "smallpdf", "converter", "merge", "compress", "reader", "document"],
        "edit" | "editor" | "editing" => vec!["edit", "editor", "modify", "studio", "creator", "convert", "tool"],
        "anime" => vec!["anime", "manga", "stream", "subsplease", "crunchyroll", "gogoanime", "nyaa", "otaku", "subbed", "dubbed", "watch"],
        "video" | "videos" => vec!["video", "stream", "media", "player", "clip", "mp4", "download", "youtube", "vimeo"],
        "download" | "downloads" => vec!["download", "torrent", "nyaa", "magnet", "save", "fetch"],
        "ui" | "component" | "components" => vec!["component", "shadcn", "tailwind", "ui", "react", "template", "widget", "registry", "design", "css", "radix", "lucide"],
        "icon" | "icons" => vec!["icon", "svg", "symbol", "glyph", "vector", "lucide", "feather", "font", "graphic", "hugeicons"],
        "code" | "dev" | "programming" => vec!["code", "dev", "github", "gitlab", "programming", "developer", "api", "sdk", "library", "framework", "repo", "rust", "typescript"],
        "doc" | "docs" | "documentation" => vec!["doc", "docs", "documentation", "guide", "cheatsheet", "manual", "tutorial", "reference"],
        "torrent" | "torrents" => vec!["torrent", "nyaa", "1337x", "pirate", "magnet", "p2p"],
        "music" | "audio" => vec!["audio", "music", "sound", "mp3", "song", "spotify", "soundcloud", "podcast"],
        "convert" | "converter" => vec!["convert", "converter", "transform", "compress", "export", "tool"],
        "free" => vec!["free", "open-source", "foss", "public"],
        _ => vec![],
    }
}

/// Hybrid natural-language semantic ranking across titles, domains, URLs, summaries, and tags
#[tauri::command]
pub async fn ai_semantic_search(
    state: tauri::State<'_, DbState>,
    query: String,
    folder_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<AISearchResult>, String> {
    let raw_tokens = tokenize_query(&query);
    if raw_tokens.is_empty() && query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Build expanded semantic stems
    let mut expanded_terms: Vec<String> = raw_tokens.clone();
    for t in &raw_tokens {
        for stem in expand_semantic_intent(t) {
            let stem_str = stem.to_string();
            if !expanded_terms.contains(&stem_str) {
                expanded_terms.push(stem_str);
            }
        }
    }

    let bookmarks = {
        let conn = state.conn.lock().unwrap();
        let base_query = "SELECT id, folder_id, browser_guid, url, clean_url, domain, title,
                    scraped_title, scraped_summary, favicon_url, link_status, http_code,
                    wayback_url, is_pinned, tags, created_at, updated_at, is_deleted
             FROM bookmarks WHERE is_deleted = 0 AND is_hidden = 0 AND (folder_id IS NULL OR folder_id NOT IN (SELECT id FROM folders WHERE is_hidden = 1))";

        match folder_id.as_deref() {
            Some("unorganized") => {
                let mut b_stmt = conn
                    .prepare(&format!("{} AND folder_id IS NULL", base_query))
                    .map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[])?
            }
            Some(fid) => {
                let mut b_stmt = conn
                    .prepare(&format!("{} AND folder_id = ?1", base_query))
                    .map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[&fid])?
            }
            None => {
                let mut b_stmt = conn.prepare(&base_query).map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[])?
            }
        }
    };

    let query_lower = query.to_lowercase();
    let max_results = limit.unwrap_or(24);
    let mut scored_results: Vec<AISearchResult> = Vec::new();

    for b in bookmarks {
        let title_lower = b.title.to_lowercase();
        let domain_lower = b.domain.to_lowercase();
        let clean_url_lower = b.clean_url.to_lowercase();
        let summary_lower = b.scraped_summary.as_deref().unwrap_or("").to_lowercase();
        let scraped_title_lower = b.scraped_title.as_deref().unwrap_or("").to_lowercase();
        let tags_str = b.tags.join(" ").to_lowercase();

        let mut score = 0.0f32;
        let mut matched: Vec<String> = Vec::new();

        // Exact full query substring bonus
        if !query_lower.is_empty() && (title_lower.contains(&query_lower) || scraped_title_lower.contains(&query_lower)) {
            score += 35.0;
            matched.push("exact query match".to_string());
        }

        // Check primary tokens
        for token in &raw_tokens {
            let mut hit = false;
            if title_lower.contains(token) {
                score += 18.0;
                hit = true;
            }
            if domain_lower.contains(token) || clean_url_lower.contains(token) {
                score += 12.0;
                hit = true;
            }
            if tags_str.contains(token) {
                score += 14.0;
                hit = true;
            }
            if scraped_title_lower.contains(token) {
                score += 10.0;
                hit = true;
            }
            if summary_lower.contains(token) {
                score += 8.0;
                hit = true;
            }

            if hit && !matched.contains(token) {
                matched.push(token.clone());
            }
        }

        // Check expanded intent stems
        for stem in &expanded_terms {
            if raw_tokens.contains(stem) {
                continue;
            }
            let mut hit = false;
            if title_lower.contains(stem) {
                score += 6.0;
                hit = true;
            }
            if domain_lower.contains(stem) || clean_url_lower.contains(stem) {
                score += 5.0;
                hit = true;
            }
            if tags_str.contains(stem) {
                score += 6.0;
                hit = true;
            }
            if summary_lower.contains(stem) {
                score += 4.0;
                hit = true;
            }

            if hit && !matched.contains(stem) {
                matched.push(stem.clone());
            }
        }

        // Pinned bookmarks get a subtle ranking boost
        if b.is_pinned && score > 0.0 {
            score += 3.0;
        }

        if score > 0.0 {
            let explanation = if matched.is_empty() {
                "Matched via semantic relevance".to_string()
            } else {
                format!("Matched intent & keywords: {}", matched.join(", "))
            };

            scored_results.push(AISearchResult {
                bookmark: b,
                score,
                matched_terms: matched,
                explanation,
            });
        }
    }

    // Sort descending by score
    scored_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored_results.truncate(max_results);

    Ok(scored_results)
}

/// Conversational AI query endpoint for natural-language bookmark exploration
#[tauri::command]
pub async fn ai_chat_query(
    state: tauri::State<'_, DbState>,
    messages: Vec<AIChatMessage>,
    folder_id: Option<String>,
) -> Result<AIChatResponse, String> {
    let latest_user_msg = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    if latest_user_msg.trim().is_empty() {
        return Ok(AIChatResponse {
            reply: "How can I help you find links in your bookmarks?".to_string(),
            relevant_bookmarks: Vec::new(),
        });
    }

    let search_results = ai_semantic_search(state, latest_user_msg.clone(), folder_id.clone(), Some(6)).await?;

    if search_results.is_empty() {
        let reply = format!(
            "I couldn't find any bookmarks directly matching **\"{}\"** in this scope.\n\n\
            *Tip:* Try asking for broader terms (e.g., *'pdf tools'*, *'anime streaming'*, *'UI component libraries'*), or scrape your bookmarks to index full page contents.",
            latest_user_msg.trim()
        );
        return Ok(AIChatResponse {
            reply,
            relevant_bookmarks: Vec::new(),
        });
    }

    let relevant_bookmarks: Vec<Bookmark> = search_results.iter().map(|r| r.bookmark.clone()).collect();
    let count = relevant_bookmarks.len();

    let mut bullets = String::new();
    for (idx, item) in search_results.iter().take(4).enumerate() {
        let title = &item.bookmark.title;
        let domain = &item.bookmark.domain;
        let url = &item.bookmark.url;
        let desc = if let Some(ref s) = item.bookmark.scraped_summary {
            if s.len() > 110 {
                format!("{}...", &s[..110])
            } else {
                s.clone()
            }
        } else {
            item.explanation.clone()
        };
        bullets.push_str(&format!("{}. [**{}**]({}) ([{}]({}))\n\n   _{}_\n\n", idx + 1, title, url, domain, url, desc));
    }

    let reply = format!(
        "Found **{} relevant bookmark{}** for **\"{}\"**:\n\n\
        {}\n\
        You can open these directly, copy clean URLs, or locate them in your library.",
        count,
        if count == 1 { "" } else { "s" },
        latest_user_msg.trim(),
        bullets
    );

    Ok(AIChatResponse {
        reply,
        relevant_bookmarks,
    })
}
