import { createSignal, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";

export default function KeyVisualizer() {
  const [aPressed, setAPressed] = createSignal(false);
  const [dPressed, setDPressed] = createSignal(false);

  onMount(() => {
    let unlisteners = [];

    const setup = async () => {
      unlisteners.push(
        await listen("a-pressed", () => setAPressed(true)),
        await listen("d-pressed", () => setDPressed(true)),
        await listen("a-released", () => setAPressed(false)),
        await listen("d-released", () => setDPressed(false))
      );
    };

    setup();

    onCleanup(() => {
      unlisteners.forEach((fn) => typeof fn === "function" && fn());
    });
  });

  function simulateEarly() {
    setAPressed(true);
    setTimeout(() => setAPressed(false), 500);
    setTimeout(() => setDPressed(true), 850);
    setTimeout(() => setDPressed(false), 1350);
  }

  function simulateLate() {
    setAPressed(true);
    setTimeout(() => setDPressed(true), 500);
    setTimeout(() => setAPressed(false), 850);
    setTimeout(() => setDPressed(false), 1350);
  }

  function simulatePerfect() {
    setAPressed(true);
    setTimeout(() => {
      setDPressed(true);
      setAPressed(false);
    }, 500);
    setTimeout(() => setDPressed(false), 1000);
  }

  return (
    <div className="flex group justify-center items-center w-full h-full">
      <div className="flex flex-col basis-0 flex-grow items-end opacity-0 -translate-x-2 duration-200 group-hover:opacity-100 group-hover:translate-x-0">
        <button
          className="wasd-button text-white bg-secondary"
          onClick={simulateEarly}
        >
          Early
        </button>
        <button
          className="wasd-button text-white bg-accent"
          onClick={simulateLate}
        >
          Late
        </button>
        <button
          className="wasd-button text-white bg-[#b5ac8c]"
          onClick={simulatePerfect}
        >
          Perfect
        </button>
      </div>

      <div className="flex justify-center basis-0 flex-grow">
        <div className="select-none pointer-events-none text-dark flex justify-between w-40 text-center font-bold text-xl">
          <div
            className={
              "flex border-dark/10 border-r border-b shadow-lg border-b-dark/50 w-16 h-16 rounded-md justify-center items-center duration-75" +
              (aPressed()
                ? " bg-accent/50 scale-100 translate-y-[4px]"
                : " bg-zinc-200/25")
            }
          >
            <p>A</p>
          </div>
          <div
            className={
              "flex border-dark/10 border-l border-b shadow-lg border-b-dark/50 w-16 h-16 rounded-md justify-center items-center duration-75" +
              (dPressed()
                ? " bg-accent/50 translate-y-[4px]"
                : " bg-zinc-200/25")
            }
          >
            <p>D</p>
          </div>
        </div>
      </div>

      <div className="basis-0 flex-grow min-w-[200px]" />
    </div>
  );
}
