use crate::keyboard::ActiveKeyBindings;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::Instant;
use tauri::{AppHandle, Manager};

pub const DEFAULT_MAX_EVAL_MICROS: u64 = 250 * 1000;
pub const DEFAULT_PERFECT_THRESHOLD_MICROS: u64 = 1600;
pub const MAX_SHOT_WINDOW_MICROS: u128 = 300 * 1000;

#[derive(Clone, serde::Serialize)]
pub struct StrafePayload {
    pub strafe_type: String,
    pub duration: u128,
    pub shot_delay: Option<u128>,
    pub movement_duration: Option<u128>,
    pub direction: String,
    pub is_diagonal: bool,
}

#[derive(Clone)]
pub struct PendingStrafe {
    pub strafe_type: String,
    pub duration: u128,
    pub timestamp: Instant,
    pub movement_duration: Option<u128>,
    pub direction: String,
    pub is_diagonal: bool,
}

pub struct GameState {
    pub pending_strafe: Mutex<Option<PendingStrafe>>,
    pub require_shot: AtomicBool,
    pub key_bindings: RwLock<ActiveKeyBindings>,
    pub perfect_threshold_micros: AtomicU64,
    pub max_eval_micros: AtomicU64,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            pending_strafe: Mutex::new(None),
            require_shot: AtomicBool::new(false),
            key_bindings: RwLock::new(ActiveKeyBindings::default()),
            perfect_threshold_micros: AtomicU64::new(DEFAULT_PERFECT_THRESHOLD_MICROS),
            max_eval_micros: AtomicU64::new(DEFAULT_MAX_EVAL_MICROS),
        }
    }
}

impl GameState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Default)]
pub struct TrackerState {
    pub left_pressed: bool,
    pub right_pressed: bool,
    pub forward_pressed: bool,
    pub backward_pressed: bool,
    pub mouse_pressed: bool,

    pub left_pressed_time: Option<Instant>,
    pub right_pressed_time: Option<Instant>,
    pub left_released_time: Option<Instant>,
    pub right_released_time: Option<Instant>,

    pub last_left_movement_duration: Option<u128>,
    pub last_right_movement_duration: Option<u128>,

    pub both_pressed_time: Option<Instant>,
    pub overlap_initial_direction: Option<&'static str>,
    pub overlap_movement_duration: Option<u128>,
    pub overlap_is_diagonal: bool,
}

fn emit_strafe(handle: &AppHandle, pending: PendingStrafe, shot_delay: Option<u128>) {
    let _ = handle.emit_all(
        "strafe",
        StrafePayload {
            strafe_type: pending.strafe_type,
            duration: pending.duration,
            shot_delay,
            movement_duration: pending.movement_duration,
            direction: pending.direction,
            is_diagonal: pending.is_diagonal,
        },
    );
}

pub fn flush_pending_strafe(game_state: &GameState, handle: &AppHandle) {
    if let Ok(mut lock) = game_state.pending_strafe.lock() {
        if let Some(pending) = lock.take() {
            if !game_state.require_shot.load(Ordering::Relaxed) {
                emit_strafe(handle, pending, None);
            }
        }
    }
}

fn register_strafe(
    strafe_type: &str,
    duration: u128,
    movement_duration: Option<u128>,
    direction: &str,
    is_diagonal: bool,
    game_state: &GameState,
    handle: &AppHandle,
) {
    flush_pending_strafe(game_state, handle);

    if let Ok(mut lock) = game_state.pending_strafe.lock() {
        *lock = Some(PendingStrafe {
            strafe_type: strafe_type.to_string(),
            duration,
            timestamp: Instant::now(),
            movement_duration,
            direction: direction.to_string(),
            is_diagonal,
        });
    }
}

pub fn check_pending_timeout(game_state: &GameState, handle: &AppHandle) {
    if let Ok(mut lock) = game_state.pending_strafe.lock() {
        if let Some(ref pending) = *lock {
            if pending.timestamp.elapsed().as_micros() >= MAX_SHOT_WINDOW_MICROS {
                let pending = lock.take().unwrap();
                if !game_state.require_shot.load(Ordering::Relaxed) {
                    emit_strafe(handle, pending, None);
                }
            }
        }
    }
}

pub fn handle_mouse_input(
    is_mouse_down: bool,
    state: &mut TrackerState,
    game_state: &GameState,
    handle: &AppHandle,
) {
    if is_mouse_down && !state.mouse_pressed {
        let now = Instant::now();
        state.mouse_pressed = true;
        let _ = handle.emit_all("mouse-pressed", ());

        if let Ok(mut lock) = game_state.pending_strafe.lock() {
            if let Some(pending) = lock.take() {
                let delay = now.duration_since(pending.timestamp).as_micros();
                if delay <= MAX_SHOT_WINDOW_MICROS {
                    emit_strafe(handle, pending, Some(delay));
                } else if !game_state.require_shot.load(Ordering::Relaxed) {
                    emit_strafe(handle, pending, None);
                }
            }
        }
    } else if !is_mouse_down && state.mouse_pressed {
        state.mouse_pressed = false;
        let _ = handle.emit_all("mouse-released", ());
    }
}

pub fn handle_directional_keys(
    is_forward_down: bool,
    is_backward_down: bool,
    state: &mut TrackerState,
    handle: &AppHandle,
) {
    if is_forward_down && !state.forward_pressed {
        state.forward_pressed = true;
        let _ = handle.emit_all("w-pressed", ());
    } else if !is_forward_down && state.forward_pressed {
        state.forward_pressed = false;
        let _ = handle.emit_all("w-released", ());
    }

    if is_backward_down && !state.backward_pressed {
        state.backward_pressed = true;
        let _ = handle.emit_all("s-pressed", ());
    } else if !is_backward_down && state.backward_pressed {
        state.backward_pressed = false;
        let _ = handle.emit_all("s-released", ());
    }
}

