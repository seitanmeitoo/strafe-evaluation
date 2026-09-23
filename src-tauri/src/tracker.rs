use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{AppHandle, Manager};

pub const MAX_EVAL_MICROS: u128 = 200 * 1000;
pub const PERFECT_THRESHOLD_MICROS: u128 = 1600;
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
    pub timestamp: SystemTime,
    pub movement_duration: Option<u128>,
    pub direction: String,
    pub is_diagonal: bool,
}

pub struct GameState {
    pub pending_strafe: Mutex<Option<PendingStrafe>>,
    pub require_shot: AtomicBool,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            pending_strafe: Mutex::new(None),
            require_shot: AtomicBool::new(false),
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

    pub left_pressed_time: Option<SystemTime>,
    pub right_pressed_time: Option<SystemTime>,
    pub left_released_time: Option<SystemTime>,
    pub right_released_time: Option<SystemTime>,

    pub last_left_movement_duration: Option<u128>,
    pub last_right_movement_duration: Option<u128>,

    pub both_pressed_time: Option<SystemTime>,
    pub overlap_initial_direction: Option<&'static str>,
    pub overlap_movement_duration: Option<u128>,
    pub overlap_is_diagonal: bool,
}

pub fn flush_pending_strafe(game_state: &GameState, handle: &AppHandle) {
    if let Ok(mut lock) = game_state.pending_strafe.lock() {
        if let Some(pending) = lock.take() {
            if !game_state.require_shot.load(Ordering::Relaxed) {
                let _ = handle.emit_all(
                    "strafe",
                    StrafePayload {
                        strafe_type: pending.strafe_type,
                        duration: pending.duration,
                        shot_delay: None,
                        movement_duration: pending.movement_duration,
                        direction: pending.direction,
                        is_diagonal: pending.is_diagonal,
                    },
                );
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
            timestamp: SystemTime::now(),
            movement_duration,
            direction: direction.to_string(),
            is_diagonal,
        });
    }
}

pub fn check_pending_timeout(game_state: &GameState, handle: &AppHandle) {
    if let Ok(mut lock) = game_state.pending_strafe.lock() {
        if let Some(ref pending) = *lock {
            if pending.timestamp.elapsed().unwrap_or_default().as_micros() >= MAX_SHOT_WINDOW_MICROS {
                let pending = lock.take().unwrap();
                if !game_state.require_shot.load(Ordering::Relaxed) {
                    let _ = handle.emit_all(
                        "strafe",
                        StrafePayload {
                            strafe_type: pending.strafe_type,
                            duration: pending.duration,
                            shot_delay: None,
                            movement_duration: pending.movement_duration,
                            direction: pending.direction,
                            is_diagonal: pending.is_diagonal,
                        },
                    );
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
        state.mouse_pressed = true;
        let _ = handle.emit_all("mouse-pressed", ());

        if let Ok(mut lock) = game_state.pending_strafe.lock() {
            if let Some(pending) = lock.take() {
                let delay = pending.timestamp.elapsed().unwrap_or_default().as_micros();
                if delay <= MAX_SHOT_WINDOW_MICROS {
                    let _ = handle.emit_all(
                        "strafe",
                        StrafePayload {
                            strafe_type: pending.strafe_type,
                            duration: pending.duration,
                            shot_delay: Some(delay),
                            movement_duration: pending.movement_duration,
                            direction: pending.direction,
                            is_diagonal: pending.is_diagonal,
                        },
                    );
                } else if !game_state.require_shot.load(Ordering::Relaxed) {
                    let _ = handle.emit_all(
                        "strafe",
                        StrafePayload {
                            strafe_type: pending.strafe_type,
                            duration: pending.duration,
                            shot_delay: None,
                            movement_duration: pending.movement_duration,
                            direction: pending.direction,
                            is_diagonal: pending.is_diagonal,
                        },
                    );
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
        state.right_pressed = false;
        let _ = handle.emit_all("d-released", ());
        let now = SystemTime::now();
        state.last_right_movement_duration = state
            .right_pressed_time
            .take()
            .and_then(|t| t.elapsed().ok())
            .map(|d| d.as_micros());
        state.right_released_time = Some(now);
    }

    if state.left_pressed && !is_left_down {
        state.left_pressed = false;
        let _ = handle.emit_all("a-released", ());
        let now = SystemTime::now();
        state.last_left_movement_duration = state
            .left_pressed_time
            .take()
            .and_then(|t| t.elapsed().ok())
            .map(|d| d.as_micros());
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
        state.left_pressed = true;
        state.left_pressed_time = Some(SystemTime::now());
        let _ = handle.emit_all("a-pressed", ());

        if let Some(prev) = state.right_released_time.take() {
            if let Ok(elapsed) = prev.elapsed() {
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
        state.right_pressed = true;
        state.right_pressed_time = Some(SystemTime::now());
        let _ = handle.emit_all("d-pressed", ());

        if let Some(prev) = state.left_released_time.take() {
            if let Ok(elapsed) = prev.elapsed() {
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
    if time_passed < MAX_EVAL_MICROS && time_passed > PERFECT_THRESHOLD_MICROS {
        register_strafe(
            "Early",
            time_passed,
            movement_duration,
            direction,
            is_diagonal,
            game_state,
            handle,
        );
    } else if time_passed <= PERFECT_THRESHOLD_MICROS {
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
    if state.left_pressed && state.right_pressed && state.both_pressed_time.is_none() {
        state.both_pressed_time = Some(SystemTime::now());
        state.overlap_is_diagonal = is_diagonal;

        // Determine which key was pressed first to know transition direction
        let left_t = state.left_pressed_time;
        let right_t = state.right_pressed_time;
        match (left_t, right_t) {
            (Some(lt), Some(rt)) => {
                if lt <= rt {
                    state.overlap_initial_direction = Some("LeftToRight");
                    state.overlap_movement_duration = rt.duration_since(lt).ok().map(|d| d.as_micros());
                } else {
                    state.overlap_initial_direction = Some("RightToLeft");
                    state.overlap_movement_duration = lt.duration_since(rt).ok().map(|d| d.as_micros());
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
            if let Ok(elapsed) = start.elapsed() {
                let time_passed = elapsed.as_micros();
                if time_passed < MAX_EVAL_MICROS {
                    let direction = state.overlap_initial_direction.unwrap_or("LeftToRight");
                    let movement_duration = state.overlap_movement_duration;
                    let was_diag = state.overlap_is_diagonal || is_diagonal;

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
