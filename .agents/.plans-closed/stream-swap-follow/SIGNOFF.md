# Batch signoff — stream-swap-follow

**Status: CLOSED** · Signed off 2026-07-09 · Both plans PASS, merged to `main`.

This batch is complete and moved to `.agents/.plans-closed/`. No plan in it
remains executable; the documents are retained as the record of what was done,
how it was verified, and — critically for this batch — which reported symptom
is **not** closed by it (see "What this closure does not claim").

## Plans

| Plan | Title                                                         | Verdict                           | PR                                                               | Merged to main                  |
| ---- | ------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| 001  | Keep follow-bottom locked when a streamed message is replaced | PASS (operator-approved, amended) | [#54](https://github.com/humanspeak/svelte-virtual-chat/pull/54) | `46ed850` (v0.1.17, 2026-07-09) |
| 002  | CSS scroll anchoring as a pre-paint follow-bottom guarantee   | PASS                              | [#55](https://github.com/humanspeak/svelte-virtual-chat/pull/55) | `23538db` (v0.1.18, 2026-07-09) |

## What the batch delivered

Consumer apps that stream an assistant reply into a placeholder and then swap
in the final document (new id, sometimes remove-then-add) no longer lose
follow-bottom:

- **001** fixed the message-identity symptoms: height carry-over, in-place
  identity invalidation (`messageShape`), shrink→grow smooth suppression.
- **002** fixed the structural cause: no JS-timing hook (rAF, ResizeObserver,
  microtask) can guarantee a pre-paint `scrollTop` write, so the fix moved
  into layout — CSS scroll anchoring on the viewport with a bottom sentinel,
  content opt-out, a derived sentinel height (webkit border-top law), and a
  bounded tail-swap height reserve in `chatTailSwapCarry.ts`.
- Verified as **fixes, not probability reductions**: guard measured the
  user-visible defect directly — 3/25 chromium regrow runs painted a real
  off-bottom frame (worst 408px) without 002's change, 0/25 with it; the
  previously 1-in-10-failing variants repeat-sampled 0-in-30 across webkit,
  mobile-safari, and mobile-chrome. Full browser matrix green at close-out.

## Gate history (full detail in the per-plan `.guard.md` / `.guard-report.md`)

This batch earned its PASS the hard way, and the record should not smooth
that over:

- **001** initially NO-PASS at `final` (STOP line-budget exceeded, unplanned
  strategy). Operator reviewed and accepted; the plan was amended to authorize
  the work. A post-close-out `trunk check` gap surfaced 3 lint issues, fixed
  with operator authorization.
- **The batch was reopened 2026-07-09**: 001's single-run-per-browser gate had
  let a ~1-in-20 chromium race through. Measured (`--repeat-each=25`), not
  inferred. That lesson — repeat-sample or a green run means little — is
  institutionalized in 002's done criteria.
- **002** went through two NO-PASS checkpoints (a forbidden JS-timing hook; a
  scope violation that would have permanently leaked phantom height on tail
  deletion) before passing. Three operator-approved amendments, all
  strengthening; no criterion or STOP was ever weakened.

## What this closure does not claim

**The persistent-strand question stays open.** No failing run in either plan
ever showed `following=false` or a settled `finalGap > 2` — everything this
batch fixed was a _transient_. The originally reported real-world Firefox
symptom (a viewport that stays stranded off-bottom) was never reproduced and
remains unexplained. Do not close that report on the strength of this batch.
The tracer for chasing it is committed at `tests/chat/regrow-trace.debug.ts`.

## Residual follow-ups carried forward (none block closure)

- **Highest value: commit a regression test for the tail-deletion leak.**
  Guard proved the fix with a throwaway fixture (permanent tail delete →
  reserve clears after 250ms) and deleted it; nothing in the repo would catch
  a reintroduction. The component's 250ms clear timer is untested.
- **`TAIL_SWAP_RESERVE_MS = 250` is a magic number.** A store slower than
  250ms to deliver the replacement reopens the original race. Derive the
  window or document the assumption.
- **Anchor selection is the load-bearing invariant.** Any new element inside
  the viewport without `overflow-anchor: none` can steal anchor selection and
  silently reintroduce the bug. Reviewers must check every new viewport child.
- **webkit + `viewportClass` border-top hazard** deserves a line in the prop
  docs — a top border taller than the sentinel disables anchoring in Safari.
- **`same-id` and `new-id` variants are still single-sampled** in the stress
  suite; twice on this batch a real bug hid behind a single green run.
- Orphaned height-cache entry pruning (memory growth over long sessions) —
  deferred from 001, still real, still independent.