pub fn handle_key_releases(
    is_left_down: bool,
    is_right_down: bool,
    state: &mut TrackerState,
    handle: &AppHandle,
) {
    if state.right_pressed && !is_right_down {
        let now = Instant::now();
        state.right_pressed = false;
        let _ = handle.emit_all("d-released", ());
        state.last_right_movement_duration = state
            .right_pressed_time
            .take()
            .map(|t| now.duration_since(t).as_micros());
        state.right_released_time = Some(now);
    }

    if state.left_pressed && !is_left_down {
        let now = Instant::now();
        state.left_pressed = false;
        let _ = handle.emit_all("a-released", ());
        state.last_left_movement_duration = state
            .left_pressed_time
            .take()
            .map(|t| now.duration_since(t).as_micros());
        state.left_released_time = Some(now);
    }
}

pub fn handle_key_presses(
    is_left_down: bool,
    is_right_down: bool,
    is_diagonal: bool,
    state: &mut TrackerState,
    game_state: &GameState,
    handle: &AppHandle,
) {
    if is_left_down && !state.left_pressed {
        let now = Instant::now();
        state.left_pressed = true;
        state.left_pressed_time = Some(now);
        state.left_released_time = None;
        let _ = handle.emit_all("a-pressed", ());

        let prev = state.right_released_time.take();
        if !is_right_down {
            if let Some(prev) = prev {
                let elapsed = now.duration_since(prev);
                eval_understrafe(
                    elapsed.as_micros(),
                    state.last_right_movement_duration,
                    "RightToLeft",
                    is_diagonal,
                    game_state,
                    handle,
                );
            }
        }
    }

    if is_right_down && !state.right_pressed {
        let now = Instant::now();
        state.right_pressed = true;
        state.right_pressed_time = Some(now);
        state.right_released_time = None;
        let _ = handle.emit_all("d-pressed", ());

        let prev = state.left_released_time.take();
        if !is_left_down {
            if let Some(prev) = prev {
                let elapsed = now.duration_since(prev);
                eval_understrafe(
                    elapsed.as_micros(),
                    state.last_left_movement_duration,
                    "LeftToRight",
                    is_diagonal,
                    game_state,
                    handle,
                );
            }
        }
    }
}

fn eval_understrafe(
    time_passed: u128,
    movement_duration: Option<u128>,
    direction: &str,
    is_diagonal: bool,
    game_state: &GameState,
    handle: &AppHandle,
) {
    let max_eval = game_state.max_eval_micros.load(Ordering::Relaxed) as u128;
    let perfect_thresh = game_state.perfect_threshold_micros.load(Ordering::Relaxed) as u128;

    if time_passed < max_eval && time_passed > perfect_thresh {
        register_strafe(
            "Early",
            time_passed,
            movement_duration,
            direction,
            is_diagonal,
            game_state,
            handle,
        );
    } else if time_passed <= perfect_thresh {
        register_strafe(
            "Perfect",
            0,
            movement_duration,
            direction,
            is_diagonal,
            game_state,
            handle,
        );
    }
}

pub fn handle_overlap_eval(
    is_diagonal: bool,
    state: &mut TrackerState,
    game_state: &GameState,
    handle: &AppHandle,
) {
    let now = Instant::now();

    if state.left_pressed && state.right_pressed && state.both_pressed_time.is_none() {
        state.both_pressed_time = Some(now);
        state.overlap_is_diagonal = is_diagonal;

        // Determine which key was pressed first to know transition direction
        let left_t = state.left_pressed_time;
        let right_t = state.right_pressed_time;
        match (left_t, right_t) {
            (Some(lt), Some(rt)) => {
                if lt <= rt {
                    state.overlap_initial_direction = Some("LeftToRight");
                    state.overlap_movement_duration = Some(rt.duration_since(lt).as_micros());
                } else {
                    state.overlap_initial_direction = Some("RightToLeft");
                    state.overlap_movement_duration = Some(lt.duration_since(rt).as_micros());
                }
            }
            (Some(_), None) => {
                state.overlap_initial_direction = Some("LeftToRight");
                state.overlap_movement_duration = None;
            }
            (None, Some(_)) => {
                state.overlap_initial_direction = Some("RightToLeft");
                state.overlap_movement_duration = None;
            }
            (None, None) => {
                state.overlap_initial_direction = Some("LeftToRight");
                state.overlap_movement_duration = None;
            }
        }
    }

    if (!state.left_pressed || !state.right_pressed) && state.both_pressed_time.is_some() {
        if let Some(start) = state.both_pressed_time.take() {
            state.left_released_time = None;
            state.right_released_time = None;
            let time_passed = now.duration_since(start).as_micros();
            let max_eval = game_state.max_eval_micros.load(Ordering::Relaxed) as u128;
            let perfect_thresh = game_state.perfect_threshold_micros.load(Ordering::Relaxed) as u128;

            if time_passed < max_eval {
                let direction = state.overlap_initial_direction.unwrap_or("LeftToRight");
                let movement_duration = state.overlap_movement_duration;
                let was_diag = state.overlap_is_diagonal || is_diagonal;

                if time_passed <= perfect_thresh {
                    register_strafe(
                        "Perfect",
                        0,
                        movement_duration,
                        direction,
                        was_diag,
                        game_state,
                        handle,
                    );
                } else {
                    register_strafe(
                        "Late",
                        time_passed,
                        movement_duration,
                        direction,
                        was_diag,
                        game_state,
                        handle,
                    );
                }
            }
        }
    }
}
