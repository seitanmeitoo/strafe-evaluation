// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod keyboard;
mod tracker;

use keyboard::{ActiveKeyBindings, KeyboardLayout, MonitoredKeys};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tracker::{
    check_pending_timeout, handle_directional_keys, handle_key_presses, handle_key_releases,
    handle_mouse_input, handle_overlap_eval, GameState, TrackerState,
};

#[tauri::command]
fn set_require_shot(require_shot: bool, state: tauri::State<Arc<GameState>>) {
    state.require_shot.store(require_shot, Ordering::Relaxed);
}

#[tauri::command]
fn set_monitored_keys(keys: MonitoredKeys, state: tauri::State<Arc<GameState>>) -> Result<(), String> {
    let active = ActiveKeyBindings::from_monitored_keys(keys);
    if let Ok(mut lock) = state.key_bindings.write() {
        *lock = active;
        Ok(())
    } else {
        Err("Failed to acquire write lock on key bindings".to_string())
    }
}

#[tauri::command]
fn set_thresholds(perfect_threshold_ms: f64, max_strafe_ms: f64, state: tauri::State<Arc<GameState>>) {
    let perfect_micros = (perfect_threshold_ms.max(0.0) * 1000.0).round() as u64;
    let max_strafe_micros = (max_strafe_ms.max(10.0) * 1000.0).round() as u64;
    state.perfect_threshold_micros.store(perfect_micros, Ordering::Relaxed);
    state.max_eval_micros.store(max_strafe_micros, Ordering::Relaxed);
}

#[derive(serde::Serialize)]
struct SettingsPayload {
    keys: MonitoredKeys,
    perfect_threshold_ms: f64,
    max_strafe_ms: f64,
    require_shot: bool,
    detected_layout: String,
}

#[tauri::command]
fn get_settings(state: tauri::State<Arc<GameState>>) -> Result<SettingsPayload, String> {
    let keys = {
        let lock = state.key_bindings.read().map_err(|e| e.to_string())?;
        lock.raw.clone()
    };
    let perfect_threshold_ms = (state.perfect_threshold_micros.load(Ordering::Relaxed) as f64) / 1000.0;
    let max_strafe_ms = (state.max_eval_micros.load(Ordering::Relaxed) as f64) / 1000.0;
    let require_shot = state.require_shot.load(Ordering::Relaxed);
    let detected_layout = match KeyboardLayout::detect() {
        KeyboardLayout::Azerty => "AZERTY",
        KeyboardLayout::Qwerty => "QWERTY",
    }
    .to_string();

    Ok(SettingsPayload {
        keys,
        perfect_threshold_ms,
        max_strafe_ms,
        require_shot,
        detected_layout,
    })
}

fn main() {
    let game_state = Arc::new(GameState::new());
    let thread_game_state = Arc::clone(&game_state);

    tauri::Builder::default()
        .manage(game_state)
        .invoke_handler(tauri::generate_handler![
            set_require_shot,
            set_monitored_keys,
            set_thresholds,
            get_settings
        ])
        .setup(move |app| {
            let handle = app.handle();

            std::thread::spawn(move || {
                let mut state = TrackerState::default();

                loop {
                    std::thread::sleep(Duration::from_micros(500));

                    let (is_left_down, is_right_down, is_forward_down, is_backward_down, is_diagonal) = {
                        if let Ok(bindings) = thread_game_state.key_bindings.read() {
                            (
                                bindings.is_left_pressed(),
                                bindings.is_right_pressed(),
                                bindings.is_forward_pressed(),
                                bindings.is_backward_pressed(),
                                bindings.is_diagonal_pressed(),
                            )
                        } else {
                            (false, false, false, false, false)
                        }
                    };

                    let is_mouse_down = keyboard::is_mouse1_pressed();

                    handle_directional_keys(is_forward_down, is_backward_down, &mut state, &handle);
                    handle_mouse_input(is_mouse_down, &mut state, &thread_game_state, &handle);
                    handle_key_releases(is_left_down, is_right_down, &mut state, &handle);
                    handle_key_presses(
                        is_left_down,
                        is_right_down,
                        is_diagonal,
                        &mut state,
                        &thread_game_state,
                        &handle,
                    );
                    handle_overlap_eval(is_diagonal, &mut state, &thread_game_state, &handle);
                    check_pending_timeout(&thread_game_state, &handle);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
