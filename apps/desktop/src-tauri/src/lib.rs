mod commands;
mod quota_parse;
mod quota_poller;
mod settings;
mod supervisor;

use commands::{
    lab_accounts, lab_apply_factory_models, lab_commandcode_keys, lab_config, lab_factory_models,
    lab_factory_models_selection, lab_login, lab_logs, lab_models, lab_open_path,
    lab_quota_settings, lab_save_quota_settings, lab_status, mgmt_request, supervisor_restart,
};
use quota_poller::QuotaPollerState;
use supervisor::SupervisorState;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let supervisor = Arc::new(SupervisorState::new(app.handle().clone())?);
            app.manage(supervisor.clone());
            tauri::async_runtime::block_on(supervisor.start_background());

            let quota_poller = Arc::new(QuotaPollerState::new(app.handle().clone()));
            quota_poller.start();

            let open_item = MenuItem::with_id(app, "open", "Open DroidProxy", true, None::<&str>)?;
            let restart_item =
                MenuItem::with_id(app, "restart", "Restart Services", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &restart_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("DroidProxy")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "restart" => {
                        let state = Arc::clone(&*app.state::<Arc<SupervisorState>>());
                        tauri::async_runtime::spawn(async move {
                            if let Err(error) = state.restart().await {
                                eprintln!("tray restart failed: {error}");
                            }
                        });
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            lab_status,
            lab_config,
            lab_accounts,
            lab_logs,
            lab_models,
            lab_factory_models,
            lab_factory_models_selection,
            lab_commandcode_keys,
            lab_apply_factory_models,
            lab_login,
            lab_open_path,
            mgmt_request,
            lab_quota_settings,
            lab_save_quota_settings,
            supervisor_restart
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}