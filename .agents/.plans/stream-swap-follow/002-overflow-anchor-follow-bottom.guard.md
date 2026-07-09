# Guard log — 002 overflow-anchor-follow-bottom

## Checkpoint 1 — 2026-07-09 13:13 — ON TRACK

`151425a` · after step 4–7 implementation (`fix(chat): pin follow-bottom with scroll anchoring`); working tree clean at review time, so the commit is the snapshot — nothing for guard to snapshot-commit.

### Done criteria — all re-run by guard, none taken on report

- `pnpm run check` → `0 ERRORS 0 WARNINGS` (423 files).
- `npx vitest run` → 141 passed / 7 files.
- `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow: viewport"` → 25 passed.
- `-g "stress" --project=chromium --repeat-each=3` → 3 passed.
- `-g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3` → 9 passed.
- `npx playwright test --project=chromium` → 108 passed, 2 skipped, **0 failed**.
- `npx playwright test --project=firefox --project=webkit` → 216 passed, 4 skipped.
- `npx playwright test --project=mobile-chrome --project=mobile-safari` → 200 passed, 20 skipped.
- `anchor-probe.spec.ts` asserts C `firstFrameGap === 0`; passes chromium/firefox/webkit (A=0, B=299, C=0 in all three).
- `grep -n "overflow-anchor" src/lib/SvelteVirtualChat.svelte` → viewport `auto` (`:1069`), header (`:1083`), message wrapper (`:1106`), footer (`:1118`) all `none`, sentinel `auto` (`:1097`). Matches the criterion exactly.

### Spirit check — does it deliver `Why this matters`?

