# Luna comparison pilot

Run September 21, 2026 (local Chicago date); branch `milestone-5-investigation`. Production continues to use `gpt-4o-mini` until this PR is merged and deployed. The user subsequently approved switching to Luna based on this pilot. No Jev, Terra, UI changes, deployment, or meal writes.

## Result

Luna is a promising upgrade candidate, particularly for preserving explicit quantities. This pilot supports a broader comparison before switching production; it does not establish general nutrition accuracy.

| Metric | GPT-4o mini | GPT-5.6 Luna |
| --- | ---: | ---: |
| Valid responses | 32/32 | 32/32 |
| Median request latency | 828 ms | 1,023 ms |
| Sample p95 request latency | 1,490 ms | 1,359 ms |
| Total measured token cost | $0.0015237 | $0.0026892 |
| Food-reference calorie MAE | 9 cal | 3.52 cal |
| Food-reference protein MAE | 0.260 g | 0.338 g |
| Food-reference fiber MAE | 0.583 g | 0.629 g |

Cost was 1.76x higher with Luna and median latency 195 ms higher. At this small sample's token usage, 1,000 estimates would cost approximately $0.048 with 4o mini or $0.084 with Luna. These are token-only projections, excluding transcription, hosting, and future changes in workload. Total experiment cost was $0.0042129, within the configured $0.10 cap. All responses included usage.

Both models passed every explicit FDA label scaling case, including half and four servings. Both preserved explicitly unknown fiber and known zero correctly.

The most useful failure was the synthetic shake: 250 ml milk at 60 cal/3 g protein per 100 ml, plus powder at 120 cal/24 g protein. The correct totals are 270 cal and 31.5 g protein. In both rounds 4o mini returned 210 cal and 27 g protein, consistent with incorrectly scaling the milk to 150 ml. Luna returned the correct totals in both rounds. That is an arithmetic/quantity result, not evidence about the nutrition of an unspecified real shake.

For 148 g raw kiwifruit, 4o mini returned 61 cal in both rounds, consistent with using a per-100-g value without scaling. Luna returned 90 cal, matching the FDA reference. Calorie tolerance passes across the six fruit cases, repeated twice, were 8/12 for 4o mini and 12/12 for Luna. All fruit protein/fiber values passed the predeclared tolerances for both models; Luna's numerical MAE was slightly worse against these rounded references.

Ambiguous descriptions remain unresolved: “Milk with protein powder” produced 300 cal both times from 4o mini, versus 220 and 250 cal from Luna. No exact answer was assigned. Luna supplying fiber where 4o mini omitted it is not counted as an accuracy improvement without a known recipe.

## Method and limits

Sixteen fixed cases, two rounds, two models: 64 sequential requests with alternating model order. Same production prompt and strict six-field schema. 4o mini uses the production temperature 0.2 and 256 output cap; Luna uses reasoning `none`, a 256 completion-token cap and no temperature override. Provider retries are disabled. API account access and structured output compatibility were verified.

The set contains four variants of one FDA example label, six raw fruits at specified edible weights, four synthetic instruction-following cases, and two indeterminate descriptions. Labels use 0.01 absolute tolerance; fruit uses max(10 cal, 15%) for calories, 1 g protein and 1.5 g fiber to accommodate rounding and food variability. Those are pilot engineering tolerances, not medical standards. References were checked September 21, 2026. FDA's older, rounded fruit poster is an approximate baseline, not exact composition of an individual fruit.

No prompt tuning occurred after results were inspected. This is a fixed selection pilot, not a separate held-out validation set. Related portion variants and repeats are not independent food examples. There is insufficient coverage of high-protein foods, high-fiber legumes, restaurant meals, preparation methods, or voice transcription to complete KUR-270. Request timings include network variability and cannot establish production p95. The script tests provider output and the production nutrition parser; it does not test the full save workflow or every estimator failure wrapper. A valid response does not imply perfect adherence to every prompt preference, such as meal-name word count.

## Reproduce

```powershell
npx esbuild scripts/compare-luna.ts --bundle --platform=node --packages=external --outfile=.convex/compare-luna.cjs
node --conditions=react-server .convex/compare-luna.cjs
# Explicit paid opt-in; maximum 64 requests, stops on provider error/missing usage.
node --conditions=react-server .convex/compare-luna.cjs --run --budget=0.10
node scripts/summarize-luna.mjs .convex/luna-comparison.json
npx vitest run tests/luna-grading.test.ts
```

The runner loads the local API key without printing it and persists each result. A rerun overwrites the ignored working report. It reserves 8,192 input tokens plus the full output allowance before each call for the bounded small input, then accounts for returned usage. It stops if usage is unavailable or exceeds that reservation. This is a script-level cost guard using the recorded published prices, not an account billing limit.

Artifacts included for review: `milestone-5-luna-results.json` contains all 64 raw synthetic/public-fixture responses and usage; `milestone-5-luna-summary.json` contains per-category scores, signed bias, costs, and latency. Neither contains household records or credentials.

## Approved migration

The estimator now requests `gpt-5.6-luna` with `reasoning_effort: none` and `max_completion_tokens: 256`, removing the old temperature/max_tokens parameters. Prompt and schema remain nutrition-3/schema 3; model provenance distinguishes new estimates. Historical saved meals and reused estimates retain their original data. The metrics script selects the price by model, including both cached-input rates and historical 4o mini pricing. Unknown models remain unpriced rather than being assigned zero cost.

Validation: 110 unit/backend tests, production build (including TypeScript), and lint pass; lint retains four existing generated-file warnings. Request-contract tests verify Luna parameters and provenance; cost tests cover mixed-model logs. The prior live pilot verified 32 Luna calls with these settings. Offline comparison invocation makes no provider requests.

Rollout is through the normal Vercel deployment after PR approval/merge; no Convex schema, environment change, migration, or deployment is required. Roll back by reverting this PR's model/request changes and redeploying Vercel; no data backfill is needed. Keep model-specific pricing for historical logs. Broader high-protein/high-fiber accuracy coverage remains follow-up work rather than a claimed outcome of this pilot.

Sources: [FDA label example](https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label), [FDA raw fruit reference](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version), [Luna capabilities and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [4o mini pricing](https://developers.openai.com/api/docs/models/gpt-4o-mini).
