# Guard report — 002 overflow-anchor-follow-bottom

**Recommendation: PASS** — every done criterion re-run and reproduced green; the pre-paint guarantee is delivered by CSS scroll anchoring, the two races the plan chased are fixed rather than made rarer, and the height cache is back behind its fence.

**Reviewed at** `f01a166` · 2026-07-09 17:09 · **Plan planned at** `f01a166`

**Integrated** — PR <https://github.com/humanspeak/svelte-virtual-chat/pull/55> opened via the `pr` skill for the reviewed snapshot commit (`f01a166`). Merging is the operator's call; guard never merges.

Drift check `git diff --stat f01a166..HEAD -- <source paths>` → empty. The tree did not move under this review.

## Done criteria

| Criterion                                                                                       | Result | Evidence                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run check` exits with `0 ERRORS 0 WARNINGS`                                               | met    | `COMPLETED 425 FILES 0 ERRORS 0 WARNINGS`                                                                                            |
| `npx vitest run` exits 0                                                                        | met    | 8 files, **150 tests passed** (up from 141 at base)                                                                                  |
| `stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"` → 0 failed         | met    | 25 passed (1.9m) — the criterion that could not be reproduced at the previous close-out                                              |
| `-g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3` → 0 failed  | met    | 18 passed (7.1m) — now covers **both** `new-id-regrow` and `new-id-two-tick`                                                         |
| `npx playwright test --project=chromium` → 0 failed                                             | met    | 109 passed, 0 failed (3.5m)                                                                                                          |
| `--project=firefox --project=webkit --project=mobile-chrome --project=mobile-safari` → 0 failed | met    | firefox+webkit 218 passed; mobile-chrome+mobile-safari 202 passed. **Zero failures across the entire matrix.**                       |
| `grep -n "overflow-anchor: none"` shows it on wrappers/header/footer, not on the viewport       | met    | viewport `auto` `:1123`; header `:1137`, reserve spacer `:1150`, wrapper `:1158`, footer `:1178` all `none`; sentinel `auto` `:1168` |
| `anchor-probe.spec.ts` asserts `firstFrameGap === 0` for C, passes 3 engines                    | met    | asserts control **A** and **C**; A=0, B=299, C=0 in chromium/firefox/webkit                                                          |
| `002-findings.md` records streaming `maxGapPx` before/after + answers the open question         | met    | before `maxGapPx=24`, after `maxGapPx=0`, both measured on the signed oracle; Persistent-Strand Question present                     |
| `git status` shows no modified files outside the Scope list                                     | met    | only guard's own plan files and the plan-acknowledged untracked `tests/chat/regrow-trace.debug.ts`                                   |
| Batch `README.md` status row updated                                                            | met    | `README.md:18`                                                                                                                       |

Guard additionally repeat-sampled the variant that failed at the previous gate:
`new-id-two-tick --repeat-each=10` → **webkit 10/10, mobile-safari 10/10, mobile-chrome 10/10** (each was 1-in-10 failing at `f0299fc`).

## Spirit

The plan asked one question — _can CSS scroll anchoring give follow-bottom a pre-paint guarantee that a `scrollTop` write from a ResizeObserver callback cannot?_ — and the answer landed, with the evidence to back it.

Guard verified the core claim **independently of both the old and the new fixture oracle**, by measuring the user-visible defect directly (the tail message wrapper's `bottom` against the viewport's `bottom`) across 25 regrow attempts per library version on chromium: **3/25 runs painted a real off-bottom frame (worst 408px) without the change; 0/25 with it.** Scroll anchoring, scoped to a sentinel inside the transformed absolutely-positioned subtree, pins the bottom inside layout, before paint, in all three engines.

Two things distinguish this from the two NO-PASS rounds that preceded it, and both matter more than the green checkmarks:

**The fixes are fixes, not probability reductions.** The plan's central lesson — recorded in its own `Evidence` and rejected-findings — is that no JS-timing hook (rAF, ResizeObserver, microtask) can guarantee a pre-paint write, so a change that lowers a failure rate without eliminating it is worse than none. Checkpoint 3 caught a `snapToBottomPrePaint()` call in the count effect that cut `new-id-two-tick` from failing to failing-less-often; it is gone. In its place is a layout-level answer: when a measured tail suffix is removed, its height is held as a reserve so total content height never moves during the remove→add window, and anchoring has nothing to compensate for. Repeat-sampling confirms the difference: 1-in-10 → 0-in-30 across the three affected projects.

**The fence around the height cache held, and it was worth holding.** Checkpoint 5 found the reserve implemented as new state inside `chatMeasurement.svelte.ts`, which `Scope` fences precisely because "scroll anchoring is meant to make the height cache's timing irrelevant, not to change the cache." That state leaked: it was set in `sync()`'s tail-shrink branch and cleared in every other branch, so a **permanent** tail deletion left the removed message's full height as phantom space forever — a first-class LLM-chat interaction (delete or regenerate the last assistant reply) silently broken, invisible to 143 unit tests and five browser projects. The reserve now lives in `chatTailSwapCarry.ts` with a bounded 250ms clear timer, and `chatMeasurement.svelte.ts` is back to base plus the one authorized `collectPitchChanges` child-filter. Guard reproduced the leak's absence with a throwaway fixture that deletes the tail and never re-appends (`scrollHeight` 1104 → 1128 during the reserve window → **1032** after settle), and confirmed that same test is **red** against the previous snapshot `d8c084e` (stuck at 1128) — so the fix is real and the test is sensitive to the bug, not vacuously green.

