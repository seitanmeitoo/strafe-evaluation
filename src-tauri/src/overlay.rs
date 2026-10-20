use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, Window};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OverlayStatePayload {
    pub is_open: bool,
    pub is_locked: bool,
}

#[derive(Default)]
pub struct OverlayState {
    pub is_locked: AtomicBool,
    pub is_open: AtomicBool,
}

#[derive(Default)]
pub struct HotkeyTracker {
    pub prev_lock_combo: bool,
    pub prev_toggle_combo: bool,
    pub prev_drill_cycle: bool,
    pub prev_drill_toggle: bool,
    pub prev_drill_reset: bool,
}

pub fn get_overlay_window(handle: &AppHandle) -> Option<Window> {
    handle.get_window("overlay")
}

pub fn set_click_through(window: &Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| format!("Failed to set ignore_cursor_events: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_LAYERED, WS_EX_TRANSPARENT};

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let hwnd_ptr = hwnd.0 as winapi::shared::windef::HWND;
                let current_ex_style = GetWindowLongPtrW(hwnd_ptr, GWL_EXSTYLE);
                let new_ex_style = if ignore {
                    current_ex_style | (WS_EX_TRANSPARENT as isize) | (WS_EX_LAYERED as isize)
                } else {
                    (current_ex_style & !(WS_EX_TRANSPARENT as isize)) | (WS_EX_LAYERED as isize)
                };
                SetWindowLongPtrW(hwnd_ptr, GWL_EXSTYLE, new_ex_style);
            }
        }
    }

    Ok(())
}

pub fn ensure_overlay_window(handle: &AppHandle) -> Result<Window, String> {
    handle
        .get_window("overlay")
        .ok_or_else(|| "Overlay window not found".to_string())
}

pub fn set_overlay_visibility(
    handle: &AppHandle,
    state: &OverlayState,
    visible: bool,
) -> Result<bool, String> {
    let window = ensure_overlay_window(handle)?;
    if visible {
        window.show().map_err(|e| e.to_string())?;
        state.is_open.store(true, Ordering::Relaxed);
    } else {
        window.hide().map_err(|e| e.to_string())?;
        state.is_open.store(false, Ordering::Relaxed);
    }

    let _ = handle.emit_all(
        "overlay-visibility-toggled",
        serde_json::json!({ "visible": visible }),
    );
    Ok(visible)
}

pub fn toggle_overlay_visibility(
    handle: &AppHandle,
    state: &OverlayState,
) -> Result<bool, String> {
    let current = state.is_open.load(Ordering::Relaxed);
    set_overlay_visibility(handle, state, !current)
}

pub fn set_overlay_lock(
    handle: &AppHandle,
    state: &OverlayState,
    locked: bool,
) -> Result<bool, String> {
    if let Some(window) = get_overlay_window(handle) {
        set_click_through(&window, locked)?;
        state.is_locked.store(locked, Ordering::Relaxed);
        let _ = handle.emit_all(
            "overlay-lock-toggled",
            serde_json::json!({ "is_locked": locked }),
        );
        Ok(locked)
    } else {
        Err("Overlay window not found".to_string())
    }
}

pub fn toggle_overlay_lock(
    handle: &AppHandle,
    state: &OverlayState,
) -> Result<bool, String> {
    let current = state.is_locked.load(Ordering::Relaxed);
    set_overlay_lock(handle, state, !current)
}

pub fn check_overlay_hotkeys(
    handle: &AppHandle,
    state: &OverlayState,
    tracker: &mut HotkeyTracker,
) {
    use inputbot::KeybdKey::*;

    let ctrl_down = LControlKey.is_pressed() || RControlKey.is_pressed();
    let f11_down = F11Key.is_pressed();
    let alt_down = LAltKey.is_pressed() || RAltKey.is_pressed();
    let o_down = OKey.is_pressed();
    let f12_down = F12Key.is_pressed();
    let f10_down = F10Key.is_pressed();
    let f9_down = F9Key.is_pressed();

    // Ctrl + F11: Toggle Click-Through Lock
    let lock_combo = ctrl_down && f11_down;
    if lock_combo && !tracker.prev_lock_combo {
        // If overlay is hidden, show and lock it; if visible, toggle lock
        if !state.is_open.load(Ordering::Relaxed) {
            let _ = set_overlay_visibility(handle, state, true);
            let _ = set_overlay_lock(handle, state, true);
        } else {
            let _ = toggle_overlay_lock(handle, state);
        }
    }
    tracker.prev_lock_combo = lock_combo;

    // Alt + O: Toggle Overlay Visibility
    let toggle_combo = alt_down && o_down;
    if toggle_combo && !tracker.prev_toggle_combo {
        let _ = toggle_overlay_visibility(handle, state);
    }
    tracker.prev_toggle_combo = toggle_combo;

    // Training drills: the front end owns the drill, Rust only reports the shortcut.
    // Function keys are used so that no shortcut collides with a movement or reload key.
    let drill_shortcuts = [
        (ctrl_down && f12_down, &mut tracker.prev_drill_cycle, "cycle"),
        (ctrl_down && f10_down, &mut tracker.prev_drill_toggle, "toggle"),
        (ctrl_down && f9_down, &mut tracker.prev_drill_reset, "reset"),
    ];
    for (combo, prev, action) in drill_shortcuts {
        if combo && !*prev {
            let _ = handle.emit_all("drill-hotkey", serde_json::json!({ "action": action }));
        }
        *prev = combo;
    }
}
