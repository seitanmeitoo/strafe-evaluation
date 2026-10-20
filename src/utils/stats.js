export function draw_time(time) {
  if (time == null || isNaN(time)) return "0 ms";
  return (time / 1000).toFixed(0) + " ms";
}

export function getMeanAndVar(arr) {
  if (!arr || arr.length === 0) {
    return { average: 0, std_deviation: 0 };
  }

  const sum = arr.reduce((pre, cur) => pre + cur, 0);
  const num = arr.length;
  const average = sum / num;

  let variance = 0;
  arr.forEach((val) => {
    variance += (val - average) * (val - average);
  });
  variance /= num;

  return {
    average: average,
    std_deviation: Math.sqrt(variance),
  };
}

export function getStats(duration_array) {
  if (!duration_array || duration_array.length === 0) {
    return { median: 0, min: 0, max: 0, average: 0, std_deviation: 0, samples: 0 };
  }

  const sorted = Array.from(duration_array).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  const { average, std_deviation } = getMeanAndVar(duration_array);

  return {
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average,
    std_deviation,
    samples: duration_array.length,
  };
}

export function getOccurance(duration_array, maxStrafeMs = 250) {
  const maxMs = typeof maxStrafeMs === "number" && maxStrafeMs > 0 ? maxStrafeMs : 250;
  const binCount = Math.floor(maxMs / 5) + 1;

  if (!duration_array || duration_array.length === 0) {
    return [0];
  }

  const out = new Array(binCount).fill(0);
  duration_array.forEach((x) => {
    const n = Math.ceil(x / 5000);
    if (n >= 0 && n < out.length) {
      out[n] += 1;
    } else if (n >= out.length && out.length > 0) {
      out[out.length - 1] += 1;
    }
  });

  return out;
}

