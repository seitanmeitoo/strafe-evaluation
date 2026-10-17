// 800×600 PNG summary of a session, saved to Documents\Strafe Evolution.
import { invoke } from "@tauri-apps/api/tauri";
import { loadSettings, getStrafeColors, STRAFE_SYMBOLS } from "./settings";
import { loadSessions } from "./sessions";
import { currentRank, sessionScore } from "./ranks";
import { formatDuration } from "./feedback";
import { t } from "../i18n";

const pad = (n) => String(n).padStart(2, "0");

const COLORS = {
  background: "#eef1ec",
  panel: "#dfe8da",
  card: "#f8faf6",
  line: "#c7d1c1",
  ink: "#2f3a2c",
  muted: "#56684b",
  accent: "#6e8a5c",
};

const FONT_FAMILY = '"Hanken Grotesk Variable", system-ui, sans-serif';

/** File name for the exported session image: strafe-session-YYYY-MM-DD-HHMMSS.png */
export function shareImageFileName(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const valid = isNaN(d.getTime()) ? new Date() : d;
  const day = `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`;
  const time = `${pad(valid.getHours())}${pad(valid.getMinutes())}${pad(valid.getSeconds())}`;
  return `strafe-session-${day}-${time}.png`;
}

function formatSessionDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length === maxLines) {
          const last = lines[maxLines - 1];
          lines[maxLines - 1] = last.endsWith("…") ? last : `${last}…`;
          return lines;
        }
      }
      currentLine = word;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Draws an 800×600 PNG summary of the session on an off-screen canvas.
 * Uses the light Heritage palette regardless of the current application theme.
 */
