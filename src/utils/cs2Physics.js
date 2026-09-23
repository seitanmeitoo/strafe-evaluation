export const ACCURATE_SPEED_RATIO = 0.34;
export const START_SPEED_TAU_MS = 143;
export const FRICTION_TO_ACCURATE_MS = 230;
export const ACTIVE_COUNTER_TO_ACCURATE_MS = 80;
export const CS2_MAX_SPEED = 250;

const FRICTION_DECEL_RATE = (1.0 - ACCURATE_SPEED_RATIO) / FRICTION_TO_ACCURATE_MS;
const ACTIVE_DECEL_RATE = (1.0 - ACCURATE_SPEED_RATIO) / ACTIVE_COUNTER_TO_ACCURATE_MS;

/**
 * Calculates initial speed ratio based on movement duration prior to counter-strafe.
 * @param {number|null} movementDurationMicros
 * @returns {number} Speed ratio between 0.0 and 1.0
 */
export function getInitialSpeedRatio(movementDurationMicros) {
  if (movementDurationMicros == null || movementDurationMicros <= 0) {
    return 1.0;
  }
  const moveMs = movementDurationMicros / 1000;
  return Math.min(1.0, 1.0 - Math.exp(-moveMs / START_SPEED_TAU_MS));
}

/**
 * Calculates residual speed and accuracy at the moment of the shot.
 * @param {Object} strafe
 * @returns {Object|null} { speedRatio, residualSpeed, isAccurate } or null if no shot
 */
export function calculateSpeedAtShot(strafe) {
  if (!strafe || strafe.shot_delay == null) {
    return null;
  }

  const shotDelayMs = strafe.shot_delay / 1000;
  const durationMs = (strafe.duration || 0) / 1000;
  const v0 = getInitialSpeedRatio(strafe.movement_duration);

  let v = v0;

  switch (strafe.type) {
    case "Early":
      if (shotDelayMs <= durationMs) {
        v = Math.max(0, v0 - shotDelayMs * FRICTION_DECEL_RATE);
      } else {
        const vAtCounter = Math.max(0, v0 - durationMs * FRICTION_DECEL_RATE);
        const activeTime = shotDelayMs - durationMs;
        v = vAtCounter - activeTime * ACTIVE_DECEL_RATE;
      }
      break;

    case "Late":
      if (shotDelayMs <= durationMs) {
        v = Math.max(0, v0 - shotDelayMs * FRICTION_DECEL_RATE);
      } else {
        const vAtRelease = Math.max(0, v0 - durationMs * FRICTION_DECEL_RATE);
        const activeTime = shotDelayMs - durationMs;
        v = vAtRelease - activeTime * ACTIVE_DECEL_RATE;
      }
      break;

    case "Perfect":
    default:
      v = v0 - shotDelayMs * ACTIVE_DECEL_RATE;
      break;
  }

  const speedRatio = Math.max(0, Math.min(1.0, Math.abs(v)));
  const residualSpeed = Math.round(speedRatio * CS2_MAX_SPEED * 10) / 10;
  const isAccurate = speedRatio <= ACCURATE_SPEED_RATIO;

  return {
    speedRatio,
    residualSpeed,
    isAccurate,
  };
}

/**
 * Calculates aggregate CS2 tactical metrics for a list of strafes.
 * @param {Array} strafes
 * @returns {Object}
 */
export function getCs2Metrics(strafes = []) {
  const strafesWithShot = strafes.filter(
    (s) => s && s.shot_delay != null && s.shot_delay !== undefined
  );

  if (strafesWithShot.length === 0) {
    return {
      totalShots: 0,
      accurateShots: 0,
      accurateRate: 0,
      avgShotDelay: 0,
      avgResidualSpeed: 0,
    };
  }

  let totalDelay = 0;
  let totalResidualSpeed = 0;
  let accurateShots = 0;

  for (const s of strafesWithShot) {
    totalDelay += (s.shot_delay || 0) / 1000;
    const evaluation = calculateSpeedAtShot(s);
    if (evaluation) {
      totalResidualSpeed += evaluation.residualSpeed;
      if (evaluation.isAccurate) {
        accurateShots++;
      }
    }
  }

  const totalShots = strafesWithShot.length;
  const accurateRate = Math.round((accurateShots / totalShots) * 1000) / 10;
  const avgShotDelay = Math.round((totalDelay / totalShots) * 10) / 10;
  const avgResidualSpeed = Math.round((totalResidualSpeed / totalShots) * 10) / 10;

  return {
    totalShots,
    accurateShots,
    accurateRate,
    avgShotDelay,
    avgResidualSpeed,
  };
}
