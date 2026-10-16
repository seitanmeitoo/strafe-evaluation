export const PRESETS = {
  qwerty: {
    name: "QWERTY (WASD)",
    keys: { left: "A", right: "D", forward: "W", backward: "S" },
  },
  azerty: {
    name: "AZERTY (ZQSD)",
    keys: { left: "Q", right: "D", forward: "Z", backward: "S" },
  },
  arrows: {
    name: "Arrows (← ↑ → ↓)",
    keys: {
      left: "ArrowLeft",
      right: "ArrowRight",
      forward: "ArrowUp",
      backward: "ArrowDown",
    },
  },
  esdf: {
    name: "ESDF",
    keys: { left: "S", right: "F", forward: "E", backward: "D" },
  },
};

export const COLORBLIND_PALETTES = {
  default: {
    id: "default",
    name: "Standard",
    early: "#38bdf8",   // Cyan / Sky
    late: "#fb923c",    // Orange / Amber
    perfect: "#34d399", // Emerald
  },
  deuteranopia: {
    id: "deuteranopia",
    name: "Deuteranopia",
    early: "#2563eb",   // Cobalt Blue
    late: "#f59e0b",    // Amber Gold
    perfect: "#c084fc", // Bright Purple / Violet
  },
  protanopia: {
    id: "protanopia",
    name: "Protanopia",
    early: "#1d4ed8",   // Deep Blue
    late: "#eab308",    // Bright Yellow
    perfect: "#f43f5e", // Magenta / Rose
  },
  tritanopia: {
    id: "tritanopia",
    name: "Tritanopia",
    early: "#06b6d4",   // Cyan / Teal
    late: "#ef4444",    // Bright Red
    perfect: "#10b981", // Emerald
  },
  highContrast: {
    id: "highContrast",
    name: "High contrast",
    early: "#38bdf8",   // Sky
    late: "#f97316",    // Bright Orange
    perfect: "#ffffff", // Pure White
  },
};

export const STRAFE_SYMBOLS = {
  early: "◀",
  late: "▶",
  perfect: "★",
};

export function getStrafeColors(colorblindMode = "default") {
  return COLORBLIND_PALETTES[colorblindMode] || COLORBLIND_PALETTES.default;
}

export const STRAFE_COLORS = COLORBLIND_PALETTES.default;

export const RAPID_TRIGGER_PRESET = {
  perfectThresholdMs: 1.0,
  maxStrafeMs: 200,
  visualGoals: {
    enabled: true,
    earlyTargetMs: 10,
    lateTargetMs: 12,
  },
};

export const DEFAULT_SETTINGS = {
  keys: {
    left: "A",
    right: "D",
    forward: "W",
    backward: "S",
  },
  perfectThresholdMs: 1.6,
  maxStrafeMs: 250,
  visualGoals: {
    enabled: true,
    earlyTargetMs: 15,
    lateTargetMs: 20,
  },
  theme: "dark",
  language: "fr",
  colorblindMode: "default",
  audio: {
    enabled: true,
    volume: 0.5,
  },
  overlay: {
    opacity: 0.85,
    autoStart: false,
  },
};

export const SETTINGS_BOUNDS = {
  perfectThresholdMs: { min: 0.0, max: 10.0, default: 1.6 },
  maxStrafeMs: { min: 50, max: 500, default: 250 },
  earlyTargetMs: { min: 1, max: 100, default: 15 },
  lateTargetMs: { min: 1, max: 100, default: 20 },
  audioVolume: { min: 0.0, max: 1.0, default: 0.5 },
  overlayOpacity: { min: 0.3, max: 1.0, default: 0.85 },
};

export function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function normalizeKey(key) {
  if (!key) return null;
  const str = String(key).trim();
  if (str === " " || str.toLowerCase() === "space" || str.toLowerCase() === "spacebar") return "Space";
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(str)) {
    return str;
  }
  if (str.length === 1) {
    const upper = str.toUpperCase();
    if ((upper >= "A" && upper <= "Z") || (upper >= "0" && upper <= "9")) {
      return upper;
    }
  }
  if (str.toUpperCase().startsWith("NUMPAD") && str.length === 7) {
    const d = str.slice(6);
    if (d >= "0" && d <= "9") {
      return `Numpad${d}`;
    }
  }
  return null;
}

export function cloneSettings(s) {
  return {
    keys: { ...(s?.keys || DEFAULT_SETTINGS.keys) },
    perfectThresholdMs: s?.perfectThresholdMs ?? DEFAULT_SETTINGS.perfectThresholdMs,
    maxStrafeMs: s?.maxStrafeMs ?? DEFAULT_SETTINGS.maxStrafeMs,
    visualGoals: { ...(s?.visualGoals || DEFAULT_SETTINGS.visualGoals) },
    theme: s?.theme || DEFAULT_SETTINGS.theme,
    language: s?.language || DEFAULT_SETTINGS.language,
    colorblindMode: s?.colorblindMode || DEFAULT_SETTINGS.colorblindMode,
    audio: { ...(s?.audio || DEFAULT_SETTINGS.audio) },
    overlay: { ...(s?.overlay || DEFAULT_SETTINGS.overlay) },
  };
}

