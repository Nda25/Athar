function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function createPerf(functionName, event) {
  const enabled = process.env.PERF_LOGS !== "0";
  const start = nowMs();
  const marks = [];

  return {
    mark(label) {
      if (!enabled) return;
      marks.push({ label, ms: nowMs() - start });
    },
    end(extra) {
      if (!enabled) return;
      const total = nowMs() - start;
      console.log(
        "[perf]",
        JSON.stringify({
          fn: functionName,
          method: event?.httpMethod || "",
          path: event?.path || event?.rawUrl || "",
          total_ms: Number(total.toFixed(1)),
          marks,
          ...(extra || {}),
        })
      );
    },
  };
}

module.exports = { createPerf };
