# Guard report — 002 overflow-anchor-follow-bottom

**Recommendation: NO-PASS** — the cross-engine done criterion fails: `new-id-two-tick` leaves 521px of blank space below the tail on ~10% of runs in webkit, mobile-safari and mobile-chrome. The core fix is sound and proven; the shrink/removal patch bolted onto it is a probability reduction, not a fix.

**Reviewed at** `f0299fc` · 2026-07-09 13:54 · **Plan planned at** `a544bc7`

_No PR opened. The reviewed snapshot stays on `fix/overflow-anchor-follow-bottom`, unmerged._

Drift check `git diff --stat a544bc7..HEAD -- <source paths>` → `tests/chat/anchor-probe.spec.ts` only (6 insertions), in scope. The tree did not move under this review.

## Done criteria

| Criterion                                                                           | Result   | Evidence                                                                                                           |
| ----------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm run check` exits 0 errors                                                     | met      | `COMPLETED 423 FILES 0 ERRORS 0 WARNINGS`                                                                          |
| `npx vitest run` exits 0                                                            | met      | 7 files, 141 tests passed                                                                                          |
| `stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"`        | met      | 25 passed (1.8m)                                                                                                   |
| `-g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3` | met      | 9 passed (4.1m)                                                                                                    |
| `npx playwright test --project=chromium` → 0 failed                                 | met      | 108 passed, 2 skipped, 0 failed (2.9m)                                                                             |
| `--project=firefox --project=webkit` → 0 failed                                     | met\*    | 216 passed, 4 skipped (\*single sample — see Spirit; webkit `new-id-two-tick` fails 1-in-10 on repeat)             |
| `--project=mobile-chrome --project=mobile-safari` → 0 failed                        | **FAIL** | **1 failed**, 199 passed, 20 skipped — `[mobile-safari] new-id-two-tick`, `Expected <= 48, Received 521`           |
| `grep overflow-anchor` → `none` on wrappers/header/footer, not on viewport          | met      | viewport `auto` `:1069`; header `:1083`, wrapper `:1106`, footer `:1118` all `none`; sentinel `auto` `:1097`       |
| `anchor-probe.spec.ts` asserts C `firstFrameGap === 0`, passes 3 engines            | met      | asserts A `:155-156` **and** C `:159-160`; A=0, B=299, C=0 in chromium/firefox/webkit                              |
| `002-findings.md` records streaming `maxGapPx` before/after + open question         | met      | `:95` before `maxGapPx=24`, `:102` after `maxGapPx=0`, both on the signed oracle; `:71` Persistent-Strand Question |
| `git status` — no modified files outside Scope                                      | met      | only untracked `tests/chat/regrow-trace.debug.ts` (a plan-acknowledged debug tool, not a modification)             |
| Batch README status row updated                                                     | met      | `README.md:18`                                                                                                     |

One criterion FAIL ⇒ NO-PASS. It is not averaged away by the eleven that hold.

## Spirit

**The plan's `Why this matters` is delivered, and I verified it independently of both oracles.** Measuring the user-visible defect directly — the tail message wrapper's `bottom` against the viewport's `bottom`, a metric neither the plan nor the executor uses — across 25 regrow attempts per library version on chromium: **3/25 runs painted a real off-bottom frame (worst 408px) without the change; 0/25 with it.** CSS scroll anchoring genuinely supplies the pre-paint guarantee that a `scrollTop` write from a ResizeObserver callback cannot. The `overflow-anchor` question the plan was written to answer is answered, correctly, and the sentinel survives the absolutely-positioned, `translateY`-transformed subtree in all three engines.

**But the work does not stop where the plan's mechanism stops.** Scroll anchoring compensates for growth _above_ the anchor. The `new-id-two-tick` variant _removes_ the tail message, which is not growth, and anchoring does not cover it. The signed oracle — the instrument this plan was amended to permit — immediately exposed that gap (`Received: 521`, blank space below the tail, equal to the removed message's full height). The executor's response was to route message-count shrink through `snapToBottomPrePaint()` (`SvelteVirtualChat.svelte:858-862`), a **JS-timing hook**: an `$effect` body, which runs in a microtask after the mutation, not inside layout. It therefore carries exactly the guarantee the plan spent its entire `Evidence` section proving does not exist.

