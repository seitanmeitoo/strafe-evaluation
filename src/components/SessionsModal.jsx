import { createSignal, createEffect, For, Show } from "solid-js";
import { loadSessions, deleteSession, clearAllSessions } from "../utils/sessions";
import { t } from "../i18n";

export default function SessionsModal(props) {
  const [sessions, setSessions] = createSignal([]);

  createEffect(() => {
    if (props.isOpen) {
      setSessions(loadSessions());
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

  return (
    <Show when={props.isOpen}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div className="bg-[#1e293b] text-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                {t("sessions.title")}
              </h2>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={props.onClose}
              title={t("sessions.close")}
            >
              ✕
            </button>
          </div>

          {/* Quick stats summary cards */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/40 border-b border-slate-800 text-center">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                {t("sessions.totalSessions")}
              </span>
              <span className="text-xl font-extrabold text-slate-100">
                {sessions().length}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                {t("sessions.totalStrafes")}
              </span>
              <span className="text-xl font-extrabold text-sky-400">
                {totalCumulativeStrafes()}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                {t("sessions.bestAccuracy")}
              </span>
              <span className="text-xl font-extrabold text-emerald-400">
                {bestAccurateRate()}
              </span>
            </div>
          </div>

          {/* Session list */}
          <div className="p-4 space-y-2.5 overflow-y-auto max-h-[calc(90vh-210px)] text-sm">
            <Show
              when={sessions().length > 0}
              fallback={
                <div className="py-12 text-center text-slate-400">
                  <p className="text-base font-medium">{t("sessions.emptyNotice")}</p>
                </div>
              }
            >
              <For each={sessions()}>
                {(session) => (
                  <div className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 p-3 rounded-xl flex items-center justify-between gap-4 transition-all">
                    {/* Date & Strafe count */}
                    <div className="min-w-32">
                      <span className="text-xs font-semibold text-slate-200 block">
                        {formatDate(session.timestamp)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {session.totalStrafes} strafes
                      </span>
                    </div>

                    {/* Proportions: Perfect / Early / Late */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-400 font-bold" title={t("sessions.perfectTitle")}>
                        ✨ {session.perfectCount} ({session.perfectRate}%)
                      </span>
                      <span className="text-sky-400 font-medium" title={t("sessions.earlyTitle")}>
                        ⏱️ {session.earlyCount} Early
                      </span>
                      <span className="text-amber-400 font-medium" title={t("sessions.lateTitle")}>
                        ⏱️ {session.lateCount} Late
                      </span>
                    </div>

                    {/* CS2 metrics badge */}
                    <div className="text-right">
                      {session.totalShots > 0 ? (
                        <div
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            session.accurateRate >= 75
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : session.accurateRate >= 50
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          🎯 {session.accurateRate}% {t("metrics.accurate")} ({session.avgShotDelayMs}ms)
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          {t("history.withoutShot")}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {t("sessions.median")} {session.medianDurationMs}ms
                      </span>
                    </div>

                    {/* Delete session button */}
                    <button
                      type="button"
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer text-xs"
                      onClick={() => handleDelete(session.id)}
                      title={t("sessions.deleteSession")}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-3 border-t border-slate-700 bg-[#0f172a] flex justify-between items-center">
            <button
              type="button"
              className="text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              disabled={sessions().length === 0}
              onClick={handleClearAll}
            >
              {t("sessions.clearHistory")}
            </button>

            <button
              type="button"
              className="text-xs font-bold text-white px-5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-all cursor-pointer"
              onClick={props.onClose}
            >
              {t("sessions.close")}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
