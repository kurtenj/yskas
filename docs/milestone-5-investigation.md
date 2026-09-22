# Milestone 5 investigation — September 21, 2026

Follow-up: the user deferred Jev, requested a Luna comparison, and approved migrating the estimator after reviewing the pilot. See [the pilot and approved migration](milestone-5-luna-pilot.md). The investigation below records the earlier decision and remaining evaluation limitations.

Decision: keep the nutrition accuracy evaluation work; defer Jev (LLM-as-a-judge) until we can demonstrate value beyond reference checks. This is an architectural recommendation, not a measured finding that judges cannot work. No judge experiment, paid provider request, UI change, or production estimator change was made during this investigation.

## Milestone 4 release verification

PR #4 was squash-merged as `beb51b89a9b223676fe9b77842cdeec2001bea9c`. Vercel deployment `dpl_CLNRucnRmVggrZkfwDu6Q4UmQVxK` is Ready and serves the production alias. The live backend is `agreeable-stork-227`, despite its development deployment classification; the nominal production deployment is not the application's current backend.

Authenticated production checks passed for the application page, token exchange, profile list, selected-profile reads, daily meals, and recent-meal queries for both household profiles. Malformed profile selection returned null. An empty estimate request returned 400 before invoking the provider. These checks made no meal writes or paid provider calls; they do not establish end-to-end save behavior, production latency distributions, or billed read savings. Existing M4 pre-merge validation covered 106 unit/backend and 12 browser tests, TypeScript, lint and production build.

Main is updated; the M4 branch was removed locally and remotely. KUR-262 and KUR-273 are Done. Investigation continues on `milestone-5-investigation`. Production traffic measurements remain in KUR-274.

## Evidence and gaps

The estimator in `lib/estimator.ts` already uses a short prompt, strict six-field JSON, a 256-token output cap, and no automatic retries. Its output contains a meal name and aggregate nutrients, without ingredient amounts or preparation assumptions. The prompt explicitly uses typical US servings when quantities are absent.

The M3 benchmark (`docs/milestone-3-benchmark.json`) measured six synthetic meals per version. Current estimates cost $0.0002787 in total, approximately $0.00004645 each, with a 986 ms sample median. It verified successful output, not nutrition accuracy. Six cases cannot establish production latency or average cost.

For a description such as “milk with protein powder,” neither estimator nor judge can recover the actual brand, milk type, or scoop size from absent information. A second plausible answer is not independent ground truth. A judge may catch ignored explicit facts or ingredient omissions, but aggregate totals do not reveal which ingredient caused an error. Its issue flag also needs a separate correction policy before any saved number improves.

OpenAI recommends calibrating model graders against human labels and controlling position and verbosity bias. Pass/fail or pairwise evaluation is preferable to an unconstrained quality score. This supports evaluation before deployment, rather than assuming agreement implies accuracy. [Evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

Nutrition references need their serving basis and food identity preserved. USDA distinguishes analytically derived foods, survey portion data, and manufacturer label data; they should not be treated as interchangeable exact answers. [FoodData Central documentation](https://fdc.nal.usda.gov/data-documentation/)

## Options

| Option | What it provides | Assessment |
| --- | --- | --- |
| Reference fixtures and numeric graders | Reproducible calorie/protein/fiber error and regression detection | First priority; no extra runtime call |
| Focused prompt change | Potentially fixes a demonstrated recurring failure | Compare on held-out cases before adopting |
| Model replacement | Potential quality improvement in one request | Compare only after establishing baseline errors |
| Offline judge | Scalable review of semantic mistakes numeric checks miss | Conditional experiment after references and reviewed labels exist |
| Judge on every meal | Immediate second opinion | Defer: adds a request and serial latency without demonstrated correction benefit |
| Runtime food lookup/cache | Additional evidence or reuse | Separate decision; requires matching or traffic evidence and adds infrastructure |

Illustrative cost only: a GPT-4.1-mini judge using 500 uncached input and 100 output tokens would cost $0.00036 per meal at published $0.40/$1.60 per million input/output tokens. Added to the small M3 sample mean, that is about 8.75 times the estimator-only cost, or $4.06 instead of $0.46 per 10,000 estimates. The dollar amount is small; relative cost, additional latency, and maintenance still need a demonstrated benefit. This is not a measured judge workload or a model recommendation. [Pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

## Recommended smaller M5

1. Start KUR-270 with 30–50 carefully sourced cases instead of immediately curating 100–200. Include explicit labels and portion scaling, weighed foods, raw/cooked distinctions, mixed meals, high-protein/fiber foods, known zero versus missing values, and vague inputs. Mark indeterminate cases rather than inventing exact answers. Expand when observed failures justify it.
2. Store source URL/identifier, retrieval date, serving basis, expected values or ranges, and per-field tolerances. Keep recipe/portion families together when splitting tuning and held-out cases. Synthetic arithmetic fixtures test instruction following; they must be reported separately from food accuracy references.
3. Build a small offline runner around the existing estimator and nutrition parser. Default to no provider calls. Paid runs require a configured request/spend budget, preflight reservation, bounded output, and no automatic retries. Record failures, missing usage, prompt/model versions, tokens and latency.
4. Report calorie absolute error and signed bias, protein/fiber gram errors separately, missing-data correctness, schema failures, and category-level outliers. Use absolute error near zero. Retain protein-share error as a secondary diagnostic; do not create a fiber-calorie equivalence. Compare the current estimator with one evidence-driven change, repeating a subset to expose variance.
5. Revisit KUR-271 only if reviewed errors remain that numeric/reference checks cannot usefully classify. Judge an anonymized held-out set containing real baseline failures and correct outputs; report seeded corruptions separately. Use bounded issue codes and short evidence, with no correction or live data writes.

## Judge decision gate

Before a pilot, freeze its rubric and budget. Count additional true issues caught beyond deterministic checks, incorrect approvals and rejections, separately for calories, protein and fiber. Review disagreements against sources; do not let a judge certify itself. Report denominators and uncertainty, not only percentages from a tiny sample.

Proceed with an offline judge only if it consistently finds actionable residual errors at an acceptable false-rejection rate and saves review effort. A small initial set can establish feasibility, not a reliable production error rate. Keep it deferred if prompt/reference improvements address the same errors more simply. Any future runtime trial needs separately defined sampling, latency/cost limits, fallback behavior and correction rules; offline judge success alone does not establish improved saved nutrition.

KUR-270 remains implementation work. KUR-271 remains uncalibrated and must not be marked complete based on this investigation. No new dependency, database table, service, or frontend work is needed for the recommended first step.
