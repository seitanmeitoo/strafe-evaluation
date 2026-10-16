import { createSignal, createEffect, For, Show } from "solid-js";
import { loadSessions, deleteSession, clearAllSessions } from "../utils/sessions";
import { loadSettings, getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";
import { CloseIcon } from "./Icons";

// Shared style strings (same look as the buttons of the main window).
const btn =
  "h-8 px-3 rounded-md border border-line bg-card text-ink text-[13px] font-medium hover:border-muted transition-colors cursor-pointer select-none";
const iconBtn =
  "h-8 w-8 flex items-center justify-center rounded-md border border-line bg-card text-ink hover:border-muted transition-colors cursor-pointer select-none";
const swatch =
  "w-4 h-4 rounded-sm flex items-center justify-center text-[9px] text-black font-black";

export default function SessionsModal(props) {
  const [sessions, setSessions] = createSignal([]);
  const [colors, setColors] = createSignal(getStrafeColors());

  createEffect(() => {
    if (props.isOpen) {
      setSessions(loadSessions());
      // Use the strafe colors of the palette currently selected in the settings.
      setColors(getStrafeColors(loadSettings()?.colorblindMode));
    }
  });

  function handleDelete(id) {
    const updated = deleteSession(id);
    setSessions(updated);
  }

  function handleClearAll() {
    if (confirm(t("sessions.clearConfirm"))) {
      clearAllSessions();
      setSessions([]);
    }
  }

  const totalCumulativeStrafes = () =>
    sessions().reduce((acc, s) => acc + (s.totalStrafes || 0), 0);

  const bestAccurateRate = () => {
    const valid = sessions().filter((s) => (s.totalShots || 0) >= 3);
    if (valid.length === 0) return "--";
    return Math.max(...valid.map((s) => s.accurateRate || 0)) + "%";
  };

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  const SummaryItem = (p) => (
    <div className="flex flex-col">
      <span className="text-[12px] text-muted">{p.label}</span>
      <span className="text-[17px] font-bold leading-tight">{p.value}</span>
    </div>
  );

  return (
    <Show when={props.isOpen}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div className="bg-surface text-ink rounded-xl border border-line shadow-lg w-full max-w-2xl max-h-[calc(100vh-48px)] flex flex-col overflow-hidden text-[13px]">
          {/* Header */}
          <div className="h-12 shrink-0 flex justify-between items-center px-5 border-b border-line">
            <h2 className="text-base font-bold">{t("sessions.title")}</h2>
            <button
              type="button"
              className={iconBtn}
              onClick={props.onClose}
              title={t("sessions.close")}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Quick stats summary */}
          <div className="shrink-0 grid grid-cols-3 gap-4 px-5 py-3 border-b border-line">
            <SummaryItem label={t("sessions.totalSessions")} value={sessions().length} />
            <SummaryItem label={t("sessions.totalStrafes")} value={totalCumulativeStrafes()} />
            <SummaryItem label={t("sessions.bestAccuracy")} value={bestAccurateRate()} />
          </div>

          {/* Session list */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5">
            <Show
              when={sessions().length > 0}
              fallback={
                <div className="py-12 text-center text-muted">
                  <p>{t("sessions.emptyNotice")}</p>
                </div>
              }
            >
              <For each={sessions()}>
                {(session) => (
                  <div className="py-2.5 border-b border-line last:border-b-0 grid grid-cols-[112px_1fr_auto_auto] items-center gap-4">
                    {/* Date & strafe count */}
                    <div>
                      <span className="font-semibold block">
                        {formatDate(session.timestamp)}
                      </span>
                      <span className="text-[12px] text-muted">
                        {session.totalStrafes} strafes
                      </span>
                    </div>

                    {/* Proportions: Perfect / Early / Late */}
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5" title={t("sessions.perfectTitle")}>
                        <span className={swatch} style={{ "background-color": colors().perfect }}>
                          {STRAFE_SYMBOLS.perfect}
                        </span>
                        <span className="font-semibold">
                          {session.perfectCount} {t("table.perfect")} ({session.perfectRate}%)
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5" title={t("sessions.earlyTitle")}>
                        <span className={swatch} style={{ "background-color": colors().early }}>
                          {STRAFE_SYMBOLS.early}
                        </span>
                        <span>
                          {session.earlyCount} {t("table.early")}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5" title={t("sessions.lateTitle")}>
                        <span className={swatch} style={{ "background-color": colors().late }}>
                          {STRAFE_SYMBOLS.late}
                        </span>
                        <span>
                          {session.lateCount} {t("table.late")}
                        </span>
                      </span>
                    </div>

                    {/* CS2 metrics */}
                    <div className="text-right">
                      {session.totalShots > 0 ? (
                        <span
                          className={
                            session.accurateRate >= 75
                              ? "text-accent font-semibold"
                              : session.accurateRate >= 50
                              ? "text-ink font-medium"
                              : "text-muted"
                          }
                        >
                          {session.accurateRate}% {t("metrics.accurate")} ({session.avgShotDelayMs}ms)
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted italic">
                          {t("history.withoutShot")}
                        </span>
                      )}
                      <span className="text-[12px] text-muted block">
                        {t("sessions.median")} {session.medianDurationMs}ms
                      </span>
                    </div>

                    {/* Delete session button */}
                    <button
                      type="button"
                      className="text-[12px] text-muted hover:text-ink underline underline-offset-4 transition-colors cursor-pointer"
                      onClick={() => handleDelete(session.id)}
                    >
                      {t("sessions.deleteSession")}
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer actions */}
          <div className="h-14 shrink-0 px-5 border-t border-line flex justify-between items-center">
            <button
              type="button"
              className={`${btn} disabled:opacity-40 disabled:pointer-events-none`}
              disabled={sessions().length === 0}
              onClick={handleClearAll}
            >
              {t("sessions.clearHistory")}
            </button>

            <button type="button" className={btn} onClick={props.onClose}>
              {t("sessions.close")}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
