import { For } from "solid-js";
import { draw_time } from "../utils/stats";

export default function StrafeHistoryBar(props) {
  const strafes = () => props.strafes || props.totalStrafes || [];

  return (
    <div className="flex flex-row p-2 bg-accent/25 h-20 overflow-clip w-full">
      <For each={strafes()}>
        {(strafe) => (
          <div className="flex shadow-md select-none flex-col border-bright/75 border-t bg-secondary/45 rounded-md justify-center items-center min-w-16 mr-2">
            <p className="font-bold text-center">{strafe.type}</p>
            <p className="text-center">{draw_time(strafe.duration)}</p>
          </div>
        )}
      </For>
    </div>
  );
}
