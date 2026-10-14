import { createMemo } from "solid-js";
import { getStats, draw_time } from "../utils/stats";
import { getStrafeColors, STRAFE_SYMBOLS } from "../utils/settings";
import { t } from "../i18n";

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

  return (
    <div className="flex flex-col justify-center items-center flex-grow w-full text-xs">
      <table className="w-full border-collapse">
        <tbody className="text-center">
          <tr className="border-b border-slate-700/40 text-slate-400 font-semibold">
            <th className="py-1 text-left px-2">{t("table.metric")}</th>
            <th className="w-16 py-1 text-slate-200">{t("table.all")}</th>
            <th className="w-16 py-1 font-bold" style={{ color: colors().early }}>
              {STRAFE_SYMBOLS.early} {t("table.early")}
            </th>
            <th className="w-16 py-1 font-bold" style={{ color: colors().late }}>
              {STRAFE_SYMBOLS.late} {t("table.late")}
            </th>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.median")}</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().median)}</td>
            <td className="py-1 font-mono" style={{ color: colors().early }}>{draw_time(early().median)}</td>
            <td className="py-1 font-mono" style={{ color: colors().late }}>{draw_time(late().median)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.average")}</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().average)}</td>
            <td className="py-1 font-mono" style={{ color: colors().early }}>{draw_time(early().average)}</td>
            <td className="py-1 font-mono" style={{ color: colors().late }}>{draw_time(late().average)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.min")}</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().min)}</td>
            <td className="py-1 font-mono" style={{ color: colors().early }}>{draw_time(early().min)}</td>
            <td className="py-1 font-mono" style={{ color: colors().late }}>{draw_time(late().min)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.max")}</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().max)}</td>
            <td className="py-1 font-mono" style={{ color: colors().early }}>{draw_time(early().max)}</td>
            <td className="py-1 font-mono" style={{ color: colors().late }}>{draw_time(late().max)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.stdDeviation")}</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().std_deviation)}</td>
            <td className="py-1 font-mono" style={{ color: colors().early }}>{draw_time(early().std_deviation)}</td>
            <td className="py-1 font-mono" style={{ color: colors().late }}>{draw_time(late().std_deviation)}</td>
          </tr>
          <tr>
            <th className="py-1 text-left px-2 text-slate-400 font-medium">{t("table.samples")}</th>
            <td className="py-1 font-bold text-slate-200">{alls().samples}</td>
            <td className="py-1 font-bold" style={{ color: colors().early }}>{early().samples}</td>
            <td className="py-1 font-bold" style={{ color: colors().late }}>{late().samples}</td>
          </tr>
        </tbody>
      </table>

      {/* Highlighted Perfect counter */}
      <div
        className="mt-3 py-1.5 px-4 rounded-xl flex items-center gap-2 border"
        style={{
          "background-color": `${colors().perfect}1a`,
          "border-color": `${colors().perfect}4d`,
        }}
      >
        <span className="text-lg" style={{ color: colors().perfect }}>{STRAFE_SYMBOLS.perfect}</span>
        <span
          className="font-extrabold text-sm tracking-wide"
          style={{ color: colors().perfect }}
        >
          {t("table.perfect")} : {perfectCount()}x
        </span>
      </div>
    </div>
  );
}