export async function drawSessionImage(session) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, 800, 600);

  // 1. Top section: Title and Subtitle
  const leftMargin = 48;
  const contentWidth = 704;

  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 30px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  ctx.fillText(t("app.title"), leftMargin, 48);

  // "Session of Oct 17, 2026, 3:14 PM (3 min)"
  const dateStr = formatSessionDate(session?.timestamp);
  let subtitle = dateStr ? t("feedback.imageSubtitle", { date: dateStr }) : t("feedback.title");
  if ((session?.analysis?.durationSec || 0) >= 10) {
    subtitle += ` (${formatDuration(session.analysis.durationSec)})`;
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = `17px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  ctx.fillText(subtitle, leftMargin, 86);

  // 2. Metrics panel (radius 14)
  const yPanel = 126;
  const panelHeight = 86;
  ctx.fillStyle = COLORS.panel;
  drawRoundedRect(ctx, leftMargin, yPanel, contentWidth, panelHeight, 14);
  ctx.fill();

  const score = sessionScore(session);
  const figures = [
    {
      label: t("feedback.imagePerfect"),
      value: `${Math.round(session?.perfectRate || 0)}%`,
    },
    {
      label: t("feedback.imageMedian"),
      value: `${Math.round(session?.medianDurationMs || 0)} ms`,
    },
    {
      label: t("feedback.imageAccurateShots"),
      value: (session?.totalShots || 0) > 0 ? `${Math.round(session.accurateRate || 0)}%` : "–",
    },
    {
      label: t("feedback.imageScore"),
      value: score != null ? `${Math.round(score)}` : "–",
    },
  ];

  const colWidth = contentWidth / 4;
  figures.forEach((fig, i) => {
    const colX = leftMargin + i * colWidth + 20;

    ctx.fillStyle = COLORS.muted;
    ctx.font = `15px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.fillText(fig.label, colX, yPanel + 14);

    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold 34px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.fillText(fig.value, colX, yPanel + 36);
  });

  // 3. Rank line
  const settings = loadSettings();
  const rank = currentRank(loadSessions(), settings?.ranks);
  let curY = yPanel + panelHeight + 20;

  if (rank && rank.name) {
    ctx.fillStyle = COLORS.ink;
    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.fillText(t("feedback.imageRank", { name: rank.name }), leftMargin, curY);
    curY += 28;
  }

  // 4. Strafe mix (704 px wide, 22 px high)
  const yBar = curY;
  const barHeight = 22;
  const perfectCount = session?.perfectCount || 0;
  const earlyCount = session?.earlyCount || 0;
  const lateCount = session?.lateCount || 0;
  const total = perfectCount + earlyCount + lateCount;
  const colors = getStrafeColors(settings?.colorblindMode);

  if (total > 0) {
    const wPerfect = Math.round((perfectCount / total) * contentWidth);
    const wEarly = Math.round((earlyCount / total) * contentWidth);
    const wLate = contentWidth - wPerfect - wEarly;

    ctx.save();
    drawRoundedRect(ctx, leftMargin, yBar, contentWidth, barHeight, 4);
    ctx.clip();

    if (wPerfect > 0) {
      ctx.fillStyle = colors.perfect;
      ctx.fillRect(leftMargin, yBar, wPerfect, barHeight);
    }
    if (wEarly > 0) {
      ctx.fillStyle = colors.early;
      ctx.fillRect(leftMargin + wPerfect, yBar, wEarly, barHeight);
    }
    if (wLate > 0) {
      ctx.fillStyle = colors.late;
      ctx.fillRect(leftMargin + wPerfect + wEarly, yBar, wLate, barHeight);
    }
    ctx.restore();
  }

  // Bar outline
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, leftMargin, yBar, contentWidth, barHeight, 4);
  ctx.stroke();

  // Legend under the bar
  const yLegend = yBar + barHeight + 10;
  const legendItems = [
    {
      symbol: STRAFE_SYMBOLS.perfect || "★",
      color: colors.perfect,
      text: ` ${perfectCount} ${t("feedback.imageLegendPerfect")}`,
    },
    {
      symbol: STRAFE_SYMBOLS.early || "◀",
      color: colors.early,
      text: ` ${earlyCount} ${t("feedback.imageLegendEarly")}`,
    },
    {
      symbol: STRAFE_SYMBOLS.late || "▶",
      color: colors.late,
      text: ` ${lateCount} ${t("feedback.imageLegendLate")}`,
    },
  ];

  let legendX = leftMargin;
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  for (const item of legendItems) {
    ctx.fillStyle = item.color;
    ctx.fillText(item.symbol, legendX, yLegend);
    legendX += ctx.measureText(item.symbol).width;

    ctx.fillStyle = COLORS.ink;
    ctx.fillText(item.text, legendX, yLegend);
    legendX += ctx.measureText(item.text).width + 24;
  }

  curY = yLegend + 32;

  // 5. Next step recommendation
  if (session?.feedback?.recommendation) {
    const rec = session.feedback.recommendation;
    const recText = t(`feedback.${rec.key}`, rec.params || {});

    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";
    ctx.fillText(t("feedback.recommendationTitle"), leftMargin, curY);

    curY += 24;

    ctx.fillStyle = COLORS.ink;
    ctx.font = `15px ${FONT_FAMILY}`;
    const lines = wrapText(ctx, recText, contentWidth, 3);
    for (const line of lines) {
      ctx.fillText(line, leftMargin, curY);
      curY += 22;
    }
  }

  // 6. Footer, bottom-left (48 px margins)
  ctx.fillStyle = COLORS.muted;
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.textBaseline = "bottom";
  ctx.fillText(
    t("feedback.imageFooter", { count: session?.totalStrafes || 0 }),
    leftMargin,
    600 - 48
  );

  return canvas;
}

/**
 * Draws the session image, converts to PNG bytes, and invokes Tauri's save_image command.
 * Resolves with the saved file's full path.
 */
export async function saveSessionImage(session) {
  const canvas = await drawSessionImage(session);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to create PNG blob"));
    }, "image/png");
  });
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  const date = session?.timestamp ? new Date(session.timestamp) : new Date();
  const fileName = shareImageFileName(isNaN(date.getTime()) ? new Date() : date);
  return invoke("save_image", { fileName, bytes });
}
