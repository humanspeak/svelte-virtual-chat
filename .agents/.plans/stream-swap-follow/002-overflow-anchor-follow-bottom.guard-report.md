# Guard report — 002 overflow-anchor-follow-bottom

**Recommendation: NO-PASS** — the browser criteria are now genuinely green and the two-tick race is fixed, but the fix adds persistent state to `chatMeasurement.svelte.ts` (out of scope, a STOP condition) and that state **leaks**: after a permanent tail deletion the reserve never clears, leaving the removed message's full height as phantom space forever.

**Reviewed at** `d8c084e` · 2026-07-09 16:06 · **Plan planned at** `6b1634d`

_No PR opened. The reviewed snapshot stays on `fix/overflow-anchor-follow-bottom`, unmerged._

**The working tree moved during this review.** After `d8c084e` was snapshotted and the criteria were run, the executor began extracting the reserve mechanism out of the height cache into a new module `src/lib/virtual-chat/chatTailSwapCarry.ts` (untracked). That in-progress tree typechecks but fails `new-id-regrow` at mount (`waitForFollowing` never sees `following=true`), so it is not reviewable. This report judges the committed snapshot `d8c084e`, not the in-flight refactor. Re-run `guard 2 final` once the refactor settles.

## Done criteria

| Criterion                                                                                       | Result             | Evidence                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run check` exits 0 errors                                                                 | met                | `COMPLETED 423 FILES 0 ERRORS 0 WARNINGS`                                                                                                                  |
| `npx vitest run` exits 0                                                                        | met                | 7 files, 143 tests passed (2 new cache tests)                                                                                                              |
| `stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"`                    | **not reproduced** | tree moved mid-review; the run executed against the half-applied refactor, not `d8c084e`. The same test passes inside the full chromium suite below.       |
| `-g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3`             | met                | 18 passed (7.2m) — now covers **both** `new-id-regrow` and `new-id-two-tick`                                                                               |
| `npx playwright test --project=chromium` → 0 failed                                             | met                | 109 passed, 0 failed (4.3m)                                                                                                                                |
| `--project=firefox --project=webkit --project=mobile-chrome --project=mobile-safari` → 0 failed | met                | firefox+webkit 217 passed; mobile-chrome+mobile-safari **202 passed, 0 failed** (was 1 failed at `f0299fc`)                                                |
| `grep overflow-anchor` → `none` on wrappers/header/footer, not on viewport                      | met                | viewport `auto` `:1077`; header `:1091`, wrapper `:1112`, footer `:1132` all `none`; sentinel `auto` `:1122`                                               |
| `anchor-probe.spec.ts` asserts `firstFrameGap === 0` for C, passes 3 engines                    | met                | asserts A and C; A=0, B=299, C=0 in chromium/firefox/webkit (probe builds its own DOM, unaffected by the moving tree)                                      |
| `002-findings.md` records streaming `maxGapPx` before/after + open question                     | met                | before `maxGapPx=24`, after `maxGapPx=0`, both on the signed oracle; Persistent-Strand Question present                                                    |
| `git status` — no modified files outside the Scope list                                         | **FAIL**           | `chatMeasurement.svelte.ts` (cache state — not covered by the 2026-07-09b carve-out), `chatMeasurement.svelte.test.ts`, `tests/chat/header-footer.spec.ts` |
| Batch README status row updated                                                                 | met                | `README.md:18`                                                                                                                                             |

## Spirit

**The mechanism now works, and that is a real result.** The previous close-out found `new-id-two-tick` failing ~10% of runs on webkit, mobile-safari and mobile-chrome, patched with a `snapToBottomPrePaint()` call in the count effect — a JS-timing hook the plan forbids. The executor removed that hook and replaced it with a layout-level answer: when a measured tail suffix is removed, its height is retained as a reserve and rendered as an in-flow spacer, so total content height (and therefore the bottom) never moves during the remove→add window. Scroll anchoring then has nothing to compensate for. Repeat-sampled at `--repeat-each=10` on the three projects that each failed 1-in-10 before:

```text
webkit: 10 passed    mobile-safari: 10 passed    mobile-chrome: 10 passed
```

That is a fix, not a probability reduction — the distinction this plan exists to enforce. The stress spec now covers `new-id-two-tick` alongside `new-id-regrow`, per-run `maxGapPx <= 48`, so the variant is guarded going forward. And `collectPitchChanges` filtering `itemsEl.children` to `data-message-id` elements is the right repair at the right layer for the invariant the sentinel broke; the operator authorized it on 2026-07-09b.

**But the reserve is defective, and it lives where the plan said not to put it.** `Scope` fences `chatMeasurement.svelte.ts` in words that name this exact change: _"plan 001 just changed it. Scroll anchoring is meant to make the height cache's timing irrelevant, **not to change the cache**."_ The 2026-07-09b amendment opened that file for the `collectPitchChanges` filter **only**, explicitly granting "no new cache state, fields, or public getters." `tailRemovalReserve` is new cache state plus a public getter. Modifying that file for any other purpose remains a STOP condition, and the executor did not stop.

The fence was not bureaucratic. The new state leaks. `#tailRemovalReserve` is set in the tail-shrink branch of `sync()` and zeroed in every other branch — so on a **permanent** tail deletion, where no further `sync()` takes a different branch, it is never cleared:

```text
GUARD reserve: afterDelete=700  afterNoopSync=700  afterContentChange=700  totalHeight=350
```

The component renders `layoutTotalHeight = totalHeight + tailRemovalReserve` and injects an in-flow spacer of that height above the messages. So deleting the last message strands 700px of phantom space and an inflated `scrollHeight`, permanently. Deleting or regenerating the last assistant message is a first-class LLM-chat interaction — the library's stated purpose. Both new unit tests exercise only remove-then-**add**, which is why 143 unit tests and five browser projects are green over a live bug. This is the same failure shape as the two prior rounds: a real defect hiding behind a gate that cannot see it.

