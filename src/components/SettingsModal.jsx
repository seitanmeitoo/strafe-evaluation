import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { PRESETS, DEFAULT_SETTINGS, formatKeyDisplay } from "../utils/settings";
import { playStrafeSound } from "../utils/audio";

export default function SettingsModal(props) {
  const [keys, setKeys] = createSignal({ ...DEFAULT_SETTINGS.keys });
  const [perfectThresholdMs, setPerfectThresholdMs] = createSignal(
    DEFAULT_SETTINGS.perfectThresholdMs
  );
  const [maxStrafeMs, setMaxStrafeMs] = createSignal(
    DEFAULT_SETTINGS.maxStrafeMs
  );
  const [goalsEnabled, setGoalsEnabled] = createSignal(
    DEFAULT_SETTINGS.visualGoals.enabled
  );
  const [earlyTargetMs, setEarlyTargetMs] = createSignal(
    DEFAULT_SETTINGS.visualGoals.earlyTargetMs
  );
  const [lateTargetMs, setLateTargetMs] = createSignal(
    DEFAULT_SETTINGS.visualGoals.lateTargetMs
  );
  const [theme, setTheme] = createSignal(DEFAULT_SETTINGS.theme);
  const [audioEnabled, setAudioEnabled] = createSignal(
    DEFAULT_SETTINGS.audio.enabled
  );
  const [audioVolume, setAudioVolume] = createSignal(
    DEFAULT_SETTINGS.audio.volume
  );
  const [activeRebind, setActiveRebind] = createSignal(null);

  // Sync state whenever modal is opened
  createEffect(() => {
    if (props.isOpen && props.currentSettings) {
      const s = props.currentSettings;
      setKeys({ ...s.keys });
      setPerfectThresholdMs(s.perfectThresholdMs);
      setMaxStrafeMs(s.maxStrafeMs);
      setGoalsEnabled(Boolean(s.visualGoals?.enabled));
      setEarlyTargetMs(s.visualGoals?.earlyTargetMs ?? 15);
      setLateTargetMs(s.visualGoals?.lateTargetMs ?? 20);
      setTheme(s.theme || "dark");
      setAudioEnabled(
        typeof s.audio?.enabled === "boolean" ? s.audio.enabled : true
      );
      setAudioVolume(typeof s.audio?.volume === "number" ? s.audio.volume : 0.5);
      setActiveRebind(null);
    }
  });

  // Key capture listener when rebinding
  createEffect(() => {
    const rebindingDirection = activeRebind();
    if (!rebindingDirection) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setActiveRebind(null);
        return;
      }

      let captured = e.key;
      if (captured.startsWith("Arrow")) {
        // Keep ArrowLeft, ArrowRight, etc.
      } else if (captured === " ") {
        captured = "Space";
      } else if (captured.length === 1) {
        captured = captured.toUpperCase();
      }

      setKeys((prev) => ({
        ...prev,
        [rebindingDirection]: captured,
      }));
      setActiveRebind(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    });
  });

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (preset) {
      setKeys({ ...preset.keys });
    }
  }

  function handleReset() {
    setKeys({ ...DEFAULT_SETTINGS.keys });
    setPerfectThresholdMs(DEFAULT_SETTINGS.perfectThresholdMs);
    setMaxStrafeMs(DEFAULT_SETTINGS.maxStrafeMs);
    setGoalsEnabled(DEFAULT_SETTINGS.visualGoals.enabled);
    setEarlyTargetMs(DEFAULT_SETTINGS.visualGoals.earlyTargetMs);
    setLateTargetMs(DEFAULT_SETTINGS.visualGoals.lateTargetMs);
    setTheme(DEFAULT_SETTINGS.theme);
    setAudioEnabled(DEFAULT_SETTINGS.audio.enabled);
    setAudioVolume(DEFAULT_SETTINGS.audio.volume);
    setActiveRebind(null);
  }

  function handleSave() {
    props.onSave({
      keys: keys(),
      perfectThresholdMs: Math.max(0, Number(perfectThresholdMs()) || 0),
      maxStrafeMs: Math.max(50, Number(maxStrafeMs()) || 250),
      visualGoals: {
        enabled: goalsEnabled(),
        earlyTargetMs: Math.max(1, Number(earlyTargetMs()) || 15),
        lateTargetMs: Math.max(1, Number(lateTargetMs()) || 20),
      },
      theme: theme(),
      audio: {
        enabled: audioEnabled(),
        volume: Math.min(1, Math.max(0, Number(audioVolume()) || 0)),
      },
    });
    props.onClose();
  }

  function testSound(type) {
    playStrafeSound(type, audioVolume());
  }

  return (
    <Show when={props.isOpen}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setActiveRebind(null);
            props.onClose();
          }
        }}
      >
        <div className="bg-[#1e293b] text-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                Paramètres & Tolérances
              </h2>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={props.onClose}
              title="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Modal body */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-130px)] text-sm">
            {/* Theme & Display section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  Thème Visuel
                </label>
                <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 text-xs">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      theme() === "dark"
                        ? "bg-sky-500 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    🌙 Sombre
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      theme() === "light"
                        ? "bg-sky-500 text-white font-bold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    ☀️ Clair
                  </button>
                </div>
              </div>
            </div>

            {/* Audio Feedback section */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  Retours Sonores (Web Audio)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={audioEnabled()}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className="accent-sky-500 rounded cursor-pointer"
                  />
                  <span>Activer les bips</span>
                </label>
              </div>

              <Show when={audioEnabled()}>
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-300">Volume sonore</span>
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {Math.round(audioVolume() * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full accent-sky-500 cursor-pointer"
                    value={audioVolume()}
                    onInput={(e) => setAudioVolume(parseFloat(e.target.value) || 0)}
                  />

                  {/* Audio preview buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">Tester :</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Perfect")}
                      >
                        ✨ Perfect
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs hover:bg-sky-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Early")}
                      >
                        ⏱️ Early
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs hover:bg-amber-500/30 cursor-pointer transition-all"
                        onClick={() => testSound("Late")}
                      >
                        ⏱️ Late
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* Section 1: Key Rebinding */}
            <div className="border-t border-slate-700/60 pt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  Touches de déplacement (WASD / Flèches)
                </label>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {Object.entries(PRESETS).map(([id, p]) => (
                  <button
                    type="button"
                    className="py-1.5 px-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-white border border-slate-700 transition-all cursor-pointer text-center"
                    onClick={() => applyPreset(id)}
                  >
                    {p.name.split(" ")[0]}
                  </button>
                ))}
              </div>

              {/* Rebind interactive buttons */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center gap-2">
                {/* Forward key */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-400 mb-1">Avant</span>
                  <button
                    type="button"
                    className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                      activeRebind() === "forward"
                        ? "bg-sky-500 text-white border-white animate-pulse ring-2 ring-sky-400"
                        : "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                    }`}
                    onClick={() => setActiveRebind("forward")}
                    title="Cliquez pour changer la touche Avant"
                  >
                    {activeRebind() === "forward"
                      ? "..."
                      : formatKeyDisplay(keys().forward)}
                  </button>
                </div>

                {/* Left, Backward, Right */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 mb-1">Gauche</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "left"
                          ? "bg-sky-500 text-white border-white animate-pulse ring-2 ring-sky-400"
                          : "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                      }`}
                      onClick={() => setActiveRebind("left")}
                      title="Cliquez pour changer la touche Gauche"
                    >
                      {activeRebind() === "left"
                        ? "..."
                        : formatKeyDisplay(keys().left)}
                    </button>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 mb-1">Arrière</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "backward"
                          ? "bg-sky-500 text-white border-white animate-pulse ring-2 ring-sky-400"
                          : "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                      }`}
                      onClick={() => setActiveRebind("backward")}
                      title="Cliquez pour changer la touche Arrière"
                    >
                      {activeRebind() === "backward"
                        ? "..."
                        : formatKeyDisplay(keys().backward)}
                    </button>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 mb-1">Droite</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "right"
                          ? "bg-sky-500 text-white border-white animate-pulse ring-2 ring-sky-400"
                          : "bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                      }`}
                      onClick={() => setActiveRebind("right")}
                      title="Cliquez pour changer la touche Droite"
                    >
                      {activeRebind() === "right"
                        ? "..."
                        : formatKeyDisplay(keys().right)}
                    </button>
                  </div>
                </div>

                <Show when={activeRebind()}>
                  <p className="text-xs text-sky-400 font-medium mt-1 animate-pulse">
                    Appuyez sur une touche du clavier (ou Échap pour annuler)...
                  </p>
                </Show>
              </div>
            </div>

            {/* Section 2: Engine Tolerances & Thresholds */}
            <div className="border-t border-slate-700/60 pt-4 space-y-4">
              <label className="block font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">
                Tolérances & Seuils du Moteur
              </label>

              {/* Perfect error margin threshold */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-200">
                    Marge d'erreur "Perfect"
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-right font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                      value={perfectThresholdMs()}
                      onInput={(e) =>
                        setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className="text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full accent-emerald-500 cursor-pointer"
                  value={perfectThresholdMs()}
                  onInput={(e) =>
                    setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                  }
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Fenêtre d'erreur admissible sous laquelle une transition est jugée
                  "Parfaite" (par défaut 1.6 ms).
                </p>
              </div>

              {/* Max strafe duration */}
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-200">
                    Temps maximum d'un strafe
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="10"
                      min="100"
                      max="500"
                      className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-right font-bold text-sky-400 focus:outline-none focus:border-sky-400"
                      value={maxStrafeMs()}
                      onInput={(e) =>
                        setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                      }
                    />
                    <span className="text-xs text-slate-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="10"
                  className="w-full accent-sky-500 cursor-pointer"
                  value={maxStrafeMs()}
                  onInput={(e) =>
                    setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                  }
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Seuil au-delà duquel l'entrée est ignorée (non considérée comme
                  un contre-strafe actif, par défaut 250 ms).
                </p>
              </div>
            </div>

            {/* Section 3: Visual Goals */}
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-200 text-xs uppercase tracking-wider">
                  Objectifs Visuels (Histogramme)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={goalsEnabled()}
                    onChange={(e) => setGoalsEnabled(e.target.checked)}
                    className="accent-sky-500 rounded cursor-pointer"
                  />
                  <span>Lignes de repères</span>
                </label>
              </div>

              <Show when={goalsEnabled()}>
                <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                  {/* Early goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="text-xs font-medium text-slate-200">
                        Objectif Early
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-sky-400 text-sm"
                        value={earlyTargetMs()}
                        onInput={(e) =>
                          setEarlyTargetMs(parseInt(e.target.value, 10) || 15)
                        }
                      />
                      <span className="text-xs text-slate-400">ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Cible max pour le relâchement anticipé.
                    </p>
                  </div>

                  {/* Late goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-medium text-slate-200">
                        Objectif Late
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-amber-400 text-sm"
                        value={lateTargetMs()}
                        onInput={(e) =>
                          setLateTargetMs(parseInt(e.target.value, 10) || 20)
                        }
                      />
                      <span className="text-xs text-slate-400">ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Cible max pour le chevauchement.
                    </p>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-slate-700 bg-[#0f172a] flex justify-between items-center">
            <button
              type="button"
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer"
              onClick={handleReset}
            >
              Par défaut
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-slate-300 hover:text-white px-4 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer"
                onClick={props.onClose}
              >
                Annuler
              </button>
              <button
                type="button"
                className="text-xs font-bold text-white px-5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 shadow-md transition-all cursor-pointer"
                onClick={handleSave}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
