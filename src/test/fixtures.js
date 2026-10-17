// Builders for test data. Durations are in microseconds, like the backend sends them.
let counter = 0;

export function strafe(overrides = {}) {
  counter += 1;
  return {
    type: "Perfect",
    direction: "LeftToRight",
    duration: 0,
    is_diagonal: false,
    shot_delay: null,
    movement_duration: 300000,
    timestamp: new Date(Date.UTC(2025, 0, 1, 12, 0, counter)).toISOString(),
    ...overrides,
  };
}

/** `count` strafes with the same properties. */
export function strafes(count, overrides = {}) {
  return Array.from({ length: count }, () => strafe(overrides));
}

export function session(overrides = {}) {
  counter += 1;
  return {
    id: `session_${counter}`,
    timestamp: new Date(Date.UTC(2025, 0, 1, 12, 0, 0) + counter * 60000).toISOString(),
    totalStrafes: 50,
    perfectRate: 50,
    medianDurationMs: 10,
    totalShots: 0,
    accurateRate: 0,
    ...overrides,
  };
}
