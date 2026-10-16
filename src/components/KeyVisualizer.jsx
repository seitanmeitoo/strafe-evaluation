import { createSignal, onMount, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { formatKeyDisplay } from "../utils/settings";
import { t } from "../i18n";

function Keycap(props) {
  return (
    <div
      className={`flex items-center justify-center rounded-md font-bold select-none transition-[transform,background-color] duration-75 ${
        props.class || "w-11 h-11 text-[17px]"
      } ${
        props.pressed
          ? "bg-key-on border-b border-key-edge translate-y-[3px]"
          : "bg-key border-b-4 border-key-edge"
      }`}
    >
      {props.children}
    </div>
  );
}

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

  const demoBtn = "text-left text-[12px] text-muted hover:text-ink underline-offset-2 hover:underline cursor-pointer";

  return (
    <div className="flex items-center gap-5 select-none">
      <div className="flex flex-col items-center gap-1">
        <Keycap pressed={wPressed()}>{formatKeyDisplay(props.keys?.forward || "W")}</Keycap>
        <div className="flex gap-1">
          <Keycap pressed={aPressed()}>{formatKeyDisplay(props.keys?.left || "A")}</Keycap>
          <Keycap pressed={sPressed()}>{formatKeyDisplay(props.keys?.backward || "S")}</Keycap>
          <Keycap pressed={dPressed()}>{formatKeyDisplay(props.keys?.right || "D")}</Keycap>
        </div>
      </div>

      <Keycap pressed={m1Pressed()} class="w-12 h-[64px] text-[13px] rounded-t-2xl">
        M1
      </Keycap>

      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] font-semibold">{t("visualizer.examplesTitle")}</span>
        <button type="button" className={demoBtn} onClick={simulateEarly}>
          {t("visualizer.simulateEarly")}
        </button>
        <button type="button" className={demoBtn} onClick={simulateLate}>
          {t("visualizer.simulateLate")}
        </button>
        <button type="button" className={demoBtn} onClick={simulatePerfect}>
          {t("visualizer.simulatePerfect")}
        </button>
      </div>
    </div>
  );
}
