import { createSignal } from "solid-js";
import fr from "./fr";
import en from "./en";
import { loadSettings, formatKeyDisplay } from "../utils/settings";

const dictionaries = { fr, en };

function detectSystemLanguage() {
  try {
    const navLang = navigator.language || navigator.userLanguage || "fr";
    if (navLang.toLowerCase().startsWith("en")) return "en";
    return "fr";
  } catch {
    return "fr";
  }
}

// Global reactive language signal
export const [language, setLanguageSignal] = createSignal(detectSystemLanguage());
export const [i18nVersion, setI18nVersion] = createSignal(0);

export function refreshI18n() {
  setI18nVersion((v) => v + 1);
}

export function setLanguage(lang) {
  if (dictionaries[lang]) {
    setLanguageSignal(lang);
  }
}

export function t(path, params = {}) {
  const lang = language();
  i18nVersion();
  const dict = dictionaries[lang] || dictionaries.fr;
  const fallback = dictionaries.fr;

  const getNested = (obj, p) => {
    return p.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  };

  let value = getNested(dict, path);
  if (value === undefined) {
    value = getNested(fallback, path);
  }

  if (typeof value !== "string") {
    return path;
  }

  // Auto-fill default left/right keys for direction filters if not provided
  if ((path === "dashboard.filterAtoD" || path === "dashboard.filterDtoA") && (!params.left || !params.right)) {
    const s = loadSettings();
    params = {
      left: formatKeyDisplay(s?.keys?.left || "A"),
      right: formatKeyDisplay(s?.keys?.right || "D"),
      ...params,
    };
  }

  // Replace params {key}
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? params[key] : `{${key}}`;
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("local-settings-updated", () => refreshI18n());
}
