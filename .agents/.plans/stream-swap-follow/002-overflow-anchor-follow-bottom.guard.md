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