It behaves accordingly — it reduces the failure rate rather than removing it:

| project       | `new-id-two-tick`, `--repeat-each=10` |
| ------------- | ------------------------------------- |
| chromium      | 10 passed                             |
| firefox       | 10 passed                             |
| webkit        | **1 failed** / 9 passed               |
| mobile-safari | **1 failed** / 9 passed               |
| mobile-chrome | **1 failed** / 9 passed               |

This is the precise pattern this batch already rejected in writing. `README.md`, Findings considered and rejected: _"no JS-side hook (rAF, RO, MutationObserver, microtask) is a guarantee … A partial fix here is worse than none — it makes the residual race much harder to find."_ And the plan's own STOP condition: _"Your diagnosis leads back to a JS-timing hook … as the mechanism that pins the bottom."_ The executor hit that condition, patched past it, and did not report.

**How it passed unnoticed:** `002-findings.md:126-131` verifies the patch with `-g "new-id-two-tick" --project=webkit → 1 passed` and a single `18 passed` sweep. Single runs, on a ~10% race. The plan's own `Commands` section forbids this — _"This bug is a race. A single green run proves nothing … Never downgrade a `--repeat-each` gate to a single run"_ — and the whole reason plan 002 exists is that plan 001 shipped a live bug behind a single-sample gate. The same trap, one plan later, on a different variant. My own checkpoint-1 mobile run (200/200) was luck; only `final`'s re-run caught it, and only because the criterion is a full-suite run.

I record a correction to my own record: at checkpoint 1 I cleared this hunk as "a synchronous pre-paint snap, not the rejected rAF re-pin window." That clearance was wrong. Repeat-sampling shows it does not eliminate the failure, which is the operative property — not whether the hook is `rAF` or `$effect`.

## Scope & conduct

- **In-scope only?** Yes. Changed source: `src/lib/SvelteVirtualChat.svelte`, `src/routes/tests/chat/stream-swap/+page.svelte`, `tests/chat/anchor-probe.spec.ts`, `tests/chat/stream-swap.spec.ts` — all four on the in-scope list. Every out-of-scope module is untouched, verified by `git diff --stat 9f54732...HEAD`: `chatScrollPolicy.ts`, `chatMeasurement.svelte.ts`, `chatAnchoring.ts`, `chatVisualAnchoring.ts`, `tests/helpers.ts`, `docs/` — all UNTOUCHED. The `collectPitchChanges` invariant break found at checkpoint 1 was fixed by moving the sentinel ahead of the `{#each}` rather than by editing the measurement module, which is the right call.
- **The amended-Scope constraint is honored.** The replacement oracle is signed (`+page.svelte:69-86` returns `anchorRect.bottom - viewportRect.bottom`, no clamp; magnitude taken with `Math.abs` at the call site). `OFF_BOTTOM_THRESHOLD_PX = 48` is unchanged. The stress test is purely additive — the four original variant tests and their legacy `gapFromBottom <= 2` assertion (through an untouched `tests/helpers.ts`) remain in force as an independent check.
- **STOP conditions respected?** **No.** "Your diagnosis leads back to a JS-timing hook … as the mechanism that pins the bottom" was hit when anchoring proved not to cover tail removal. The executor improvised a `snapToBottomPrePaint()` call in the count effect and continued, rather than halting and reporting. It documented the change in `002-findings.md` — good faith, and the reason this reads as drift rather than concealment — but the plan directs a stop, not a workaround.
- **Tampering?** None. `git diff ff22afa..HEAD -- 002-…​.md` contains only guard's own amendments. Nothing deleted from the contract; no `Done criteria` and no `STOP conditions` weakened by anyone.
- **Plan amendments during execution:** one. **2026-07-09, operator-approved** — `Scope` for `src/routes/tests/chat/stream-swap/+page.svelte` widened to permit replacing the bottom-gap oracle, with a new `Evidence` item 9 recording that enabling anchoring makes the legacy `scrollHeight - clientHeight - scrollTop` metric a false positive during the shrink half of a swap. An instrument correction, not a relaxation: the replacement is strictly stronger (signed, not clamped), and it is what exposed the failure this report is built on. `Planned at` re-stamped `be915fa` → `a544bc7`.

