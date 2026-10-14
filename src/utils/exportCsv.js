import { calculateSpeedAtShot } from "./cs2Physics";

export function exportStrafesToCsv(strafes, filename = "strafe-evaluation-export.csv") {
  if (!strafes || strafes.length === 0) {
    alert("Aucune donnée de strafe à exporter.");
    return false;
  }

  const headers = [
    "Date_Heure",
    "Type",
    "Duree_ms",
    "Direction",
    "Diagonale",
    "Delai_Tir_ms",
    "Vitesse_Residuelle_u_s",
    "Tir_Precis_CS2",
  ];

  const rows = strafes.map((s) => {
    const evalResult = calculateSpeedAtShot(s);
    const hasShot = s.shot_delay != null;
    const durationMs = (s.duration / 1000).toFixed(1);
    const shotDelayMs = hasShot ? (s.shot_delay / 1000).toFixed(1) : "N/A";
    const dir = s.direction === "RightToLeft" ? "D -> A" : "A -> D";
    const isDiag = s.is_diagonal ? "Oui" : "Non";
    const speed = hasShot && evalResult ? evalResult.residualSpeed : "N/A";
    const accurate = hasShot && evalResult ? (evalResult.isAccurate ? "Oui" : "Non") : "N/A";
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
