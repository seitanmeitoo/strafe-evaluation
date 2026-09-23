// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod keyboard;
mod tracker;

use keyboard::KeyboardLayout;
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

fn main() {
    let game_state = Arc::new(GameState::new());
    let thread_game_state = Arc::clone(&game_state);

    tauri::Builder::default()
        .manage(game_state)
        .invoke_handler(tauri::generate_handler![set_require_shot])
        .setup(move |app| {
            let handle = app.handle();

            std::thread::spawn(move || {
                let mut state = TrackerState::default();
                let layout = KeyboardLayout::detect();

                loop {
                    std::thread::sleep(Duration::from_micros(500));

                    let is_left_down = layout.is_left_pressed();
                    let is_right_down = layout.is_right_pressed();
                    let is_forward_down = layout.is_forward_pressed();
                    let is_backward_down = layout.is_backward_pressed();
                    let is_diagonal = layout.is_diagonal_pressed();
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
