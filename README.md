# Strafe Evolution

A desktop tool that measures your counter-strafes in Counter-Strike 2 and shows, strafe after strafe, how close you are to a clean stop.

![Strafe Evolution main window](preview.png)

## What it measures

A counter-strafe is the switch from one movement key to the opposite one (for example A to D) to stop before shooting. Strafe Evolution times that switch and classifies it:

- **Early**: you released the first key before pressing the opposite one. The time shown is the gap during which no key was held.
- **Late**: you pressed the opposite key while still holding the first one. The time shown is how long both keys were held together.
- **Perfect**: the gap or overlap stayed under the Perfect threshold (1.6 ms by default). It is recorded as 0 ms.

Switches longer than the maximum evaluated duration (250 ms by default) are ignored as ordinary changes of direction.

## Features

- **Statistics**: median, average, min, max, standard deviation and sample count for Early and Late strafes, with a filter by direction (A → D or D → A).
- **Charts**: a distribution histogram with optional target lines for Early and Late, and a trend view of the last 20 strafes.
- **CS2 metrics**: when you fire (mouse1) within 300 ms of a strafe, the app estimates your residual speed at the shot and whether the shot was accurate (below 85 u/s), plus your average shot delay. "Shots only" mode keeps only strafes followed by a shot.
- **In-game overlay**: a small always-on-top window showing your last strafe, speed at the shot and session accuracy.
  - `Alt + O` shows or hides it.
  - `Ctrl + F11` locks it so clicks pass through to the game; unlock it to drag it elsewhere. Its position is remembered.
- **Sessions**: saving a session, or resetting one with at least 3 strafes, adds it to the history (last 100 sessions are kept). The current strafes can be exported as CSV.
- **Keys**: rebind left, right, forward and backward, or use the QWERTY, AZERTY, arrows and ESDF presets. An AZERTY layout is detected on first launch.
- **Tolerances**: adjustable Perfect threshold, maximum duration and target lines, plus a preset for Rapid Trigger keyboards (Perfect 1.0 ms, max 200 ms, targets 10 and 12 ms).
- **Display**: light and dark themes, colorblind palettes (deuteranopia, protanopia, tritanopia, high contrast), and a distinct shape for each strafe type (◀ Early, ▶ Late, ★ Perfect). Optional sound feedback.

## Install

Download the Windows installer from the [Releases page](https://github.com/seitanmeitoo/strafe-evaluation/releases), run it, then start Strafe Evolution and strafe.

## Build from source

Requirements: [Node.js](https://nodejs.org/) (LTS), [Rust](https://www.rust-lang.org/tools/install) (stable) and, on Windows, the WebView2 runtime (already included in Windows 10 and 11). See the [Tauri v1 prerequisites](https://v1.tauri.app/v1/guides/getting-started/prerequisites) for details.

```bash
npm ci
npm run tauri dev
```

To build the installer:

```bash
npm run tauri build
```

## Limitations

- **Precision**: the keyboard state is read every 0.5 ms, so very short gaps or overlaps are measured with that granularity. Keep this in mind when setting a Perfect threshold close to 1 ms.
- **Global key tracking**: the movement keys and mouse1 are read system-wide while the app runs, including outside the game.
- **Anti-cheat**: some anti-cheat clients (FACEIT in particular) may block global input reading. The app does not interact with the game itself.
- **CS2 metrics are estimates**: residual speed comes from a simplified model of CS2 movement, not from the game.

## License

Strafe Evolution is released under the [GNU General Public License v3.0](LICENSE).

## Credits

Strafe Evolution is based on [strafe-evaluation](https://github.com/patrikzudel/strafe-evaluation) by Patrik Žúdel, also released under the GPL-3.0 license. Built with Tauri, Solid.js, Tailwind CSS, Chart.js and inputbot.
