#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Arrancamos nuestro servidor Node (Sidecar) invisible
            let sidecar_command = app.shell().sidecar("backend").unwrap();
            let (_receiver, _child) = sidecar_command
                .spawn()
                .expect("Fallo al arrancar el motor de la base de datos");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}