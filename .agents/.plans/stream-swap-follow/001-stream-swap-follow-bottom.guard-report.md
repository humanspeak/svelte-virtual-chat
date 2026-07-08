# Guard close-out report — 001 stream-swap-follow-bottom

**Verdict: PASS** (operator-approved after a plan amendment). The `final` gate
was initially NO-PASS on governance grounds — the fix crossed a STOP budget and
added an unplanned strategy. The operator reviewed and accepted the work as-is;
guard amended the plan to authorize it and re-baseline the budget. All done
criteria are empirically green with zero regressions. PR opened for the operator
to merge.

- **Snapshot / work commit**: `5e0fb25` (branch `fix/stream-swap-follow-bottom`).
- **Planned at**: `6b7fcc8` (re-stamped on amendment; originally `f47c3f6`).
- **PR**: see "Integration" below.
- **Date**: 2026-07-08.

## Done criteria — all empirically green (re-run, not trusted)

| Criterion                                | Result                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `pnpm run check`                         | **0 ERRORS 0 WARNINGS** (421 files)                             |
| `npx vitest run`                         | **141 passed**; the 3 new carry-over specs present & green      |
| `stream-swap.spec.ts --project=chromium` | **5/5 pass** (4 variants + rerun)                               |
| `--project=chromium` (full)              | **106 passed, 2 skipped, 0 failed**                             |
| firefox/webkit subset                    | **32 passed, 0 failed**                                         |
| `git status` scope                       | all touched files in the Scope list — **no out-of-scope files** |
| README status row                        | updated to DONE (guard PASS, plan amended)                      |

_Why this matters_ is delivered: the viewport holds bottom through the swap for
all four variants, cross-browser, with zero regressions in the follow/scroll
spec net the plan named as its safety rail. Pre-fix, `new-id-two-tick` recorded
`maxGapPx=521`; post-fix it is pinned.

## Governance history: NO-PASS → amend → PASS

The `final` gate first returned **NO-PASS** because the fix crossed two plan
boundaries without the stop-and-report the plan mandated:

1. **STOP budget exceeded** — `SvelteVirtualChat.svelte` changed **+40/−6 = 46
   lines** vs the plan's ~15-line budget for a conditional fix.
2. **Unplanned change shape** — beyond Strategy A the fix added: - **`messageShape`** — per-message `WeakMap` identity + full-list
   content-version `$derived` threaded into four hot-path derivations
   (`totalHeight`, `visibleRange`, `startOffset`, `renderedMessages`;
   `SvelteVirtualChat.svelte:90-182`), the walk the pre-existing (rewritten)
   comment said it avoided for the scroll hot path; - **shrink→grow smooth suppression** (`SHRINK_GROW_SMOOTH_SUPPRESSION_MS =
250`, `SvelteVirtualChat.svelte:843-854`); - **de-reactified `#heights`** (`$state({})`→`{}`, `chatMeasurement.svelte.ts:15`).

**Operator ruling: accept as-is (option a).** Guard therefore amended the plan
(operator-approved), which is the only sanctioned way to move this boundary:

- Dated `> Revision 2026-07-08` note added to the executor-instructions block
  blessing "in-place identity invalidation" as a third strategy.
- The "~15 changed lines" STOP condition struck through and marked superseded.
- `Planned at` re-stamped `f47c3f6`→`6b7fcc8`.
- Batch README row + guard note updated.

This is a bounded, evidence-backed acceptance — not the "weaken the plan to
rubber-stamp weak work" anti-pattern: the work is regression-clean and delivers
the plan's purpose; only the change's size/authorization was in question, and
the operator has now authorized it.

## Residual note for future maintainers

`messageShape` rebuilds a full-list string on every one of four derivations
whenever any message changes — a deliberate trade of hot-path work for
correctness. Checkpoint-1 evidence (`new-id` green pre-fix) suggests Svelte's
deep `$state` reactivity may already cover `renderedMessages` re-runs; if a
future perf pass revisits the scroll hot path, confirm which derivations
genuinely need the `void messageShape` dependency and trim any that are
redundant. Tracked here rather than blocking the merge.

## Integration

- Work commit: `5e0fb25` (already on the branch).
- PR: **https://github.com/humanspeak/svelte-virtual-chat/pull/54** (base `main`,
  opened via the `pr` skill). Merging is the operator's call; guard does not merge.
