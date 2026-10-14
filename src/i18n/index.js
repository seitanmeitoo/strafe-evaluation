import { createSignal } from "solid-js";
import fr from "./fr";
import en from "./en";

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

export function setLanguage(lang) {
  if (dictionaries[lang]) {
    setLanguageSignal(lang);
  }
}

export function t(path, params = {}) {
  const lang = language();
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

  // Replace params {key}
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? params[key] : `{${key}}`;
  });
}
