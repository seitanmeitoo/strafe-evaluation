import { createMemo } from "solid-js";
import { getStats, draw_time } from "../utils/stats";

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

  return (
    <div className="flex flex-col justify-center items-center flex-grow w-full text-xs">
      <table className="w-full border-collapse">
        <tbody className="text-center">
          <tr className="border-b border-slate-700/40 text-slate-400 font-semibold">
            <th className="py-1 text-left px-2">Métrique</th>
            <th className="w-16 py-1 text-slate-200">Tous</th>
            <th className="w-16 py-1 text-sky-400 font-bold">Early</th>
            <th className="w-16 py-1 text-amber-400 font-bold">Late</th>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Médiane</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().median)}</td>
            <td className="py-1 font-mono text-sky-300">{draw_time(early().median)}</td>
            <td className="py-1 font-mono text-amber-300">{draw_time(late().median)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Moyenne</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().average)}</td>
            <td className="py-1 font-mono text-sky-300">{draw_time(early().average)}</td>
            <td className="py-1 font-mono text-amber-300">{draw_time(late().average)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Min</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().min)}</td>
            <td className="py-1 font-mono text-sky-300">{draw_time(early().min)}</td>
            <td className="py-1 font-mono text-amber-300">{draw_time(late().min)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Max</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().max)}</td>
            <td className="py-1 font-mono text-sky-300">{draw_time(early().max)}</td>
            <td className="py-1 font-mono text-amber-300">{draw_time(late().max)}</td>
          </tr>
          <tr className="border-b border-slate-700/20">
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Écart-type</th>
            <td className="py-1 font-mono text-slate-200">{draw_time(alls().std_deviation)}</td>
            <td className="py-1 font-mono text-sky-300">{draw_time(early().std_deviation)}</td>
            <td className="py-1 font-mono text-amber-300">{draw_time(late().std_deviation)}</td>
          </tr>
          <tr>
            <th className="py-1 text-left px-2 text-slate-400 font-medium">Échantillons</th>
            <td className="py-1 font-bold text-slate-200">{alls().samples}</td>
            <td className="py-1 font-bold text-sky-400">{early().samples}</td>
            <td className="py-1 font-bold text-amber-400">{late().samples}</td>
          </tr>
        </tbody>
      </table>

      {/* Highlighted Perfect counter */}
      <div className="mt-3 py-1.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
        <span className="text-emerald-400 text-lg">✨</span>
        <span className="text-emerald-300 font-extrabold text-sm tracking-wide">
          Perfect : {perfectCount()}x
        </span>
      </div>
    </div>
  );
}
