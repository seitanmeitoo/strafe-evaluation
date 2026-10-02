import { createSignal, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { formatKeyDisplay } from "../utils/settings";

export default function KeyVisualizer(props) {
  const [aPressed, setAPressed] = createSignal(false);
  const [dPressed, setDPressed] = createSignal(false);
  const [wPressed, setWPressed] = createSignal(false);
  const [sPressed, setSPressed] = createSignal(false);
  const [m1Pressed, setM1Pressed] = createSignal(false);

  onMount(() => {
    let unlisteners = [];

    const setup = async () => {
      unlisteners.push(
        await listen("a-pressed", () => setAPressed(true)),
        await listen("d-pressed", () => setDPressed(true)),
        await listen("w-pressed", () => setWPressed(true)),
        await listen("s-pressed", () => setSPressed(true)),
        await listen("mouse-pressed", () => setM1Pressed(true)),

        await listen("a-released", () => setAPressed(false)),
        await listen("d-released", () => setDPressed(false)),
        await listen("w-released", () => setWPressed(false)),
        await listen("s-released", () => setSPressed(false)),
        await listen("mouse-released", () => setM1Pressed(false))
      );
    };

    setup();

    onCleanup(() => {
      unlisteners.forEach((fn) => typeof fn === "function" && fn());
    });
  });

  function simulateEarly() {
    setAPressed(true);
    setTimeout(() => setAPressed(false), 400);
    setTimeout(() => setDPressed(true), 460);
    setTimeout(() => setM1Pressed(true), 530);
    setTimeout(() => setM1Pressed(false), 630);
    setTimeout(() => setDPressed(false), 800);
  }

  function simulateLate() {
    setAPressed(true);
    setTimeout(() => setDPressed(true), 400);
    setTimeout(() => setAPressed(false), 440);
    setTimeout(() => setM1Pressed(true), 515);
    setTimeout(() => setM1Pressed(false), 615);
    setTimeout(() => setDPressed(false), 800);
  }

  function simulatePerfect() {
    setAPressed(true);
    setTimeout(() => {
      setAPressed(false);
      setDPressed(true);
    }, 400);
    setTimeout(() => setM1Pressed(true), 480);
    setTimeout(() => setM1Pressed(false), 580);
    setTimeout(() => setDPressed(false), 800);
  }

  return (
    <div className="flex group justify-center items-center w-full h-full select-none">
      <div className="flex flex-col basis-0 flex-grow items-end opacity-0 -translate-x-2 duration-200 group-hover:opacity-100 group-hover:translate-x-0">
        <button
          type="button"
          className="wasd-button text-white bg-secondary cursor-pointer"
          onClick={simulateEarly}
        >
          Early + Shot
        </button>
        <button
          type="button"
          className="wasd-button text-white bg-accent cursor-pointer"
          onClick={simulateLate}
        >
          Late + Shot
        </button>
        <button
          type="button"
          className="wasd-button text-white bg-[#b5ac8c] cursor-pointer"
          onClick={simulatePerfect}
        >
          Perfect + Shot
        </button>
      </div>

      <div className="flex justify-center items-center gap-6 px-4">
        {/* Dynamic cluster */}
        <div className="flex flex-col items-center gap-1">
          {/* Row 1: Forward */}
          <div
            className={
              "flex border border-dark/20 shadow-md w-12 h-12 rounded-md justify-center items-center text-lg font-bold transition-all duration-75" +
              (wPressed()
                ? " bg-accent/70 translate-y-[2px] shadow-inner text-white"
                : " bg-zinc-200/40 text-dark")
            }
          >
            {formatKeyDisplay(props.keys?.forward || "W")}
          </div>

          {/* Row 2: Left, Backward, Right */}
          <div className="flex gap-1 text-lg font-bold">
            <div
              className={
                "flex border border-dark/20 shadow-md w-12 h-12 rounded-md justify-center items-center transition-all duration-75" +
                (aPressed()
                  ? " bg-accent/70 translate-y-[2px] shadow-inner text-white"
                  : " bg-zinc-200/40 text-dark")
              }
            >
              {formatKeyDisplay(props.keys?.left || "A")}
            </div>
            <div
              className={
                "flex border border-dark/20 shadow-md w-12 h-12 rounded-md justify-center items-center transition-all duration-75" +
                (sPressed()
                  ? " bg-accent/70 translate-y-[2px] shadow-inner text-white"
                  : " bg-zinc-200/40 text-dark")
              }
            >
              {formatKeyDisplay(props.keys?.backward || "S")}
            </div>
            <div
              className={
                "flex border border-dark/20 shadow-md w-12 h-12 rounded-md justify-center items-center transition-all duration-75" +
                (dPressed()
                  ? " bg-accent/70 translate-y-[2px] shadow-inner text-white"
                  : " bg-zinc-200/40 text-dark")
              }
            >
              {formatKeyDisplay(props.keys?.right || "D")}
            </div>
          </div>
        </div>

        {/* Mouse 1 (Left click) visualizer */}
        <div className="flex flex-col items-center justify-center">
          <div
            className={
              "flex flex-col border border-dark/20 shadow-md w-14 h-20 rounded-t-2xl rounded-b-lg justify-center items-center text-xs font-bold transition-all duration-75" +
              (m1Pressed()
                ? " bg-primary translate-y-[3px] shadow-inner text-white"
                : " bg-zinc-200/40 text-dark")
            }
          >
            <span className="text-base">🖱️</span>
            <span>M1</span>
          </div>
        </div>
      </div>

      <div className="basis-0 flex-grow min-w-[200px]" />
    </div>
  );
}
