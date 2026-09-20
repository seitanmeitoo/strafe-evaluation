use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager};

const MAX_EVAL_MICROS: u128 = 200 * 1000;
const PERFECT_THRESHOLD_MICROS: u128 = 1600;

#[derive(Clone, serde::Serialize)]
pub struct StrafePayload {
    pub strafe_type: String,
    pub duration: u128,
}

#[derive(Default)]
pub struct TrackerState {
    pub left_pressed: bool,
    pub right_pressed: bool,
    pub both_pressed_time: Option<SystemTime>,
    pub right_released_time: Option<SystemTime>,
    pub left_released_time: Option<SystemTime>,
}

fn eval_understrafe(elapsed: Duration, handle: &AppHandle) {
    let time_passed = elapsed.as_micros();
    if time_passed < MAX_EVAL_MICROS && time_passed > PERFECT_THRESHOLD_MICROS {
        let _ = handle.emit_all(
            "strafe",
            StrafePayload {
                strafe_type: "Early".into(),
                duration: time_passed,
            },
        );
    } else if time_passed <= PERFECT_THRESHOLD_MICROS {
        let _ = handle.emit_all(
            "strafe",
            StrafePayload {
                strafe_type: "Perfect".into(),
                duration: 0,
            },
        );
    }
}

fn eval_overstrafe(elapsed: Duration, handle: &AppHandle) {
    let time_passed = elapsed.as_micros();
    if time_passed < MAX_EVAL_MICROS {
        let _ = handle.emit_all(
            "strafe",
            StrafePayload {
                strafe_type: "Late".into(),
                duration: time_passed,
            },
        );
    }
}

pub fn handle_key_releases(
    is_left_down: bool,
    is_right_down: bool,
    state: &mut TrackerState,
    handle: &AppHandle,
) {
    if state.right_pressed && !is_right_down {
        state.right_pressed = false;
        let _ = handle.emit_all("d-released", ());
        state.right_released_time = Some(SystemTime::now());
    }

    if state.left_pressed && !is_left_down {
        state.left_pressed = false;
        let _ = handle.emit_all("a-released", ());
        state.left_released_time = Some(SystemTime::now());
    }
}

pub fn handle_key_presses(
    is_left_down: bool,
    is_right_down: bool,
    state: &mut TrackerState,
    handle: &AppHandle,
) {
    if is_left_down && !state.left_pressed {
        state.left_pressed = true;
        let _ = handle.emit_all("a-pressed", ());
        if let Some(prev) = state.right_released_time.take() {
            if let Ok(elapsed) = prev.elapsed() {
                eval_understrafe(elapsed, handle);
            }
        }
    }

    if is_right_down && !state.right_pressed {
        state.right_pressed = true;
        let _ = handle.emit_all("d-pressed", ());
        if let Some(prev) = state.left_released_time.take() {
            if let Ok(elapsed) = prev.elapsed() {
                eval_understrafe(elapsed, handle);
            }
        }
    }
}

pub fn handle_overlap_eval(state: &mut TrackerState, handle: &AppHandle) {
    if state.left_pressed && state.right_pressed && state.both_pressed_time.is_none() {
        state.both_pressed_time = Some(SystemTime::now());
    }

    if (!state.left_pressed || !state.right_pressed) && state.both_pressed_time.is_some() {
        if let Some(start) = state.both_pressed_time.take() {
            if let Ok(elapsed) = start.elapsed() {
                eval_overstrafe(elapsed, handle);
            }
        }
    }
}