The plan's own open question is answered honestly rather than buried: `002-findings.md` records that no failing run ever reported `following=false` or `finalGap > 2`. This plan fixes **transients**. The originally reported real-world Firefox symptom — a viewport that stays stranded — remains unreproduced and unexplained, and a green matrix here must not be read as closing it.

## Scope & conduct

- **In-scope only?** Yes, as amended. Source touched: `SvelteVirtualChat.svelte`, `chatMeasurement.svelte.ts` (authorized filter only), `chatMeasurement.svelte.test.ts`, `chatTailSwapCarry.ts` + `.test.ts`, `stream-swap/+page.svelte`, `anchor-probe.spec.ts`, `stream-swap.spec.ts`, `header-footer.spec.ts`. Verified UNTOUCHED by `git diff --stat 9f54732...f01a166`: `chatScrollPolicy.ts`, `chatAnchoring.ts`, `chatVisualAnchoring.ts`, `tests/helpers.ts`, `docs/`.
- **STOP conditions respected?** Not throughout. Two were skipped mid-execution and both were caught and corrected before this gate: a JS-timing hook (checkpoint 3 NO-PASS) and cache state added to the fenced module (checkpoint 5 NO-PASS). Neither survives in `f01a166`. Recorded here because a PASS should not erase the path to it: this plan reached a correct answer through two rejected ones, and the repeat-sampled gates are what surfaced them.
- **Tampering?** None across six checkpoints. The plan file's history contains only guard's own amendments; no `Done criterion` and no `STOP condition` was ever weakened, by anyone.
- **Plan amendments during execution:** three, all operator-approved, all **strengthening**.
    1. **2026-07-09** — `Scope` opened for `stream-swap/+page.svelte` to replace the fixture's bottom-gap oracle. Enabling anchoring makes the legacy `scrollHeight - clientHeight - scrollTop` metric a false positive during the shrink half of a swap (the browser corrects `scrollTop` a frame before the JS-driven spacer resizes). The replacement is strictly stronger — **signed**, not clamped — and immediately caught a webkit blank-space regression the clamped one was structurally blind to.
    2. **2026-07-09b** — `chatMeasurement.svelte.ts` opened for the `collectPitchChanges` child-filter **only**, with "no new cache state, fields, or public getters" written into both `Scope` and the STOP clause. That wording is what made checkpoint 5's violation unambiguous.
    3. **2026-07-09c** — `Scope` extended to name `chatTailSwapCarry.ts` + its test (the reserve's correct home), the `chatMeasurement.svelte.test.ts` characterization test that asserts the cache does **not** carry height, and the `header-footer.spec.ts` wait-hardening (`expect.poll`; assertions and thresholds unchanged).
- **Branch hygiene.** Two commits from an unrelated `typed-lint` initiative sit on this branch (`61fe9e4`, `6b1634d`). Neither touches `src/` or `tests/`, so they do not affect these results, but they will ride the PR.

## Residual risk / follow-ups

- **The leak has no committed regression test.** Guard proved the fix with a throwaway fixture that permanently deletes the tail message, then deleted it — guard does not author source. Nothing in the repo would catch a reintroduction of the exact bug that cost a full cycle. `chatTailSwapCarry.test.ts` covers the module's carry logic; the component's 250ms clear timer, which is what actually closes the leak, is untested. **This is the highest-value follow-up.**
- **`TAIL_SWAP_RESERVE_MS = 250` is a magic number.** If a consumer's store takes longer than 250ms to deliver the replacement message, the reserve clears, the bottom collapses, and the original race returns. Convex round-trips and slow networks can exceed that. Worth either deriving the window or documenting the assumption.
- **Anchor selection is the load-bearing layout invariant.** Any element added inside the viewport without an explicit `overflow-anchor: none` can steal selection from the sentinel and silently reintroduce the original bug, with no failure except the stress test. Reviewers: check every new element inside the viewport. The reserve spacer correctly carries `overflow-anchor: none` (`SvelteVirtualChat.svelte:1150`).
- **A `border-top` on the viewport disables anchoring in webkit** unless the sentinel is taller than it — webkit offsets its anchor-visibility test by the top border width (plan Evidence item 7). `viewportClass` is a public prop, so this is a supported-configuration hazard, handled by `syncAnchorSentinelHeight()` deriving `ceil(borderTopWidth + 1)`. It deserves a line in the `viewportClass` prop docs. It is also the first thing to check if a consumer reports "follow-bottom is broken in Safari only."
- **`collectPitchChanges` now trusts only `data-message-id` children.** Any future non-message child of `itemsEl` is therefore safe by construction — but any future _message_ wrapper that forgets the attribute will be silently skipped from measurement.
- **Only `new-id-regrow` and `new-id-two-tick` are stress-sampled.** `same-id` and `new-id` remain single-sampled. Twice on this plan a real bug hid behind a single green run; the remaining variants deserve the same treatment.
- **The persistent-strand question stays open** (see Spirit). Do not close the reported Firefox issue on the strength of this plan. The tracer at `tests/chat/regrow-trace.debug.ts` (untracked; commit it or delete it deliberately) is adaptable to a real-app trace and is the fastest path to settling it.
