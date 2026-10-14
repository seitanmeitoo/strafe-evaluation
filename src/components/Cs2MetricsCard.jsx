import { t } from "../i18n";

export default function Cs2MetricsCard(props) {
  const metrics = () =>
    props.metrics || {
      totalShots: 0,
      accurateShots: 0,
      accurateRate: 0,
      avgShotDelay: 0,
      avgResidualSpeed: 0,
    };

  const hasShots = () => metrics().totalShots > 0;

  return (
    <div className="grid grid-cols-3 gap-2 my-2 p-2 bg-slate-900/50 rounded-xl border border-slate-700/50 shadow-sm text-center">
      <div className="flex flex-col items-center justify-center p-1">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          {t("metrics.accurateShotsTitle")}
        </span>
        <span
          className={`text-xl font-extrabold ${
            hasShots()
              ? metrics().accurateRate >= 75
                ? "text-emerald-400"
                : metrics().accurateRate >= 50
                ? "text-amber-400"
                : "text-rose-400"
              : "text-slate-500"
          }`}
        >
          {hasShots() ? `${metrics().accurateRate}%` : "--%"}
        </span>
        <span className="text-[10px] text-slate-400">
          {hasShots()
            ? t("metrics.shotsCount", {
                accurate: metrics().accurateShots,
                total: metrics().totalShots,
              })
            : t("metrics.noShots")}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-1 border-x border-slate-700/50">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          {t("metrics.shotDelayTitle")}
        </span>
        <span className="text-xl font-extrabold text-slate-100">
          {hasShots() ? `${metrics().avgShotDelay} ms` : "-- ms"}
        </span>
        <span className="text-[10px] text-slate-400">{t("metrics.stopToMouse")}</span>
      </div>

      <div className="flex flex-col items-center justify-center p-1">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          {t("metrics.residualSpeedTitle")}
        </span>
        <span
          className={`text-xl font-extrabold ${
            hasShots()
              ? metrics().avgResidualSpeed <= 85
                ? "text-emerald-400"
                : "text-rose-400"
              : "text-slate-500"
          }`}
        >
          {hasShots() ? `${metrics().avgResidualSpeed} u/s` : "-- u/s"}
        </span>
        <span className="text-[10px] text-slate-400">{t("metrics.accurateThresholdNotice")}</span>
      </div>
    </div>
  );
}