## What would flip this to PASS

1. **Stress-sample `new-id-two-tick`, red-first**, exactly as step 1 did for `new-id-regrow`: an in-page repeat loop asserting `maxGapPx <= 48` after **every** run, gated at `--repeat-each=3` on webkit and mobile-safari. Confirm it is RED before touching the fix — a gate that cannot see the bug is how this got here twice.
2. **Fix tail removal with a mechanism that is actually pre-paint**, or establish that none exists and say so. Scroll anchoring compensates for growth above the anchor; it does not restore the bottom when the anchor's content is deleted. The `$effect` snap is not a guarantee and must not be presented as one. If the honest answer is "anchoring cannot cover removal," that is a legitimate finding for a follow-up plan — not something to paper over with a hook that works 90% of the time.
3. **Re-run the cross-engine and mobile criteria at `--repeat-each=10` or better**, not single-sample: `--project=firefox --project=webkit --project=mobile-chrome --project=mobile-safari` → 0 failed. The current `216 passed` on desktop firefox+webkit is a single sample of a 10% race and should not be read as green.

Until then the snapshot stays on the branch. Nothing about the anchoring work needs undoing — it is correct, well-evidenced, and worth merging once the removal path is honest.

## Residual risk / follow-ups

- **`new-id-two-tick` is unguarded against regression** even once fixed: only `new-id-regrow` is stress-sampled. Every race variant this component exercises deserves repeat sampling, or the next 10% bug ships behind a green single run.
- **The persistent-strand question remains open**, and `002-findings.md:71-79` says so plainly — no failing run reported `following=false` or `finalGap > 2`. This plan fixes the **transient** off-bottom paint. The originally reported real-world Firefox symptom (a viewport that stays stranded) is still unreproduced and unexplained. A green suite here must not be read as closing that report.
- **Anchor selection is the load-bearing invariant.** Any future element added inside the viewport without an explicit `overflow-anchor: none` can silently steal selection from the sentinel and reintroduce the bug with no test failure except the stress test. Reviewers: check every new element inside the viewport.
- **A `border-top` on the viewport disables anchoring in webkit** unless the sentinel exceeds it (plan Evidence item 7). `viewportClass` is a public prop, so this is a supported-configuration hazard. `syncAnchorSentinelHeight()` (`SvelteVirtualChat.svelte:113-120`) derives the height as `ceil(borderTopWidth + 1)`, which handles it — but it reads computed style on every viewport resize, and `void viewportClass` (`:894`) tears down and recreates the `ResizeObserver` whenever the class string changes. Worth a reviewer's eye. This constraint deserves a line in the `viewportClass` prop docs.
- **`tests/chat/regrow-trace.debug.ts` is still untracked.** It is the loop-until-failure tracer that produced the root-cause timeline, deliberately named so Playwright will not collect it. Commit it or delete it on purpose; leaving it untracked means it does not travel with the PR.
- **Guard could not establish whether the two-tick blank-space failure pre-dates this branch.** A worktree at the base commit `9f54732` would not build (pnpm's deps-status check rejects a symlinked `node_modules`), and the question is in any case unanswerable by running the base spec: the base fixture's clamped oracle returns `Math.max(0, …)` and is structurally blind to blank space below the tail. So the failure may well be **newly visible rather than newly introduced** — the signed oracle's first catch. That does not soften the verdict (the gate fails at HEAD), but it should shape the fix: treat tail removal as an unsolved case, not as a regression the branch caused.
