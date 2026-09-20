// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod keyboard;
mod tracker;

use keyboard::KeyboardLayout;
use std::time::Duration;
use tracker::{handle_key_presses, handle_key_releases, handle_overlap_eval, TrackerState};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            std::thread::spawn(move || {
                let mut state = TrackerState::default();
                let layout = KeyboardLayout::detect();

                loop {
                    std::thread::sleep(Duration::from_micros(500));

                    let is_left_down = layout.is_left_pressed();
                    let is_right_down = layout.is_right_pressed();

                    handle_key_releases(is_left_down, is_right_down, &mut state, &handle);
                    handle_key_presses(is_left_down, is_right_down, &mut state, &handle);
                    handle_overlap_eval(&mut state, &handle);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
