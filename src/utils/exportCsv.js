import { calculateSpeedAtShot } from "./cs2Physics";
import { loadSettings, formatKeyDisplay } from "./settings";
import { t } from "../i18n";

export function exportStrafesToCsv(strafes, filename = "strafe-evaluation-export.csv") {
  if (!strafes || strafes.length === 0) {
    alert(t("csv.noData"));
    return false;
  }

  const currentSettings = loadSettings();
  const leftKey = formatKeyDisplay(currentSettings?.keys?.left || "A");
  const rightKey = formatKeyDisplay(currentSettings?.keys?.right || "D");

  const headers = [
    t("csv.dateTime"),
    t("csv.type"),
    t("csv.durationMs"),
    t("csv.direction"),
    t("csv.diagonal"),
    t("csv.shotDelayMs"),
    t("csv.residualSpeed"),
    t("csv.accurateShot"),
  ];

  const rows = strafes.map((s) => {
    const evalResult = calculateSpeedAtShot(s);
    const hasShot = s.shot_delay != null;
    const durationMs = (s.duration / 1000).toFixed(1);
    const shotDelayMs = hasShot ? (s.shot_delay / 1000).toFixed(1) : "N/A";
    const dir = s.direction === "RightToLeft" ? `${rightKey} -> ${leftKey}` : `${leftKey} -> ${rightKey}`;
    const isDiag = s.is_diagonal ? t("csv.yes") : t("csv.no");
    const speed = hasShot && evalResult ? evalResult.residualSpeed : "N/A";
    const accurate = hasShot && evalResult ? (evalResult.isAccurate ? t("csv.yes") : t("csv.no")) : "N/A";
    const timestamp = s.timestamp || new Date().toISOString();

    return [
      `"${timestamp}"`,
      `"${s.type}"`,
      durationMs,
      `"${dir}"`,
      `"${isDiag}"`,
      shotDelayMs,
      speed,
      `"${accurate}"`,
    ].join(";"); // Semicolon is Excel's default delimiter in Europe/France
  });

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
