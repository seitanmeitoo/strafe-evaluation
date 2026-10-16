import { createSignal, createEffect, For, Show } from "solid-js";
import { loadSessions, deleteSession, clearAllSessions } from "../utils/sessions";
import { loadSettings, getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";
import { CloseIcon } from "./Icons";
import SessionSummaryModal from "./SessionSummaryModal";

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
  const [selectedIds, setSelectedIds] = createSignal([]);
  const [summarySession, setSummarySession] = createSignal(null);

  function toggleSelected(id) {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return [...ids, id].slice(-2); // keep the last two ticked sessions
    });
  }

  // The two selected sessions, oldest first.
  const compared = () => {
    const picked = sessions().filter((s) => selectedIds().includes(s.id));
    if (picked.length !== 2) return null;
    return [...picked].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  };

  // Rows of the comparison; higherIsBetter decides how a change is judged.
  const COMPARE_ROWS = [
    { label: "sessions.totalStrafes", get: (s) => s.totalStrafes, unit: "", neutral: true },
    { label: "table.perfect", get: (s) => s.perfectRate, unit: "%", higherIsBetter: true, points: true },
    { label: "table.median", get: (s) => s.medianDurationMs, unit: " ms", higherIsBetter: false },
    {
      label: "table.consistency",
      get: (s) => (s.analysis?.cv != null ? Math.round(s.analysis.cv * 100) : null),
      unit: "%",
      higherIsBetter: false,
      points: true,
    },
    {
      label: "metrics.accurateShotsTitle",
      get: (s) => (s.totalShots > 0 ? s.accurateRate : null),
      unit: "%",
      higherIsBetter: true,
      points: true,
    },
  ];

  function changeText(row, before, after) {
    if (before == null || after == null) return { text: "–", better: false };
    const diff = Math.round((after - before) * 10) / 10;
    const signed = `${diff > 0 ? "+" : ""}${diff}`;
    if (row.neutral) return { text: signed, better: false };
    if (diff === 0) return { text: t("sessions.same"), better: false };
    const better = row.higherIsBetter ? diff > 0 : diff < 0;
    const amount = row.points ? t("sessions.points", { value: signed }) : `${signed}${row.unit}`;
    return { text: `${amount}, ${better ? t("sessions.better") : t("sessions.worse")}`, better };
  }

  createEffect(() => {
    if (props.isOpen) {
      setSessions(loadSessions());
      setSelectedIds([]);
      // Use the strafe colors of the palette currently selected in the settings.
      setColors(getStrafeColors(loadSettings()?.colorblindMode));
    }
  });

  function handleDelete(id) {
    const updated = deleteSession(id);
    setSessions(updated);
    setSelectedIds((ids) => ids.filter((x) => x !== id));
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
        <div className="bg-surface text-ink rounded-xl border border-line shadow-lg w-full max-w-3xl max-h-[calc(100vh-48px)] flex flex-col overflow-hidden text-[13px]">
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

          {/* Quick stats summary, or the comparison of two ticked sessions */}
          <Show
            when={compared()}
            fallback={
              <div className="shrink-0 px-5 py-3 border-b border-line">
                <div className="grid grid-cols-3 gap-4">
                  <SummaryItem label={t("sessions.totalSessions")} value={sessions().length} />
                  <SummaryItem label={t("sessions.totalStrafes")} value={totalCumulativeStrafes()} />
                  <SummaryItem label={t("sessions.bestAccuracy")} value={bestAccurateRate()} />
                </div>
                <Show when={sessions().length >= 2}>
                  <p className="mt-2 text-[12px] text-muted">{t("sessions.compareHint")}</p>
                </Show>
              </div>
            }
          >
            <div className="shrink-0 px-5 py-3 border-b border-line">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-[13px] font-semibold">{t("sessions.compareTitle")}</h3>
                <button
                  type="button"
                  className="text-[12px] text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                  onClick={() => setSelectedIds([])}
                >
                  {t("sessions.clearSelection")}
                </button>
              </div>
              <table className="w-full text-right">
                <thead>
                  <tr className="text-[12px] text-muted">
                    <th className="text-left font-normal py-0.5">{t("sessions.compareMetric")}</th>
                    <th className="font-normal">{formatDate(compared()[0].timestamp)}</th>
                    <th className="font-normal">{formatDate(compared()[1].timestamp)}</th>
                    <th className="font-normal">{t("sessions.compareChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={COMPARE_ROWS}>
                    {(row) => {
                      const before = () => row.get(compared()[0]);
                      const after = () => row.get(compared()[1]);
                      const change = () => changeText(row, before(), after());
                      return (
                        <tr>
                          <th className="text-left font-normal text-muted py-0.5">{t(row.label)}</th>
                          <td>{before() == null ? "–" : `${before()}${row.unit}`}</td>
                          <td>{after() == null ? "–" : `${after()}${row.unit}`}</td>
                          <td className={change().better ? "text-accent font-semibold" : ""}>{change().text}</td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

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
                  <div className="py-2.5 border-b border-line last:border-b-0 grid grid-cols-[16px_104px_1fr_auto_auto] items-center gap-3">
                    <input
                      type="checkbox"
                      className="accent-[rgb(var(--color-accent))] cursor-pointer"
                      checked={selectedIds().includes(session.id)}
                      onChange={() => toggleSelected(session.id)}
                      title={t("sessions.selectToCompare")}
                    />

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
                    <div className="flex items-center gap-3 whitespace-nowrap">
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

                    {/* Summary and delete */}
                    <div className="flex flex-col items-end gap-0.5">
                      <Show when={session.feedback}>
                        <button
                          type="button"
                          className="text-[12px] text-ink hover:text-accent underline underline-offset-4 transition-colors cursor-pointer"
                          onClick={() => setSummarySession(session)}
                        >
                          {t("sessions.summary")}
                        </button>
                      </Show>
                      <button
                        type="button"
                        className="text-[12px] text-muted hover:text-ink underline underline-offset-4 transition-colors cursor-pointer"
                        onClick={() => handleDelete(session.id)}
                      >
                        {t("sessions.deleteSession")}
                      </button>
                    </div>
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

      <SessionSummaryModal session={summarySession()} onClose={() => setSummarySession(null)} />
    </Show>
  );
}