const STORAGE_KEY = "strafe_evaluation_settings";

export function formatKeyDisplay(key) {
  if (!key) return "?";
  const upper = String(key).trim().toUpperCase();
  switch (upper) {
    case "ARROWLEFT":
    case "LEFT":
    case "←":
      return "←";
    case "ARROWRIGHT":
    case "RIGHT":
    case "→":
      return "→";
    case "ARROWUP":
    case "UP":
    case "↑":
      return "↑";
    case "ARROWDOWN":
    case "DOWN":
    case "↓":
      return "↓";
    case " ":
    case "SPACE":
    case "SPACEBAR":
      return "SPC";
    default:
      if (upper.startsWith("KEY")) return upper.replace("KEY", "");
      if (upper.startsWith("DIGIT")) return upper.replace("DIGIT", "");
      if (upper.startsWith("NUMPAD")) return "NUM" + upper.replace("NUMPAD", "");
      return upper.length > 4 ? upper.slice(0, 4) : upper;
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSettings(DEFAULT_SETTINGS);

    const parsed = JSON.parse(raw);

    const left = normalizeKey(parsed.keys?.left) || DEFAULT_SETTINGS.keys.left;
    const right = normalizeKey(parsed.keys?.right) || DEFAULT_SETTINGS.keys.right;
    const forward = normalizeKey(parsed.keys?.forward) || DEFAULT_SETTINGS.keys.forward;
    const backward = normalizeKey(parsed.keys?.backward) || DEFAULT_SETTINGS.keys.backward;

    // Verify uniqueness of directions
    const keySet = new Set([left, right, forward, backward]);
    const finalKeys = keySet.size === 4
      ? { left, right, forward, backward }
      : { ...DEFAULT_SETTINGS.keys };

    return {
      keys: finalKeys,
      perfectThresholdMs: clampNumber(
        parsed.perfectThresholdMs,
        SETTINGS_BOUNDS.perfectThresholdMs.min,
        SETTINGS_BOUNDS.perfectThresholdMs.max,
        DEFAULT_SETTINGS.perfectThresholdMs
      ),
      maxStrafeMs: clampNumber(
        parsed.maxStrafeMs,
        SETTINGS_BOUNDS.maxStrafeMs.min,
        SETTINGS_BOUNDS.maxStrafeMs.max,
        DEFAULT_SETTINGS.maxStrafeMs
      ),
      visualGoals: {
        enabled: typeof parsed.visualGoals?.enabled === "boolean"
          ? parsed.visualGoals.enabled
          : DEFAULT_SETTINGS.visualGoals.enabled,
        earlyTargetMs: clampNumber(
          parsed.visualGoals?.earlyTargetMs,
          SETTINGS_BOUNDS.earlyTargetMs.min,
          SETTINGS_BOUNDS.earlyTargetMs.max,
          DEFAULT_SETTINGS.visualGoals.earlyTargetMs
        ),
        lateTargetMs: clampNumber(
          parsed.visualGoals?.lateTargetMs,
          SETTINGS_BOUNDS.lateTargetMs.min,
          SETTINGS_BOUNDS.lateTargetMs.max,
          DEFAULT_SETTINGS.visualGoals.lateTargetMs
        ),
      },
      theme: parsed.theme === "light" ? "light" : "dark",
      language: parsed.language === "en" ? "en" : "fr",
      colorblindMode: COLORBLIND_PALETTES[parsed.colorblindMode]
        ? parsed.colorblindMode
        : DEFAULT_SETTINGS.colorblindMode,
      audio: {
        enabled: typeof parsed.audio?.enabled === "boolean"
          ? parsed.audio.enabled
          : DEFAULT_SETTINGS.audio.enabled,
        volume: clampNumber(
          parsed.audio?.volume,
          SETTINGS_BOUNDS.audioVolume.min,
          SETTINGS_BOUNDS.audioVolume.max,
          DEFAULT_SETTINGS.audio.volume
        ),
      },
      overlay: {
        opacity: clampNumber(
          parsed.overlay?.opacity,
          SETTINGS_BOUNDS.overlayOpacity.min,
          SETTINGS_BOUNDS.overlayOpacity.max,
          DEFAULT_SETTINGS.overlay.opacity
        ),
        autoStart: typeof parsed.overlay?.autoStart === "boolean"
          ? parsed.overlay.autoStart
          : DEFAULT_SETTINGS.overlay.autoStart,
      },
    };
  } catch (err) {
    console.error("Failed to load settings from storage:", err);
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("local-settings-updated", { detail: settings }));
    }
  } catch (err) {
    console.error("Failed to save settings to storage:", err);
  }
}
