mod ai_engine;
mod browser_importer;
mod db;
mod extension_manager;
mod html_parser;
mod model_manager;
mod scraper;
mod sys_info;
mod updater;
mod url_cleaner;
mod ws_server;

use db::DbState;
use model_manager::ModelManagerState;
use scraper::ScraperState;
use ws_server::WsServerState;
use tauri::Manager;

#[tauri::command]
fn import_bookmarks_html(
    state: tauri::State<DbState>,
    html_content: String,
) -> Result<html_parser::ImportResult, String> {
    let folders = html_parser::parse_netscape_html(&html_content);
    let mut stats = html_parser::ImportResult {
        total_bookmarks_imported: 0,
        total_folders_created: 0,
        total_bookmarks_skipped: 0,
    };

    let mut conn = state.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    {
        html_parser::import_folders_to_db(&tx, &folders, None, &mut stats)
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(stats)
}

#[tauri::command]
fn export_bookmarks_html(
    state: tauri::State<DbState>,
    replace_dead_with_wayback: bool,
) -> Result<String, String> {
    let conn = state.conn.lock().unwrap();
    html_parser::export_netscape_html(&conn, replace_dead_with_wayback).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_file_dialog(
    default_name: String,
    content: String,
    filter_name: String,
    extension: String,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
    if !filter_name.is_empty() && !extension.is_empty() {
        dialog = dialog.add_filter(&filter_name, &[&extension]);
    }
    let file = dialog.save_file();

    if let Some(path) = file {
        std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn import_demo_bookmarks(state: tauri::State<DbState>) -> Result<html_parser::ImportResult, String> {
    let demo_html = r#"
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
        <DT><H3 ADD_DATE="1700000000">Coding & Development</H3>
        <DL><p>
            <DT><H3 ADD_DATE="1700000100">Component Registries</H3>
            <DL><p>
                <DT><A HREF="https://21st.dev/?utm_source=twitter&ref=github" ADD_DATE="1700000110" TAGS="react,components,tailwind">21st.dev - The NPM for Design Engineers</A>
                <DT><A HREF="https://ui.shadcn.com/?ref=producthunt" ADD_DATE="1700000120" TAGS="react,tailwind,radix">shadcn/ui - Beautifully designed components</A>
                <DT><A HREF="https://ui.aceternity.com" ADD_DATE="1700000130" TAGS="react,framer-motion,animations">Aceternity UI - Modern animated components</A>
                <DT><A HREF="https://magicui.design" ADD_DATE="1700000140" TAGS="react,animations,tailwind">Magic UI - 150+ free and open-source animated components</A>
            </DL><p>
            <DT><H3 ADD_DATE="1700000200">React Native</H3>
            <DL><p>
                <DT><A HREF="https://reactnative.dev/docs/getting-started" ADD_DATE="1700000210" TAGS="react-native,docs,mobile">React Native Getting Started</A>
                <DT><A HREF="https://gluestack.io" ADD_DATE="1700000220" TAGS="react-native,mobile,components">gluestack-ui - Universal Component Library</A>
                <DT><A HREF="https://docs.swmansion.com/react-native-reanimated/" ADD_DATE="1700000230" TAGS="react-native,animations">React Native Reanimated</A>
            </DL><p>
            <DT><H3 ADD_DATE="1700000300">Icons & Graphic Assets</H3>
            <DL><p>
                <DT><A HREF="https://lucide.dev/icons" ADD_DATE="1700000310" TAGS="icons,open-source,svg">Lucide Icons - Beautiful & consistent icons</A>
                <DT><A HREF="https://hugeicons.com" ADD_DATE="1700000320" TAGS="icons,stroke,svg">Hugeicons Pro - 25,000+ UI Icons</A>
                <DT><A HREF="https://lordicon.com" ADD_DATE="1700000330" TAGS="icons,animated,lottie">Lordicon - Animated icon library</A>
            </DL><p>
            <DT><H3 ADD_DATE="1700000410" TAGS="vite,build-tools,frontend">Vite Next Generation Frontend Tooling</A>
            <DT><A HREF="https://tauri.app" ADD_DATE="1700000420" TAGS="tauri,rust,desktop">Tauri 2.0 - Build smaller, faster, and more secure desktop and mobile applications</A>
            <DT><A HREF="https://21st.dev/?utm_medium=copy&utm_source=twitter" ADD_DATE="1700000430" TAGS="duplicate-demo">21st.dev (Duplicate with tracking params)</A>
        </DL><p>
        <DT><H3 ADD_DATE="1700001000">Anime & Media</H3>
        <DL><p>
            <DT><H3 ADD_DATE="1700001100">Streaming & Tracking</H3>
            <DL><p>
                <DT><A HREF="https://myanimelist.net" ADD_DATE="1700001110" TAGS="anime,tracker,database">MyAnimeList - Anime and Manga Database</A>
                <DT><A HREF="https://anilist.co" ADD_DATE="1700001120" TAGS="anime,tracker,community">AniList - Track, discover, and share anime</A>
            </DL><p>
            <DT><H3 ADD_DATE="1700001200">Downloads & Torrents</H3>
            <DL><p>
                <DT><A HREF="https://nyaa.si" ADD_DATE="1700001210" TAGS="anime,torrent,fansubs">Nyaa Pantsu Anime Torrents</A>
                <DT><A HREF="https://subsplease.org" ADD_DATE="1700001220" TAGS="anime,fansubs,downloads">SubsPlease Anime Releases</A>
            </DL><p>
        </DL><p>
        <DT><H3 ADD_DATE="1700002000">Tools & Utilities</H3>
        <DL><p>
            <DT><A HREF="https://archive.org" ADD_DATE="1700002010" TAGS="archive,tools,historical">Internet Archive: Wayback Machine</A>
            <DT><A HREF="https://thislinkisdeadanddoesnotexist12345.com/404" ADD_DATE="1700002020" TAGS="dead-link-test">Non-Existent Dead Link (Testing 404 & Wayback Fallback)</A>
        </DL><p>
    </DL><p>
    "#;

    import_bookmarks_html(state, demo_html.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Setup SQLite DB in AppData
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("bookmanage.db");

            let db_state = DbState::new(db_path).expect("Failed to initialize SQLite database");
            app.manage(db_state);
            app.manage(ScraperState::default());
            app.manage(ModelManagerState::default());
            app.manage(WsServerState::default());

            // Initialize WebSocket bridge for Zen Browser
            ws_server::init_ws_server(app_handle.clone());

            // Windows 11 True Mica Backdrop & App Window / Taskbar Icon & Full Screen
            if let Some(window) = app.get_webview_window("main") {
                let _ = window_vibrancy::apply_mica(&window, Some(true));
                if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png")) {
                    let _ = window.set_icon(icon);
                }
                let _ = window.maximize();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sys_info::get_system_specs,
            db::db_get_folders,
            db::db_create_folder,
            db::db_update_folder,
            db::db_toggle_folder_lock,
            db::db_delete_folder,
            db::db_get_bookmarks,
            db::db_create_bookmark,
            db::db_update_bookmark,
            db::db_move_bookmark,
            db::db_delete_bookmark,
            db::db_toggle_bookmark_pin,
            db::db_get_duplicates,
            db::db_merge_duplicates,
            db::db_delete_dead_links,
            db::db_get_dead_links,
            db::db_delete_bookmarks_batch,
            db::db_mark_bookmark_live,
            db::db_get_library_stats,
            db::db_reset_library,
            db::db_delete_all_bookmarks,
            db::db_delete_all_folders,
            db::db_delete_empty_folders,
            extension_manager::get_extension_directory,
            extension_manager::open_extension_directory,
            extension_manager::launch_browser_for_extension_setup,
            extension_manager::launch_browser_with_extension,
            import_bookmarks_html,
            export_bookmarks_html,
            save_file_dialog,
            import_demo_bookmarks,
            scraper::start_background_scrape,
            scraper::check_single_bookmark_health,
            scraper::pause_background_scrape,
            scraper::resume_background_scrape,
            scraper::stop_background_scrape,
            model_manager::check_model_status,
            model_manager::download_model,
            model_manager::cancel_model_download,
            ai_engine::ai_generate_organization_plan,
            ai_engine::ai_apply_organization_plan,
            ai_engine::ai_semantic_search,
            ai_engine::ai_chat_query,
            ai_engine::ai_test_cloud_connection,
            ws_server::zen_get_sync_status,
            ws_server::zen_request_browser_sync,
            ws_server::zen_push_tree_mutations,
            browser_importer::detect_installed_browsers,
            browser_importer::import_from_browser_profile,
            browser_importer::get_default_browser,
            browser_importer::sync_default_browser,
            browser_importer::discover_all_browser_profiles,
            browser_importer::connect_and_import_profile,
            browser_importer::sync_account_to_browser,
            db::db_get_accounts,
            db::db_upsert_account,
            db::db_delete_account,
            db::db_assign_bookmark_to_account,
            db::db_remove_bookmark_from_account,
            db::db_transfer_bookmark_account,
            db::db_batch_assign_accounts,
            db::db_get_staged_mutations,
            db::db_clear_staged_mutations,
            db::db_update_bookmark_extended,
            db::db_get_tags,
            db::db_create_tag,
            db::db_update_tag,
            db::db_delete_tag,
            db::db_get_due_reminders,
            db::db_dismiss_reminder,
            db::db_check_expired_bookmarks,
            db::db_save_cover_image,
            scraper::db_fetch_website_cover,
            db::db_toggle_bookmark_favorite,
            db::db_get_lists,
            db::db_create_list,
            db::db_update_list,
            db::db_delete_list,
            db::db_add_bookmark_to_list,
            db::db_remove_bookmark_from_list,
            db::db_get_bookmark_lists,
            db::db_empty_trash,
            db::db_restore_bookmark,
            db::db_purge_bookmark,
            db::db_get_smart_list_counts,
            db::db_set_bookmark_status,
            db::db_get_ai_chat_sessions,
            db::db_create_ai_chat_session,
            db::db_rename_ai_chat_session,
            db::db_delete_ai_chat_session,
            db::db_get_ai_chat_messages,
            db::db_save_ai_chat_message,
            db::db_toggle_bookmark_hidden,
            db::db_toggle_folder_hidden,
            updater::app_download_and_install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
