#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

struct SidecarState(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let sidecar_cmd = app
                .handle()
                .shell()
                .sidecar("autostock-backend")
                .map_err(|e| format!("Sidecar no encontrado: {e}"))?;

            let (mut _rx, child) = sidecar_cmd
                .spawn()
                .map_err(|e| format!("Error al iniciar backend: {e}"))?;

            app.manage(SidecarState(Mutex::new(Some(child))));

            // En debug: redirige stdout/stderr del sidecar a la consola de Tauri
            #[cfg(debug_assertions)]
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(ev) = _rx.recv().await {
                    match ev {
                        CommandEvent::Stdout(b) =>
                            print!("[backend] {}", String::from_utf8_lossy(&b)),
                        CommandEvent::Stderr(b) =>
                            eprint!("[backend:err] {}", String::from_utf8_lossy(&b)),
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al construir app")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(child) = app
                    .state::<SidecarState>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        });
}
