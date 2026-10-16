import { t } from "../i18n";
import { ACCURATE_SPEED_THRESHOLD } from "../utils/cs2Physics";

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

  const Metric = (p) => (
    <div className="flex flex-col" title={p.hint}>
      <span className="text-[12px] text-muted">{p.label}</span>
      <span className="text-[17px] font-bold leading-tight">{p.value}</span>
    </div>
  );

  return (
    <div className="mt-auto pt-2 border-t border-line grid grid-cols-3 gap-2">
      <Metric
        label={t("metrics.accurateShotsTitle")}
        value={hasShots() ? `${metrics().accurateRate} %` : "–"}
        hint={
          hasShots()
            ? t("metrics.shotsCount", { accurate: metrics().accurateShots, total: metrics().totalShots })
            : t("metrics.noShots")
        }
      />
      <Metric
        label={t("metrics.shotDelayTitle")}
        value={hasShots() ? `${metrics().avgShotDelay} ms` : "–"}
        hint={t("metrics.stopToMouse")}
      />
      <Metric
        label={t("metrics.residualSpeedTitle")}
        value={hasShots() ? `${metrics().avgResidualSpeed} u/s` : "–"}
        hint={t("metrics.accurateThresholdNotice", { speed: Math.round(ACCURATE_SPEED_THRESHOLD) })}
      />
    </div>
  );
}
