import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(process.argv[2] ?? ".convex/luna-comparison.json", "utf8"));
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const summary = { measuredAt: report.measuredAt, knownCostUsd: report.knownCostUsd, models: {} };
for (const model of new Set(report.rows.map((r) => r.model))) {
  const rows = report.rows.filter((r) => r.model === model);
  const times = rows.map((r) => r.durationMs).filter(Number.isFinite).sort((a, b) => a - b);
  const costs = rows.map((r) => r.costUsd).filter(Number.isFinite);
  const groups = {};
  for (const category of new Set(rows.map((r) => r.category))) {
    const samples = rows.filter((r) => r.category === category);
    groups[category] = { requests: samples.length, valid: samples.filter((r) => r.outcome === "success").length, nutrients: {} };
    for (const field of ["calories", "protein", "fiber"]) {
      const graded = samples.map((r) => r.scores?.[field]).filter(Boolean);
      const errors = graded.map((g) => g.error).filter(Number.isFinite);
      groups[category].nutrients[field] = { graded: graded.length, pass: graded.filter((g) => g.pass).length, numericSamples: errors.length, mae: mean(errors.map(Math.abs)), bias: mean(errors) };
    }
  }
  summary.models[model] = { requests: rows.length, valid: rows.filter((r) => r.outcome === "success").length, missingCost: rows.length - costs.length, knownCostUsd: costs.reduce((a, b) => a + b, 0), p50Ms: times.length ? times[Math.ceil(times.length * 0.5) - 1] : null, sampleP95Ms: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null, groups };
}
console.log(JSON.stringify(summary, null, 2));
