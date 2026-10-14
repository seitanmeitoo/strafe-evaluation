use inputbot::KeybdKey;

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
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MonitoredKeys {
    pub left: String,
    pub right: String,
    pub forward: String,
    pub backward: String,
}

#[derive(Clone, Debug)]
pub struct ActiveKeyBindings {
    pub left_keys: Vec<KeybdKey>,
    pub right_keys: Vec<KeybdKey>,
    pub forward_keys: Vec<KeybdKey>,
    pub backward_keys: Vec<KeybdKey>,
    pub raw: MonitoredKeys,
}

pub fn parse_key_token(s: &str) -> Option<KeybdKey> {
    use inputbot::KeybdKey::*;
    let trimmed = s.trim();
    let upper = trimmed.to_uppercase();

    match upper.as_str() {
        "A" | "KEYA" => Some(AKey),
        "B" | "KEYB" => Some(BKey),
        "C" | "KEYC" => Some(CKey),
        "D" | "KEYD" => Some(DKey),
        "E" | "KEYE" => Some(EKey),
        "F" | "KEYF" => Some(FKey),
        "G" | "KEYG" => Some(GKey),
        "H" | "KEYH" => Some(HKey),
        "I" | "KEYI" => Some(IKey),
        "J" | "KEYJ" => Some(JKey),
        "K" | "KEYK" => Some(KKey),
        "L" | "KEYL" => Some(LKey),
        "M" | "KEYM" => Some(MKey),
        "N" | "KEYN" => Some(NKey),
        "O" | "KEYO" => Some(OKey),
        "P" | "KEYP" => Some(PKey),
        "Q" | "KEYQ" => Some(QKey),
        "R" | "KEYR" => Some(RKey),
        "S" | "KEYS" => Some(SKey),
        "T" | "KEYT" => Some(TKey),
        "U" | "KEYU" => Some(UKey),
        "V" | "KEYV" => Some(VKey),
        "W" | "KEYW" => Some(WKey),
        "X" | "KEYX" => Some(XKey),
        "Y" | "KEYY" => Some(YKey),
        "Z" | "KEYZ" => Some(ZKey),

        "ARROWLEFT" | "LEFT" | "←" => Some(LeftKey),
        "ARROWRIGHT" | "RIGHT" | "→" => Some(RightKey),
        "ARROWUP" | "UP" | "↑" => Some(UpKey),
        "ARROWDOWN" | "DOWN" | "↓" => Some(DownKey),

        "SPACE" | "SPACEBAR" => Some(SpaceKey),
        "0" | "DIGIT0" | "NUMROW0" => Some(Numrow0Key),
        "1" | "DIGIT1" | "NUMROW1" => Some(Numrow1Key),
        "2" | "DIGIT2" | "NUMROW2" => Some(Numrow2Key),
        "3" | "DIGIT3" | "NUMROW3" => Some(Numrow3Key),
        "4" | "DIGIT4" | "NUMROW4" => Some(Numrow4Key),
        "5" | "DIGIT5" | "NUMROW5" => Some(Numrow5Key),
        "6" | "DIGIT6" | "NUMROW6" => Some(Numrow6Key),
        "7" | "DIGIT7" | "NUMROW7" => Some(Numrow7Key),
        "8" | "DIGIT8" | "NUMROW8" => Some(Numrow8Key),
        "9" | "DIGIT9" | "NUMROW9" => Some(Numrow9Key),

        "NUMPAD0" => Some(Numpad0Key),
        "NUMPAD1" => Some(Numpad1Key),
        "NUMPAD2" => Some(Numpad2Key),
        "NUMPAD3" => Some(Numpad3Key),
        "NUMPAD4" => Some(Numpad4Key),
        "NUMPAD5" => Some(Numpad5Key),
        "NUMPAD6" => Some(Numpad6Key),
        "NUMPAD7" => Some(Numpad7Key),
        "NUMPAD8" => Some(Numpad8Key),
        "NUMPAD9" => Some(Numpad9Key),
        _ => None,
    }
}

impl ActiveKeyBindings {
    pub fn from_monitored_keys(raw: MonitoredKeys) -> Self {
        use inputbot::KeybdKey::*;

        let mut left_keys = Vec::new();
        if let Some(k) = parse_key_token(&raw.left) {
            left_keys.push(k);
        }
        if (raw.left.eq_ignore_ascii_case("A") || raw.left.eq_ignore_ascii_case("Q"))
            && !left_keys.contains(&LeftKey)
        {
            left_keys.push(LeftKey);
        }

        let mut right_keys = Vec::new();
        if let Some(k) = parse_key_token(&raw.right) {
            right_keys.push(k);
        }
        if raw.right.eq_ignore_ascii_case("D") && !right_keys.contains(&RightKey) {
            right_keys.push(RightKey);
        }

        let mut forward_keys = Vec::new();
        if let Some(k) = parse_key_token(&raw.forward) {
            forward_keys.push(k);
        }
        if (raw.forward.eq_ignore_ascii_case("W") || raw.forward.eq_ignore_ascii_case("Z"))
            && !forward_keys.contains(&UpKey)
        {
            forward_keys.push(UpKey);
        }

        let mut backward_keys = Vec::new();
        if let Some(k) = parse_key_token(&raw.backward) {
            backward_keys.push(k);
        }
        if raw.backward.eq_ignore_ascii_case("S") && !backward_keys.contains(&DownKey) {
            backward_keys.push(DownKey);
        }

        Self {
            left_keys,
            right_keys,
            forward_keys,
            backward_keys,
            raw,
        }
    }

    pub fn is_left_pressed(&self) -> bool {
        self.left_keys.iter().any(|k| k.is_pressed())
    }

    pub fn is_right_pressed(&self) -> bool {
        self.right_keys.iter().any(|k| k.is_pressed())
    }

    pub fn is_forward_pressed(&self) -> bool {
        self.forward_keys.iter().any(|k| k.is_pressed())
    }

    pub fn is_backward_pressed(&self) -> bool {
        self.backward_keys.iter().any(|k| k.is_pressed())
    }

    pub fn is_diagonal_pressed(&self) -> bool {
        self.is_forward_pressed() || self.is_backward_pressed()
    }
}

impl Default for ActiveKeyBindings {
    fn default() -> Self {
        let layout = detect_layout();
        let raw = match layout {
            KeyboardLayout::Azerty => MonitoredKeys {
                left: "Q".to_string(),
                right: "D".to_string(),
                forward: "Z".to_string(),
                backward: "S".to_string(),
            },
            KeyboardLayout::Qwerty => MonitoredKeys {
                left: "A".to_string(),
                right: "D".to_string(),
                forward: "W".to_string(),
                backward: "S".to_string(),
            },
        };
        Self::from_monitored_keys(raw)
    }
}

pub fn is_mouse1_pressed() -> bool {
    use inputbot::MouseButton::*;
    LeftButton.is_pressed()
}
