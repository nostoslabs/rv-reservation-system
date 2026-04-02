use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

struct BetaUpdate(Mutex<Option<tauri_plugin_updater::Update>>);

#[derive(serde::Serialize)]
struct BetaUpdateInfo {
    version: String,
    body: Option<String>,
}

#[tauri::command]
async fn check_beta_update(
    app: tauri::AppHandle,
    endpoint: String,
) -> Result<Option<BetaUpdateInfo>, String> {
    let url: url::Url = endpoint.parse().map_err(|e: url::ParseError| e.to_string())?;
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let update = updater.check().await.map_err(|e| e.to_string())?;
    match update {
        Some(update) => {
            let info = BetaUpdateInfo {
                version: update.version.clone(),
                body: update.body.clone(),
            };
            *app.state::<BetaUpdate>().0.lock().unwrap() = Some(update);
            Ok(Some(info))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn install_beta_update(app: tauri::AppHandle) -> Result<(), String> {
    let update = app
        .state::<BetaUpdate>()
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or("No pending beta update")?;

    update
        .download_and_install(|_bytes, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(BetaUpdate(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_beta_update,
            install_beta_update
        ]);

    #[cfg(feature = "mcp")]
    {
        builder = builder.plugin(tauri_plugin_mcp::init_with_config(
            tauri_plugin_mcp::PluginConfig::new("rv-reservation-system".to_string())
                .start_socket_server(true)
                .socket_path("/tmp/tauri-mcp.sock".into()),
        ));
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
