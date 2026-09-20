#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardLayout {
    Qwerty,
    Azerty,
}

#[cfg(target_os = "windows")]
fn detect_layout() -> KeyboardLayout {
    use winapi::um::winuser::GetKeyboardLayout;
    unsafe {
        let layout = GetKeyboardLayout(0);
        let layout_id = (layout as usize & 0xFFFF) as u32;
        if matches!(layout_id, 0x040C | 0x080C | 0x140C | 0x180C) {
            KeyboardLayout::Azerty
        } else {
            KeyboardLayout::Qwerty
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn detect_layout() -> KeyboardLayout {
    KeyboardLayout::Qwerty
}

impl KeyboardLayout {
    pub fn detect() -> Self {
        detect_layout()
    }

    pub fn is_left_pressed(&self) -> bool {
        use inputbot::KeybdKey::*;
        match self {
            KeyboardLayout::Azerty => QKey.is_pressed() || LeftKey.is_pressed(),
            KeyboardLayout::Qwerty => AKey.is_pressed() || LeftKey.is_pressed(),
        }
    }

    pub fn is_right_pressed(&self) -> bool {
        use inputbot::KeybdKey::*;
        DKey.is_pressed() || RightKey.is_pressed()
    }
}
