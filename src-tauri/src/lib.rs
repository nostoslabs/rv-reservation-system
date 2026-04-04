use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Serialize)]
struct BetaUpdateMetadata {
    rid: u32,
    version: String,
    #[serde(rename = "currentVersion")]
    current_version: String,
    body: Option<String>,
    date: Option<String>,
    #[serde(rename = "rawJson")]
    raw_json: serde_json::Value,
}

#[tauri::command]
async fn check_beta_update(
    webview: tauri::WebviewWindow,
    endpoint: String,
) -> Result<Option<BetaUpdateMetadata>, String> {
    let app = webview.app_handle().clone();
    let url: url::Url = endpoint.parse().map_err(|e: url::ParseError| e.to_string())?;
    // Read the pubkey from the plugin config — updater_builder() doesn't
    // always inherit it correctly when endpoints are overridden.
    let pubkey = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v.get("pubkey"))
        .and_then(|v| v.as_str())
        .ok_or("No updater pubkey found in tauri.conf.json")?
        .to_string();

    let builder = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .pubkey(pubkey);
    let updater = builder.build().map_err(|e| e.to_string())?;

    let update = updater.check().await.map_err(|e| e.to_string())?;
    match update {
        Some(update) => {
            let metadata = BetaUpdateMetadata {
                rid: 0, // placeholder, set below
                version: update.version.clone(),
                current_version: update.current_version.clone(),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
                raw_json: update.raw_json.clone(),
            };
            // Store in the webview's resource table so the standard
            // plugin:updater|download_and_install command can find it.
            let rid = webview.resources_table().add(update);
            Ok(Some(BetaUpdateMetadata { rid, ..metadata }))
        }
        None => Ok(None),
    }
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
        .invoke_handler(tauri::generate_handler![check_beta_update]);

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