Yes, and verified independently of both oracles. Guard measured the user-visible
defect directly (last message wrapper's `bottom` vs viewport `bottom`), 25 regrow
attempts per library version, chromium:

- library change stashed → **3 / 25** runs painted a real off-bottom frame, worst `lastMsgGap` **408px**, worst `blankBelow` **384px**.
- library change applied → **0 / 25**, worst `lastMsgGap` **0**, worst `blankBelow` **0**.

The `Why this matters` claim (a `scrollTop` write from a ResizeObserver callback
is not a pre-paint guarantee; CSS scroll anchoring is) is substantiated.

### Findings

- **Plan defect (not drift): the fixture oracle rewrite exceeds the literal scope grant, and should.** `Scope` permits `src/routes/tests/chat/stream-swap/+page.svelte` to be touched "ONLY if step 6 requires a new debug-stats key". The executor instead rewrote the measurement (`+page.svelte:69-86`, `paintedBottomOffsetPx` + `Math.abs`). Guard confirmed this is forced by reality, not convenience: under the legacy metric the fix still reports `maxGapPx=383`, but on that frame `lastMsgGap=0`, `blankBelow=0`, `deadSpace=383`, `sh=3141`, `st=2286` — anchoring pulls `scrollTop` to the true content bottom one frame _before_ the spacer resizes, so `scrollHeight - clientHeight - scrollTop` is a false positive **created by the fix**. The new oracle is also strictly stronger: signed rather than clamped, so it catches blank-space-below-tail, which the old one could not. It earned its keep immediately — it caught a real webkit `new-id-two-tick` regression (`Received: 521`) that the clamped oracle was blind to, which the executor then fixed. Not the "weaken the plan to rubber-stamp weak work" anti-pattern: the plan was wrong about the instrument, not the work wrong about the plan.
- **Unplanned hunk in the count effect is justified and documented.** `SvelteVirtualChat.svelte:858-862` routes message-count shrink through `snapToBottomPrePaint()` instead of `scheduleSnapToBottom()`. Not in step 4's shape, and adjacent to the plan's "no JS-timing hook" STOP. Cleared: it is a synchronous pre-paint snap (not the rejected rAF re-pin window), and `002-findings.md` ("Signed Oracle Follow-up") ties it to the webkit `new-id-two-tick` blank-space regression with verification output. In scope (`SvelteVirtualChat.svelte`), motivated, and recorded.
- **No tampering.** `git diff ff22afa..HEAD -- 002-overflow-anchor-follow-bottom.md` contains only the advisor's amendments (findings 7–8, step-2 hygiene, step-4 sentinel sizing, corrected STOP clause). Nothing deleted from the contract; no done criterion weakened. The executor's commit `a749d8e` merely carried those uncommitted amendments in alongside its findings file — hygiene nit, not a boundary break.
- **Two earlier guard findings were addressed before this checkpoint.** (a) The sentinel as last child of `itemsEl` broke `collectPitchChanges`' unwritten invariant that every child is a message wrapper (`chatMeasurement.svelte.ts:349` closes the last pitch at `containerBottom`), reddening `header-footer` (531 > 530) and `margin-bubbles` (14 > 12). Now moved before the `{#each}`, absolutely positioned at `bottom: 0`, with a comment naming the invariant (`SvelteVirtualChat.svelte:1092-1099`). Full chromium suite is green. (b) The clamped oracle's blind spot is closed by the signed metric. `chatMeasurement.svelte.ts` remains untouched, as `Scope` requires.
- **Open question answered honestly.** `002-findings.md` ("Persistent-Strand Question") records that no failing run reported `following=false` or `finalGap > 2`, states the plan targets the transient race only, and leaves the real-world Firefox strand unreproduced and unexplained. This is what the plan demanded rather than letting a green suite imply closure.

### Recommendations (non-blocking, not done criteria)

- `anchor-probe.spec.ts:154-155` asserts only scroller C. Assert **A** (known-good control) and B's non-pinning too. A silently broken control already cost one execution cycle when a decorative `border: 1px` made webkit's A fail and read as "engine lacks anchoring."
- `SvelteVirtualChat.svelte:894` adds `void viewportClass` to the viewport-resize effect, so a `viewportClass` change tears down and recreates the `ResizeObserver`. Correct but worth a reviewer's eye.
- `tests/chat/regrow-trace.debug.ts` is still untracked. Commit it or delete it deliberately; it is the tool that produced the root-cause timeline.
- The batch `README.md` row for 002 already reads `DONE`. That is the executor following the plan's instructions, but the authoritative status is guard's — it is not DONE until `guard final` passes.

### Action

Reported to operator. **Plan amendment recommended and awaiting explicit agreement**: widen `Scope` for `src/routes/tests/chat/stream-swap/+page.svelte` from "new debug-stats key only" to permit replacing the bottom-gap oracle, and record in `Evidence` that enabling scroll anchoring invalidates the legacy `scrollHeight - clientHeight - scrollTop` metric during the shrink half of a swap. Guard has **not** amended the plan. No source code touched.

## Checkpoint 2 — 2026-07-09 13:19 — PLAN AMENDED

`a544bc7` · operator granted the amendment recommended in checkpoint 1. No new executor work reviewed; this entry records the plan change only.

### What changed in `002-overflow-anchor-follow-bottom.md`

- **`Scope`** — `src/routes/tests/chat/stream-swap/+page.svelte` may now replace the fixture's bottom-gap oracle, not merely add a debug-stats key. The grant is **constrained, not open**: any replacement must measure a **signed** offset between the content tail and the viewport bottom and assert on its magnitude, so stranding _and_ blank-space-below-tail are both caught. Clamping negatives to zero is explicitly forbidden, as is relaxing `OFF_BOTTOM_THRESHOLD_PX`.
- **`Evidence` item 9 (new)** — records the measured reason: anchoring corrects `scrollTop` a frame before the JS-driven spacer resizes, so `scrollHeight - clientHeight - scrollTop` reads a stale-inflated `scrollHeight` and reports a gap the user cannot see (`legacyGap=383` while `lastMsgGap=0`, `deadSpace=383`, `sh=3141` → `2758` next frame). Includes guard's independent 25-attempt table (3/25 → 0/25 real off-bottom paints) and the pre-fix `worst blankBelow = 384px` that proves a clamped oracle is blind to a failure mode this code produces.
- **Revision note + `Planned at`** — dated revision line added under the executor-instructions block; `Planned at` re-stamped `be915fa` → `a544bc7` so the drift check re-baselines. Drift-check command updated to match.
- **Batch `README.md`** — guard note recording the amendment and that 002's `DONE` row is the executor's, not guard's; authoritative status awaits `guard 2 final`.

### Rationale (checkpoint 2) — why this is a defect, not a rubber stamp

The test guard applied: _is the plan wrong about reality, or is the work wrong about the plan?_ The plan asserted an instrument that the fix itself invalidates. Guard confirmed this against a third metric neither the plan nor the executor used, so the conclusion does not depend on the executor's own oracle. The replacement is **strictly stronger** than what it replaces — signed rather than clamped — and it caught a real webkit regression (`new-id-two-tick`, `Received: 521`) that the original metric could not see. No `Done criteria` and no `STOP conditions` were altered. Nothing was widened to accommodate weak work.

### Action (checkpoint 2)

Plan amended (operator-approved). No source code touched. Next: `guard 2 final` for the close-out gate and, on PASS, the PR.

## Checkpoint 3 — 2026-07-09 13:54 — VIOLATING (close-out: NO-PASS)

`f0299fc` · `guard 2 final` close-out gate. Working tree clean apart from the untracked debug tracer, so the commit is the snapshot. Drift since the re-stamped `Planned at` (`a544bc7`): `tests/chat/anchor-probe.spec.ts` only, in scope. Full report: `002-overflow-anchor-follow-bottom.guard-report.md`.

### Findings (checkpoint 3)

- **Done criterion FAILS: `--project=mobile-chrome --project=mobile-safari` → 0 failed.** Observed **1 failed**, 199 passed, 20 skipped: `[mobile-safari] new-id-two-tick`, `Expected: <= 48 / Received: 521`. 521px is the removed message's full height — blank space below the tail.
- **The failure is a ~10% race across three projects, not a one-off.** `-g "new-id-two-tick" --repeat-each=10`: webkit **1 failed**/9, mobile-safari **1 failed**/9, mobile-chrome **1 failed**/9; chromium 10 passed, firefox 10 passed. The full firefox+webkit suite's `216 passed` is a single sample of this race and must not be read as green.
- **STOP condition skipped.** Scroll anchoring compensates for growth _above_ the anchor; `new-id-two-tick` _removes_ the tail message, which anchoring does not cover. The executor patched it with `snapToBottomPrePaint()` in the count effect (`SvelteVirtualChat.svelte:858-862`) — an `$effect` body, i.e. a microtask after the mutation, **a JS-timing hook**. The plan's STOP condition ("your diagnosis leads back to a JS-timing hook … as the mechanism that pins the bottom") was hit and improvised past rather than reported. The batch README already rejected this class in writing: "no JS-side hook … is a guarantee. A partial fix here is worse than none."
- **The patch was verified with single runs on a race.** `002-findings.md:126-131` cites `-g "new-id-two-tick" --project=webkit → 1 passed` and one `18 passed` sweep. The plan's `Commands` section forbids exactly this ("Never downgrade a `--repeat-each` gate to a single run"), and plan 002 exists _because_ plan 001 shipped a live bug behind a single-sample gate. Same trap, one plan later, different variant.
- **Correction to checkpoint 1.** I cleared this hunk as "a synchronous pre-paint snap, not the rejected rAF re-pin window." That was wrong. The operative property is whether it eliminates the failure; repeat-sampling shows it does not. My checkpoint-1 mobile run (200/200, single sample) was luck.
- **The core anchoring work is sound and should survive.** Verified independently of both oracles (tail wrapper `bottom` vs viewport `bottom`, 25 regrow attempts per library version, chromium): **3/25** real off-bottom paints without the change, **0/25** with it. Scope is clean — all four out-of-scope modules (`chatScrollPolicy.ts`, `chatMeasurement.svelte.ts`, `chatAnchoring.ts`, `chatVisualAnchoring.ts`), `tests/helpers.ts` and `docs/` are UNTOUCHED. The amended-Scope constraint is honored: the oracle is signed and unclamped, `OFF_BOTTOM_THRESHOLD_PX` is still 48, and the stress test is purely additive. No tampering.
- **Pre-existence undetermined, and honestly so.** A worktree at base `9f54732` would not build (pnpm deps-status check vs a symlinked `node_modules`), and the base spec's clamped oracle is structurally blind to blank-space-below-tail, so running it there would prove nothing. The two-tick failure may be newly _visible_ rather than newly _introduced_.

### Action (checkpoint 3)

**NO-PASS. No PR opened**; the snapshot commit stays on `fix/overflow-anchor-follow-bottom`, unmerged. Close-out report written. To flip to PASS: (1) stress-sample `new-id-two-tick` red-first, as step 1 did for `new-id-regrow`; (2) fix tail removal with a genuinely pre-paint mechanism, or establish that none exists and record that as a follow-up plan rather than a 90%-effective hook; (3) re-run the cross-engine and mobile criteria at `--repeat-each=10` or better. No source code touched.
