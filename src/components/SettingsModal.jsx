import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { PRESETS, DEFAULT_SETTINGS, formatKeyDisplay } from "../utils/settings";

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
    });
    props.onClose();
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
        <div className="bg-[#2a3038] text-white rounded-2xl shadow-2xl border border-white/10 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-[#242930]">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="text-lg font-bold text-bright tracking-wide">
                Paramètres & Tolérances
              </h2>
            </div>
            <button
              type="button"
              className="text-white/60 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              onClick={props.onClose}
              title="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Modal body */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-130px)] text-sm">
            {/* Section 1: Key Rebinding */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-bright text-xs uppercase tracking-wider">
                  Touches de déplacement (WASD / Flèches)
                </label>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {Object.entries(PRESETS).map(([id, p]) => (
                  <button
                    type="button"
                    className="py-1.5 px-2 text-xs font-medium rounded-lg bg-white/5 hover:bg-primary hover:text-white border border-white/10 transition-all cursor-pointer text-center"
                    onClick={() => applyPreset(id)}
                  >
                    {p.name.split(" ")[0]}
                  </button>
                ))}
              </div>

              {/* Rebind interactive buttons */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center gap-2">
                {/* Forward key */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-white/50 mb-1">Avant</span>
                  <button
                    type="button"
                    className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                      activeRebind() === "forward"
                        ? "bg-primary text-white border-white animate-pulse ring-2 ring-primary"
                        : "bg-white/10 text-bright border-white/15 hover:bg-white/20"
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
                    <span className="text-[10px] text-white/50 mb-1">Gauche</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "left"
                          ? "bg-primary text-white border-white animate-pulse ring-2 ring-primary"
                          : "bg-white/10 text-bright border-white/15 hover:bg-white/20"
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
                    <span className="text-[10px] text-white/50 mb-1">Arrière</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "backward"
                          ? "bg-primary text-white border-white animate-pulse ring-2 ring-primary"
                          : "bg-white/10 text-bright border-white/15 hover:bg-white/20"
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
                    <span className="text-[10px] text-white/50 mb-1">Droite</span>
                    <button
                      type="button"
                      className={`w-14 h-12 rounded-lg font-bold text-base border flex items-center justify-center cursor-pointer transition-all ${
                        activeRebind() === "right"
                          ? "bg-primary text-white border-white animate-pulse ring-2 ring-primary"
                          : "bg-white/10 text-bright border-white/15 hover:bg-white/20"
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
                  <p className="text-xs text-primary font-medium mt-1 animate-pulse">
                    Appuyez sur une touche du clavier (ou Échap pour annuler)...
                  </p>
                </Show>
              </div>
            </div>

            {/* Section 2: Engine Tolerances & Thresholds */}
            <div className="border-t border-white/10 pt-4 space-y-4">
              <label className="block font-semibold text-bright text-xs uppercase tracking-wider mb-2">
                Tolérances & Seuils du Moteur
              </label>

              {/* Perfect error margin threshold */}
              <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white/90">
                    Marge d'erreur "Perfect"
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="w-16 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-right font-bold text-primary focus:outline-none focus:border-primary"
                      value={perfectThresholdMs()}
                      onInput={(e) =>
                        setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className="text-xs text-white/50">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full accent-primary cursor-pointer"
                  value={perfectThresholdMs()}
                  onInput={(e) =>
                    setPerfectThresholdMs(parseFloat(e.target.value) || 0)
                  }
                />
                <p className="text-[11px] text-white/50 leading-tight">
                  Fenêtre d'erreur admissible sous laquelle une transition est jugée
                  "Parfaite" (par défaut 1.6 ms).
                </p>
              </div>

              {/* Max strafe duration */}
              <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white/90">
                    Temps maximum d'un strafe
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="10"
                      min="100"
                      max="500"
                      className="w-16 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-right font-bold text-primary focus:outline-none focus:border-primary"
                      value={maxStrafeMs()}
                      onInput={(e) =>
                        setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                      }
                    />
                    <span className="text-xs text-white/50">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="10"
                  className="w-full accent-primary cursor-pointer"
                  value={maxStrafeMs()}
                  onInput={(e) =>
                    setMaxStrafeMs(parseInt(e.target.value, 10) || 250)
                  }
                />
                <p className="text-[11px] text-white/50 leading-tight">
                  Seuil au-delà duquel l'entrée est ignorée (non considérée comme
                  un contre-strafe actif, par défaut 250 ms).
                </p>
              </div>
            </div>

            {/* Section 3: Visual Goals (JessicaNgo model) */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-bright text-xs uppercase tracking-wider">
                  Objectifs Visuels (Histogramme)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={goalsEnabled()}
                    onChange={(e) => setGoalsEnabled(e.target.checked)}
                    className="accent-primary rounded cursor-pointer"
                  />
                  <span>Lignes de repères</span>
                </label>
              </div>

              <Show when={goalsEnabled()}>
                <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  {/* Early goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                      <span className="text-xs font-medium text-white/90">
                        Objectif Early
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-primary text-sm"
                        value={earlyTargetMs()}
                        onInput={(e) =>
                          setEarlyTargetMs(parseInt(e.target.value, 10) || 15)
                        }
                      />
                      <span className="text-xs text-white/50">ms</span>
                    </div>
                    <p className="text-[10px] text-white/40">
                      Cible max pour le relâchement anticipé.
                    </p>
                  </div>

                  {/* Late goal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-xs font-medium text-white/90">
                        Objectif Late
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 font-bold text-white focus:outline-none focus:border-primary text-sm"
                        value={lateTargetMs()}
                        onInput={(e) =>
                          setLateTargetMs(parseInt(e.target.value, 10) || 20)
                        }
                      />
                      <span className="text-xs text-white/50">ms</span>
                    </div>
                    <p className="text-[10px] text-white/40">
                      Cible max pour le chevauchement.
                    </p>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-white/10 bg-[#242930] flex justify-between items-center">
            <button
              type="button"
              className="text-xs font-medium text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all cursor-pointer"
              onClick={handleReset}
            >
              Par défaut
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-white/80 hover:text-white px-4 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 transition-all cursor-pointer"
                onClick={props.onClose}
              >
                Annuler
              </button>
              <button
                type="button"
                className="text-xs font-bold text-white px-5 py-1.5 rounded-lg bg-primary hover:brightness-110 shadow-md transition-all cursor-pointer"
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