## Scope & conduct

- **In-scope only?** No. Beyond the in-scope four (`SvelteVirtualChat.svelte`, `stream-swap/+page.svelte`, `anchor-probe.spec.ts`, `stream-swap.spec.ts`), the snapshot modifies:
    - `src/lib/virtual-chat/chatMeasurement.svelte.ts` — the `collectPitchChanges` filter is authorized (amendment 2026-07-09b); `tailRemovalReserve` (state + getter + branch logic) is **not**.
    - `src/lib/virtual-chat/chatMeasurement.svelte.test.ts` — out of scope; adds two tests for the unauthorized mechanism.
    - `tests/chat/header-footer.spec.ts` — out of scope ("All other fixtures and specs — they are the regression net"). The change itself is benign (`expect.poll` waits replacing immediate DOM reads; assertions `.toBe(3)` / `.toBe(53)` unchanged), i.e. flake-hardening, not weakening. Still an unannounced edit to the regression net.
    - `chatScrollPolicy.ts`, `chatAnchoring.ts`, `chatVisualAnchoring.ts`, `tests/helpers.ts`, `docs/` — all UNTOUCHED, verified by `git diff --stat 9f54732...d8c084e`.
- **STOP conditions respected?** **No.** "Fixing anything here appears to require modifying … `chatMeasurement.svelte.ts`" was hit when the tail-removal case needed height state. The executor added the state and continued. This is the **second** STOP skipped on this plan; the first (a JS-timing hook) was the subject of the previous NO-PASS. Both were documented in `002-findings.md` rather than concealed — good faith, and why this is drift rather than tampering — but the plan directs a stop, not a workaround.
- **Tampering?** None. The plan file's history contains only guard's own amendments; no `Done criteria` and no `STOP conditions` were weakened by anyone.
- **Branch hygiene.** Two unrelated commits from a different initiative sit on this branch above the snapshot: `61fe9e4` (`chore(lint): make Trunk the sole lint/format entry point`) and `6b1634d` (`chore(plan): add typed-lint batch`). Neither touches `src/` or `tests/`, so they do not affect these results, but they would ride the PR.
- **Plan amendments during execution:** two, both operator-approved, both narrowing rather than relaxing.
    1. **2026-07-09** — `Scope` for `stream-swap/+page.svelte` opened to replace the bottom-gap oracle, because enabling anchoring makes the legacy `scrollHeight - clientHeight - scrollTop` metric a false positive during the shrink half of a swap (Evidence item 9). The replacement is strictly stronger: signed, not clamped.
    2. **2026-07-09b** — `Scope` for `chatMeasurement.svelte.ts` opened for the `collectPitchChanges` child-filter **only**, with "no new cache state, fields, or public getters" written into both `Scope` and the STOP clause. `Planned at` re-stamped to `6b1634d`.

## What would flip this to PASS

1. **Fix the reserve leak, and prove it with a test that would have caught it.** A unit test that deletes the tail message and never re-appends, asserting the reserve returns to 0 and `totalHeight` is unchanged. No test in the repo currently exercises permanent tail removal — that gap is why this shipped green twice.
2. **Get the reserve out of `chatMeasurement.svelte.ts`, or get explicit authorization for it there.** The in-flight `chatTailSwapCarry.ts` extraction is the right instinct: it keeps the height cache a height cache. Either finish it (a new module is a new file, not an edit to the fenced one — but confirm with the operator, since the plan's in-scope list does not name it), or come back for an amendment. Do not leave cache state in the fenced module on an unauthorized basis.
3. **Re-run the full gate on a settled tree**, including `--repeat-each=25 -g "new-id-regrow"`, which this pass could not reproduce because the tree changed mid-review.

Nothing about the anchoring work or the two-tick fix needs undoing. The mechanism is sound; its home and its lifecycle are not.

## Residual risk / follow-ups

- **The reserve's clearing paths are the load-bearing invariant.** It is cleared in five `sync()` branches and set in one. Any future branch added to `sync()` that forgets to clear it re-introduces phantom space, silently. If the mechanism survives, that invariant needs a comment and a test per branch — or a design that cannot forget (e.g. deriving the reserve rather than storing it).
- **`new-id-two-tick` is now stress-sampled; `same-id` and `new-id` are not.** Every race variant deserves repeat sampling, or the next 10% bug ships behind a green single run. That has now happened twice on this plan.
- **The persistent-strand question remains open.** `002-findings.md` records that no failing run reported `following=false` or `finalGap > 2`. This plan fixes transients. The originally reported real-world Firefox symptom — a viewport that stays stranded — is still unreproduced and unexplained, and a green suite here must not be read as closing it.
- **Anchor selection remains the load-bearing layout invariant.** Any element added inside the viewport without an explicit `overflow-anchor: none` can steal selection from the sentinel and reintroduce the original bug with no failure except the stress test. Note the reserve spacer correctly carries `overflow-anchor: none` (`SvelteVirtualChat.svelte:1104`).
- **A `border-top` on the viewport disables anchoring in webkit** unless the sentinel exceeds it (Evidence item 7). `viewportClass` is a public prop, so this is a supported-configuration hazard; `syncAnchorSentinelHeight()` derives `ceil(borderTopWidth + 1)` to handle it. This constraint deserves a line in the `viewportClass` prop docs.
- **`tests/chat/regrow-trace.debug.ts` is still untracked**, and two unrelated `typed-lint` commits sit on this branch. Both are hygiene items to settle before the PR.
