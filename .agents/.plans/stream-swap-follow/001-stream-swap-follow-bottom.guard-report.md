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
- PR: [#54](https://github.com/humanspeak/svelte-virtual-chat/pull/54) (base
  `main`, opened via the `pr` skill). Merging is the operator's call; guard does
  not merge.

## Post-close-out addendum 2026-07-08 — `trunk check` gap (PASS qualified)

The `final` gate ran `pnpm run check` (svelte-check) but **not `trunk check`**,
the repo's actual pre-commit/CI lint gate (flagged in the plan's Commands
notes). Operator ran `trunk check` and it reports **3 executor-owned lint
failures in the accepted work** — guard is read-only on source, so these return
to the executor:

1. `chatMeasurement.svelte.ts:26` — `#lastSyncedMessages` is now **dead code**
   (5 writes, 0 reads): the fix deleted its only reader (the
   `messages === this.#lastSyncedMessages` reference-equality early return).
   Remove the field + its write sites, or restore a reader. **Direct artifact of
   the fix.**
2. `chatMeasurement.svelte.ts:305` — `new Set(newIds)` trips
   `svelte/prefer-svelte-reactivity` (`high`). The Set is a throwaway local for
   membership testing, so `SvelteSet` is semantically wrong here — resolve with
   a justified `eslint-disable-next-line`, not a reactive Set.
3. `stream-swap/+page.svelte:194` — `{#each VARIANTS as option}` missing a key
   (`svelte/require-each-key`). Convention drift; add `(option)`.

**Resolution (operator-directed):** the operator authorized fixing the 3 source
issues directly (guard stepping out of its read-only role as Claude Code, with
explicit approval — logged here for the record). All three fixed: dead field +
its 5 write sites removed, `Set` given a justified `eslint-disable` with
rationale, `{#each}` keyed. `trunk check` → **0 issues** (10 files); unit cache
suite 51/51 and stream-swap chromium 5/5 re-confirmed green (behavior
preserved). Guard also fixed its own bare-URL MD034 hit. **Merge-ready.**

Process note for future `final` gates: add `trunk check` to the re-run set — a
green `pnpm run check` (svelte-check) does not cover eslint/markdownlint, and
`trunk` is this repo's real pre-commit/CI gate.
