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
    <div className="flex flex-col justify-center items-center flex-grow">
      <table style="width:100%">
        <tbody className="text-center">
          <tr>
            <th></th>
            <th className="w-16">All</th>
            <th className="w-16">Early</th>
            <th className="w-16">Late</th>
          </tr>
          <tr>
            <th>Median</th>
            <td>{draw_time(alls().median)}</td>
            <td>{draw_time(early().median)}</td>
            <td>{draw_time(late().median)}</td>
          </tr>
          <tr>
            <th>Average</th>
            <td>{draw_time(alls().average)}</td>
            <td>{draw_time(early().average)}</td>
            <td>{draw_time(late().average)}</td>
          </tr>
          <tr>
            <th>Min</th>
            <td>{draw_time(alls().min)}</td>
            <td>{draw_time(early().min)}</td>
            <td>{draw_time(late().min)}</td>
          </tr>
          <tr>
            <th>Max</th>
            <td>{draw_time(alls().max)}</td>
            <td>{draw_time(early().max)}</td>
            <td>{draw_time(late().max)}</td>
          </tr>
          <tr>
            <th>Std. Deviation</th>
            <td>{draw_time(alls().std_deviation)}</td>
            <td>{draw_time(early().std_deviation)}</td>
            <td>{draw_time(late().std_deviation)}</td>
          </tr>
          <tr>
            <th>Samples</th>
            <td>{alls().samples}</td>
            <td>{early().samples}</td>
            <td>{late().samples}</td>
          </tr>
        </tbody>
      </table>
      <div className="italic font-bold text-xl pt-4">
        <h1>Perfect {perfectCount()}x</h1>
      </div>
    </div>
  );
}
