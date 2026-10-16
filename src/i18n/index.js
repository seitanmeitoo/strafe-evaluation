import { createSignal } from "solid-js";
import en from "./en";
import { loadSettings, formatKeyDisplay } from "../utils/settings";

export const [i18nVersion, setI18nVersion] = createSignal(0);

export function refreshI18n() {
  setI18nVersion((v) => v + 1);
}

export function t(path, params = {}) {
  i18nVersion();

  const getNested = (obj, p) => {
    return p.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  };

  let value = getNested(en, path);

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
