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
    name: "Flèches (← ↑ → ↓)",
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
};

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
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      keys: {
        left: parsed.keys?.left || DEFAULT_SETTINGS.keys.left,
        right: parsed.keys?.right || DEFAULT_SETTINGS.keys.right,
        forward: parsed.keys?.forward || DEFAULT_SETTINGS.keys.forward,
        backward: parsed.keys?.backward || DEFAULT_SETTINGS.keys.backward,
      },
      perfectThresholdMs:
        typeof parsed.perfectThresholdMs === "number"
          ? parsed.perfectThresholdMs
          : DEFAULT_SETTINGS.perfectThresholdMs,
      maxStrafeMs:
        typeof parsed.maxStrafeMs === "number"
          ? parsed.maxStrafeMs
          : DEFAULT_SETTINGS.maxStrafeMs,
      visualGoals: {
        enabled:
          typeof parsed.visualGoals?.enabled === "boolean"
            ? parsed.visualGoals.enabled
            : DEFAULT_SETTINGS.visualGoals.enabled,
        earlyTargetMs:
          typeof parsed.visualGoals?.earlyTargetMs === "number"
            ? parsed.visualGoals.earlyTargetMs
            : DEFAULT_SETTINGS.visualGoals.earlyTargetMs,
        lateTargetMs:
          typeof parsed.visualGoals?.lateTargetMs === "number"
            ? parsed.visualGoals.lateTargetMs
            : DEFAULT_SETTINGS.visualGoals.lateTargetMs,
      },
    };
  } catch (err) {
    console.error("Failed to load settings from storage:", err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings to storage:", err);
  }
}
