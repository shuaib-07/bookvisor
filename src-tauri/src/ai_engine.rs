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
                crate::db::get_folder_path(&conn, fid)
            }
        } else {
            None
        };

        // Query bookmarks safely based on scope, excluding deleted and hidden bookmarks
        let base_query = format!(
            "SELECT {} FROM bookmarks WHERE is_deleted = 0 AND is_hidden = 0",
            crate::db::BOOKMARK_SELECT_FIELDS
        );

        let bookmarks: Vec<Bookmark> = match scope_folder_id.as_deref() {
            Some("unorganized") => {
                let mut b_stmt = conn
                    .prepare(&format!("{} AND folder_id IS NULL", base_query))
                    .map_err(|e| e.to_string())?;
                map_bookmarks_query(&mut b_stmt, &[])?
            }
            Some(fid) => {
                let mut b_stmt = conn
                    .prepare(&format!(
                        "{} AND (folder_id = ?1 OR folder_id IN (WITH RECURSIVE subfolders AS (SELECT id FROM folders WHERE parent_id = ?1 AND is_deleted = 0 UNION ALL SELECT f.id FROM folders f JOIN subfolders s ON f.parent_id = s.id WHERE f.is_deleted = 0) SELECT id FROM subfolders))",
                        base_query
                    ))
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

    let mut strategies = Vec::new();

    // If user provided a specific instruction/prompt, build prompt-driven strategy first!
    if let Some(instruction) = user_instruction.as_deref().filter(|s| !s.trim().is_empty()) {
        let specs = extract_custom_folder_specs(instruction);
        if !specs.is_empty() {
            let strategy_prompt = build_prompt_driven_strategy(
                &eligible_bookmarks,
                &folder_name_map,
                parent_folder_title.as_deref(),
                instruction,
                &specs,
            );
            if !strategy_prompt.moves.is_empty() {
                strategies.push(strategy_prompt);
            }
        }
    }

    // Strategy 1: Technology & Framework Focused (React, React Native, Vite, Icons, Anime)
    let strategy_tech = build_tech_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );
    strategies.push(strategy_tech);

    // Strategy 2: Resource Type & Workflow (Component Registries, Icon Packs, Torrents, Docs)
    let strategy_resource = build_resource_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );
    strategies.push(strategy_resource);

    // Strategy 3: Granular Deep Hybrid (Subfolders inside categories)
    let strategy_hybrid = build_hybrid_taxonomy_strategy(
        &eligible_bookmarks,
        &folder_name_map,
        parent_folder_title.as_deref(),
        user_instruction.as_deref(),
    );
    strategies.push(strategy_hybrid);

    Ok(AIOrganizationPlan {
        strategies,
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

// ── Custom Prompt Extraction & Taxonomy Strategy Builders ───────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomCategorySpec {
    pub folder_name: String,
    pub keywords: Vec<String>,
}

fn split_into_clauses(text: &str) -> Vec<String> {
    let mut clauses = Vec::new();
    let normalized = text
        .replace(" as well as ", ", ")
        .replace(" and also ", ", ")
        .replace("; ", ", ")
        .replace('\n', ", ");

    for part in normalized.split(&[',', '.'][..]) {
        let trimmed = part.trim();
        if !trimmed.is_empty() {
            clauses.push(trimmed.to_string());
        }
    }
    clauses
}

fn to_clean_title(raw: &str) -> String {
    let words: Vec<String> = raw
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect();
    words.join(" ")
}

pub fn extract_custom_folder_specs(instruction: &str) -> Vec<CustomCategorySpec> {
    let lower = instruction.to_lowercase();
    let clauses = split_into_clauses(&lower);
    let mut specs = Vec::new();

    for clause in clauses {
        let mut target = clause.trim().to_string();

        let leading_prefixes = [
            "i want ", "i would like ", "we want ", "please put ", "put ",
            "place ", "move ", "keep ", "create a ", "create an ", "create ",
            "make a ", "make an ", "make ", "separate ", "group by ", "organize by ",
            "organise by ", "organize into ", "organise into ", "into a ", "in a ",
            "in ", "into ", "for ", "also ", "and "
        ];
        let mut changed = true;
        while changed {
            changed = false;
            for prefix in &leading_prefixes {
                if target.starts_with(prefix) {
                    target = target[prefix.len()..].trim().to_string();
                    changed = true;
                }
            }
        }

        let trailing_suffixes = [
            " separately in a different folder",
            " seperately in a different folder",
            " in a different folder",
            " in a separate folder",
            " in a seperate folder",
            " in a new folder",
            " into a different folder",
            " into a separate folder",
            " into a seperate folder",
            " into a new folder",
            " in their own folders",
            " in their own folder",
            " into their own folders",
            " into their own folder",
            " in its own folder",
            " in another folder",
            " in a folder",
            " into a folder",
            " in folder",
            " into folder",
            " subfolder",
            " subfolders",
            " folder",
            " folders",
            " directories",
            " directory",
            " as well",
            " separately",
            " seperately",
            " websites",
            " website",
            " sites",
            " site",
            " links",
            " link",
            " bookmarks",
            " bookmark",
            " pages",
            " page",
        ];

        let mut suffix_changed = true;
        while suffix_changed {
            suffix_changed = false;
            for suffix in &trailing_suffixes {
                if target.ends_with(suffix) {
                    target = target[..target.len() - suffix.len()].trim().to_string();
                    suffix_changed = true;
                }
            }
        }

        let target = target.trim();
        if target.len() < 2 {
            continue;
        }

        let (folder_name, keywords) = resolve_folder_spec(target);
        if !specs.iter().any(|s: &CustomCategorySpec| s.folder_name.eq_ignore_ascii_case(&folder_name)) {
            specs.push(CustomCategorySpec {
                folder_name,
                keywords,
            });
        }
    }

    // Fallback: If no structured clauses matched, split by commas/slashes
    if specs.is_empty() {
        for part in instruction.split(&[',', ';', '/'][..]) {
            let p = part.trim();
            if p.len() >= 2 && p.len() <= 30 {
                let (f_name, kws) = resolve_folder_spec(p);
                if !specs.iter().any(|s: &CustomCategorySpec| s.folder_name.eq_ignore_ascii_case(&f_name)) {
                    specs.push(CustomCategorySpec {
                        folder_name: f_name,
                        keywords: kws,
                    });
                }
            }
        }
    }

    specs
}

fn resolve_folder_spec(raw: &str) -> (String, Vec<String>) {
    let lower = raw.to_lowercase();

    if lower.contains("inspiration") || lower.contains("inspire") {
        (
            "Inspiration".to_string(),
            vec![
                "inspiration".into(), "inspire".into(), "showcase".into(), "awwwards".into(),
                "dribbble".into(), "behance".into(), "gallery".into(), "ideas".into(),
                "creative".into(), "portfolio".into(), "curated".into(), "framer".into(),
                "godly".into(), "mobbin".into(), "landbook".into(), "siteinspire".into(),
            ],
        )
    } else if lower.contains("icon") || lower.contains("logo") {
        (
            "Icon & Logo Libraries".to_string(),
            vec![
                "icon".into(), "icons".into(), "logo".into(), "logos".into(), "svg".into(),
                "glyph".into(), "symbol".into(), "vector".into(), "lucide".into(),
                "fontawesome".into(), "tabler".into(), "heroicons".into(), "simpleicons".into(),
                "feather".into(), "remixicon".into(), "iconify".into(), "flaticon".into(),
                "thenounproject".into(), "brand".into(), "assets".into(),
            ],
        )
    } else if lower.contains("design") || lower.contains("prompt") {
        (
            "Design & Prompts".to_string(),
            vec![
                "design".into(), "prompt".into(), "prompts".into(), "ui".into(), "ux".into(),
                "template".into(), "templates".into(), "figma".into(), "landing".into(),
                "midjourney".into(), "dall-e".into(), "stablediffusion".into(), "chatgpt".into(),
                "wireframe".into(), "mockup".into(), "palette".into(), "color".into(),
                "typeface".into(), "graphic".into(), "pattern".into(), "animation".into(),
            ],
        )
    } else if lower.contains("component") || lower.contains("registry") {
        (
            "Component Registries & UI".to_string(),
            vec![
                "component".into(), "components".into(), "registry".into(), "shadcn".into(),
                "radix".into(), "tailwind".into(), "ui".into(), "widget".into(), "library".into(),
                "reactdrops".into(), "pinui".into(), "21st.dev".into(), "magicui".into(),
            ],
        )
    } else if lower.contains("react") || lower.contains("next") {
        (
            "React & Next.js".to_string(),
            vec![
                "react".into(), "nextjs".into(), "next.js".into(), "jsx".into(), "tsx".into(),
                "redux".into(), "zustand".into(), "tanstack".into(), "vite".into(),
            ],
        )
    } else if lower.contains("doc") || lower.contains("documentation") || lower.contains("reference") {
        (
            "Documentation & Guides".to_string(),
            vec![
                "doc".into(), "docs".into(), "documentation".into(), "reference".into(),
                "guide".into(), "manual".into(), "handbook".into(), "tutorial".into(),
                "api".into(), "cheatsheet".into(), "spec".into(),
            ],
        )
    } else if lower.contains("tool") || lower.contains("util") || lower.contains("converter") {
        (
            "Tools & Utilities".to_string(),
            vec![
                "tool".into(), "tools".into(), "utility".into(), "utilities".into(),
                "converter".into(), "generator".into(), "formatter".into(), "calculator".into(),
                "validator".into(), "editor".into(), "checker".into(), "tester".into(),
            ],
        )
    } else if lower.contains("anime") || lower.contains("manga") {
        (
            "Anime & Manga".to_string(),
            vec![
                "anime".into(), "manga".into(), "crunchyroll".into(), "aniwave".into(),
                "myanimelist".into(), "stream".into(), "episode".into(), "sub".into(), "dub".into(),
            ],
        )
    } else if lower.contains("torrent") || lower.contains("warez") || lower.contains("download") {
        (
            "Torrents & Downloads".to_string(),
            vec![
                "torrent".into(), "warez".into(), "magnet".into(), "tracker".into(),
                "1337x".into(), "piratebay".into(), "fitgirl".into(), "repack".into(),
            ],
        )
    } else {
        let folder_title = to_clean_title(raw);
        let mut kws = Vec::new();
        kws.push(raw.to_lowercase());
        for word in raw.split_whitespace() {
            let w = word.to_lowercase();
            if w.len() >= 3 {
                kws.push(w.clone());
                if w.ends_with('s') && w.len() > 3 {
                    kws.push(w[..w.len() - 1].to_string());
                } else {
                    kws.push(format!("{}s", w));
                }
            }
        }
        (folder_title, kws)
    }
}

fn score_bookmark_against_specs<'a>(
    b: &Bookmark,
    specs: &'a [CustomCategorySpec],
) -> Option<(&'a CustomCategorySpec, f64)> {
    let title_lower = b.title.to_lowercase();
    let url_lower = b.url.to_lowercase();
    let domain_lower = b.domain.to_lowercase();
    let desc_lower = b.description.as_deref().unwrap_or("").to_lowercase();
    let summary_lower = b.scraped_summary.as_deref().unwrap_or("").to_lowercase();
    let tags_joined = b.tags.join(" ").to_lowercase();

    let mut best_spec: Option<(&'a CustomCategorySpec, f64)> = None;
    let mut highest_score = 0.0;

    for spec in specs {
        let mut score = 0.0;
        for kw in &spec.keywords {
            let kw_lower = kw.to_lowercase();
            if kw_lower.len() < 2 {
                continue;
            }

            if domain_lower.contains(&kw_lower) {
                score += 5.0;
            }
            if url_lower.contains(&kw_lower) {
                score += 4.0;
            }
            if title_lower.contains(&kw_lower) {
                score += 3.5;
            }
            if tags_joined.contains(&kw_lower) {
                score += 3.0;
            }
            if desc_lower.contains(&kw_lower) || summary_lower.contains(&kw_lower) {
                score += 2.0;
            }
        }

        if score > highest_score {
            highest_score = score;
            best_spec = Some((spec, score));
        }
    }

    best_spec.filter(|(_, score)| *score >= 2.5)
}

fn build_prompt_driven_strategy(
    bookmarks: &[&Bookmark],
    folder_name_map: &HashMap<String, String>,
    parent_prefix: Option<&str>,
    user_instruction: &str,
    specs: &[CustomCategorySpec],
) -> AITaxonomyStrategy {
    let mut moves = Vec::new();

    for b in bookmarks {
        let best_match = score_bookmark_against_specs(b, specs);
        if let Some((spec, _score)) = best_match {
            let target_folder_path = if let Some(prefix) = parent_prefix {
                format!("{} / {}", prefix, spec.folder_name)
            } else {
                spec.folder_name.clone()
            };

            let current_folder = b
                .folder_id
                .as_ref()
                .and_then(|fid| folder_name_map.get(fid))
                .cloned()
                .unwrap_or_else(|| "Unorganized".to_string());

            let suggested_tag = spec
                .folder_name
                .to_lowercase()
                .replace(" & ", "-")
                .replace(' ', "-");

            moves.push(BookmarkMove {
                bookmark_id: b.id.clone(),
                bookmark_title: b.title.clone(),
                clean_url: b.clean_url.clone(),
                current_folder,
                target_folder_path,
                suggested_tags: vec![suggested_tag],
            });
        }
    }

    let folder_names: Vec<String> = specs.iter().map(|s| s.folder_name.clone()).collect();
    let folder_summary = folder_names.join(", ");

    let proposed_tree = specs
        .iter()
        .map(|s| ProposedFolder {
            name: s.folder_name.clone(),
            description: format!("Created from prompt for {}", s.folder_name),
            subfolders: vec![],
        })
        .collect();

    AITaxonomyStrategy {
        id: "prompt_tailored".to_string(),
        name: "Prompt-Tailored Strategy (Your Request)".to_string(),
        description: format!(
            "Custom-built from prompt \"{}\". Proposes creating: {}.",
            user_instruction.trim(),
            folder_summary
        ),
        proposed_tree,
        moves,
    }
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposed_moves: Option<Vec<BookmarkMove>>,
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

fn is_organization_intent(msg: &str) -> bool {
    let lower = msg.to_lowercase();
    let org_keywords = [
        "organize", "organise", "categorize", "categorise",
        "separate", "group by", "group into", "put in a folder",
        "put in a different folder", "put in a separate folder",
        "move to folder", "create folder", "subfolder", "subfolders",
        "sort into", "in a different folder", "in a separate folder",
        "in a seperate folder", "in their own folder", "in their own folders",
    ];
    org_keywords.iter().any(|k| lower.contains(k))
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
            proposed_moves: None,
        });
    }

    // Check for conversational organizing intent
    if is_organization_intent(&latest_user_msg) {
        if let Ok(plan) = ai_generate_organization_plan(state.clone(), folder_id.clone(), Some(latest_user_msg.clone())).await {
            if let Some(strategy) = plan.strategies.first() {
                if !strategy.moves.is_empty() {
                    let mut unique_folders: Vec<String> = strategy
                        .moves
                        .iter()
                        .map(|m| {
                            m.target_folder_path
                                .split(" / ")
                                .last()
                                .unwrap_or(&m.target_folder_path)
                                .to_string()
                        })
                        .collect::<std::collections::HashSet<_>>()
                        .into_iter()
                        .collect();
                    unique_folders.sort();

                    let moves_count = strategy.moves.len();
                    let reply = format!(
                        "I analyzed your bookmarks and prepared an organization plan based on your request:\n\n\
                        • **Proposed Folders:** {}\n\
                        • **Bookmarks to Move:** {} item{}\n\n\
                        You can review the proposed folders, toggle individual links, and apply the moves directly below:",
                        unique_folders.join(", "),
                        moves_count,
                        if moves_count == 1 { "" } else { "s" }
                    );

                    let bookmark_ids: Vec<String> = strategy.moves.iter().map(|m| m.bookmark_id.clone()).collect();
                    let mut relevant_bookmarks = Vec::new();
                    if let Ok(conn) = state.conn.lock() {
                        for bid in bookmark_ids.iter().take(20) {
                            let query = format!("SELECT {} FROM bookmarks WHERE id = ?1", crate::db::BOOKMARK_SELECT_FIELDS);
                            if let Ok(mut stmt) = conn.prepare(&query) {
                                if let Ok(mut rows) = stmt.query_map([bid], crate::db::map_bookmark_row) {
                                    if let Some(Ok(b)) = rows.next() {
                                        relevant_bookmarks.push(b);
                                    }
                                }
                            }
                        }
                    }

                    return Ok(AIChatResponse {
                        reply,
                        relevant_bookmarks,
                        proposed_moves: Some(strategy.moves.clone()),
                    });
                }
            }
        }
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
            proposed_moves: None,
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
        proposed_moves: None,
    })
}
