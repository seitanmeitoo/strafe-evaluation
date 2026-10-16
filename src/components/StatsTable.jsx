import { createMemo, For } from "solid-js";
import { getStats, draw_time } from "../utils/stats";
import { getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";
import { coefficientOfVariation, consistencyLabel } from "../utils/analysis";

export default function StatsTable(props) {
  const early = createMemo(() => getStats(props.earlyStrafes || []));
  const late = createMemo(() => getStats(props.lateStrafes || []));
  const alls = createMemo(() =>
    getStats([
      ...(props.earlyStrafes || []),
      ...(props.lateStrafes || []),
      ...(props.perfectStrafes || []),
    ])
  );
  const perfectCount = createMemo(() => (props.perfectStrafes || []).length);
  const colors = createMemo(() => getStrafeColors(props.colorblindMode));

  const allDurations = () => [
    ...(props.earlyStrafes || []),
    ...(props.lateStrafes || []),
    ...(props.perfectStrafes || []),
  ];
  const cvAll = createMemo(() => coefficientOfVariation(allDurations()));
  const cvEarly = createMemo(() => coefficientOfVariation(props.earlyStrafes || []));
  const cvLate = createMemo(() => coefficientOfVariation(props.lateStrafes || []));
  const formatCv = (cv) => (cv == null ? "–" : `${Math.round(cv * 100)} %`);
  const cvTitle = (cv) => (cv == null ? "" : t(`table.consistency_${consistencyLabel(cv)}`));

  const rows = [
    { label: "table.median", key: "median" },
    { label: "table.average", key: "average" },
    { label: "table.min", key: "min" },
    { label: "table.max", key: "max" },
    { label: "table.stdDeviation", key: "std_deviation" },
  ];

  return (
    <div className="text-[13px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-right">
            <th className="w-[38%]" />
            <th className="py-1 font-semibold">{t("table.all")}</th>
            <th className="py-1 font-semibold" style={{ color: colors().early }}>
              {STRAFE_SYMBOLS.early} {t("table.early")}
            </th>
            <th className="py-1 font-semibold" style={{ color: colors().late }}>
              {STRAFE_SYMBOLS.late} {t("table.late")}
            </th>
          </tr>
        </thead>
        <tbody className="text-right">
          <For each={rows}>
            {(row) => (
              <tr>
                <th className="py-[3px] text-left font-normal text-muted">{t(row.label)}</th>
                <td className="py-[3px]">{draw_time(alls()[row.key])}</td>
                <td className="py-[3px]">{draw_time(early()[row.key])}</td>
                <td className="py-[3px]">{draw_time(late()[row.key])}</td>
              </tr>
            )}
          </For>
          <tr>
            <th className="py-[3px] text-left font-normal text-muted cursor-help" title={t("table.consistencyHint")}>
              {t("table.consistency")}
            </th>
            <td className="py-[3px]" title={cvTitle(cvAll())}>{formatCv(cvAll())}</td>
            <td className="py-[3px]" title={cvTitle(cvEarly())}>{formatCv(cvEarly())}</td>
            <td className="py-[3px]" title={cvTitle(cvLate())}>{formatCv(cvLate())}</td>
          </tr>
          <tr>
            <th className="py-[3px] text-left font-normal text-muted">{t("table.samples")}</th>
            <td className="py-[3px] font-semibold">{alls().samples}</td>
            <td className="py-[3px] font-semibold">{early().samples}</td>
            <td className="py-[3px] font-semibold">{late().samples}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 flex items-baseline justify-between">
        <p
          className="font-bold italic cursor-help"
          style={{ color: colors().perfect }}
          title={t("dashboard.perfectInfoTitle")}
        >
          {STRAFE_SYMBOLS.perfect} {t("dashboard.perfectCount", { count: perfectCount() })}
        </p>
        {cvAll() != null && (
          <p className="text-[12px] text-muted cursor-help" title={t("table.consistencyHint")}>
            {t(`table.consistency_${consistencyLabel(cvAll())}`)}
          </p>
        )}
      </div>
    </div>
  );
}
