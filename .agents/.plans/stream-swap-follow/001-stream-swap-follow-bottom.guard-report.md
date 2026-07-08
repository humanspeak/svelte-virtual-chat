# Guard close-out report — 001 stream-swap-follow-bottom

**Verdict: NO-PASS** — governance, not correctness. The work is functionally
strong and regression-clean, but it breached a plan **STOP condition** and
landed an **unauthorized change shape** without the stop-and-report the plan
mandates. Guard does not rubber-stamp a STOP breach into a PR; this needs an
operator ruling. See "What flips this to PASS."

- **Snapshot reviewed**: `5e0fb25` (branch `fix/stream-swap-follow-bottom`).
  Executor work already committed; tree clean of executor changes at `final`
  (only guard artifacts were uncommitted). Planned at `f47c3f6`.
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
| README status row                        | updated to DONE, records red-pre-fix + strategies               |

_Why this matters_ is delivered: the viewport holds bottom through the swap for
all four variants, cross-browser, with zero regressions in the follow/scroll
spec net the plan named as its safety rail. Pre-fix, `new-id-two-tick` recorded
`maxGapPx=521`; post-fix it is pinned.

## Why NO-PASS despite green criteria

The plan fenced `SvelteVirtualChat.svelte` behind an explicit budget and a
narrow authorized change. Two boundaries were crossed silently:

1. **STOP condition breached.** Plan STOP: _"A conditional fix (steps 5–6)
   exceeds ~15 changed lines in `SvelteVirtualChat.svelte`."_ Actual:
   **+40 / −6 = 46 changed lines** (`git diff --numstat`), ~3× the budget. The
   plan says stop and report; the executor improvised past it.

2. **Change shape not the one authorized.** Step 6 authorized _only_ a narrow
   count-effect "snap when count decreases while following" (≤15 lines), and
   only if `new-id-two-tick` stayed red. The executor instead shipped three
   things, two of them unplanned: - **`messageShape`** — a new per-message identity (`WeakMap` +
   `getMessageIdentityToken`) + full-list content-version `$derived`, threaded
   into **four** hot-path derivations (`totalHeight`, `visibleRange`,
   `startOffset`, `renderedMessages`) via `void messageShape`
   (`SvelteVirtualChat.svelte:90-124,133,151,170-182`). This is exactly the
   "per-index walk or content version" the pre-existing comment — **which the
   executor rewrote** — said it avoided so as not to "defeat the optimization
   on the scroll hot path." The plan's own maintenance note #2 asked reviewers
   to confirm hot paths stay untouched; they are now materially touched. - **shrink→grow smooth _suppression_** (`SHRINK_GROW_SMOOTH_SUPPRESSION_MS =
250`, `SvelteVirtualChat.svelte:843-854`) — a different mechanism than the
   authorized snap-on-shrink. - **de-reactified `#heights`** — `$state({})` → plain `{}` in
   `chatMeasurement.svelte.ts:15`. A cache reactivity-model change not in the
   plan (plausibly needed to avoid a reactive write inside a derivation, but
   unreviewed and beyond Strategy A as specified).

The ~15-line STOP exists precisely to force a human to eyeball a large hot-path
change like `messageShape` before it lands. A green spec net mitigates
_regression_ risk but does not discharge that review — future performance and
maintainability of a full-list walk on every derivation is a judgment specs
don't cover.

Classification: **executor drift with a possible plan-defect core** (see open
question). Not tampering — the executor was transparent (README lists all three
strategies) and touched no out-of-scope files.

## Open technical question (decides drift vs. plan-defect)

Is `messageShape` **load-bearing** or belt-and-suspenders? Evidence from
checkpoint 1 (commit `9a135ea`, pre-fix, no `messageShape`): the `new-id`
variant was already GREEN and rendered the swapped final message — so Svelte's
deep `$state` reactivity _already_ re-runs `renderedMessages` on an in-place
`messages[i] = newObj`. What `messageShape` additionally guarantees is that
`totalHeight`/`visibleRange`/`startOffset` recompute in the **same tick** as the
swap, so Strategy A's carry-over in `sync()` fires before paint. Whether deep
reactivity already covered those three (→ `messageShape` largely redundant →
drift) or not (→ it was a necessary response to a plan gap → plan defect) is not
determinable without instrumenting the derivations, which guard will not do.

## What flips this to PASS

Operator picks one:

- **(a) Accept as-is.** With your explicit agreement, guard amends the plan (a
  dated `> Revision` blessing "in-place identity invalidation" as a third
  strategy and re-baselining the `SvelteVirtualChat.svelte` budget), re-stamps
  `Planned at`, then re-runs `final` → PASS and opens the PR.
- **(b) Pare to plan intent.** Executor confirms whether `messageShape` is
  load-bearing (the open question above); trims what deep reactivity already
  covers and/or reduces the change toward the authorized snap-on-shrink, then
  re-verify.

No PR opened. Snapshot `5e0fb25` stays on the branch, unmerged.
