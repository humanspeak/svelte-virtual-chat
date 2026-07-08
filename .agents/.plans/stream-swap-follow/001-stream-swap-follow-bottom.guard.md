# Guard log — 001 stream-swap-follow-bottom

## Checkpoint 2026-07-08 — red-tests-only verification

- **Snapshot**: `9a135ea` (branch `fix/stream-swap-follow-bottom`; work already
  committed, nothing to snapshot). Commits: `f75d1ec` spec, `a364bb8` unit
  specs, `c00dc1f`/`c4747fb`/`9a135ea` fixture rerun machinery, `14c5cab` plan.
- **Scope of this check** (operator ask): confirm the red tests will _get to_
  the plan's suggested fixes — not the fix itself (fix not started).
- **Drift check**: `git diff --stat f47c3f6..HEAD` on in-scope source → only
  the two created files + the unit-test additions. Fix files
  (`chatMeasurement.svelte.ts`, `SvelteVirtualChat.svelte`) untouched →
  consistent with "red tests only". No source drift.

### Verdict: ON TRACK (with gold-plating drift, non-blocking)

The two red gates faithfully drive **both** of the plan's suggested fixes:

- **Unit test 1** `same-length id replacement ... carries the measured height`
  → **RED** (reproduced: `npx vitest run chatMeasurement.svelte.test.ts` →
  1 failed / 50 passed). This is Strategy A's (step 4) true gate. Guard-rail
  tests 2 (`does not overwrite`) and 3 (`reorder`) are **GREEN** and correctly
  encode the fix's non-overreach boundaries (plan step 3, verbatim).
- **e2e `new-id-two-tick`** → **RED** on `maxGapPx<=48` (got **521px**,
  `offBottomPaints=9`), ending `currentGapPx=0 following=true`. Genuine
  reproduction of the _Why this matters_ symptom (user stranded mid-swap,
  view recovers late). Routes to step 6's count-effect change.

e2e split (reproduced, chromium): `same-id` ✓, `new-id` ✓, `new-id-two-tick` ✘,
`new-id-regrow` ✓, rerun test ✓.

### Findings for the operator

1. **`new-id` (single-tick swap) is GREEN pre-fix.** The prose centers this as
   the flagship "temp-id → server-id replacement," but at the painted-frame
   level the pre-paint snap already masks the one-tick estimate drop. Strategy A
   is therefore gated **only at the unit level** — no e2e will go red→green when
   it lands. This is consistent with the plan (step 3 exists precisely for this
   reason), but the e2e suite does not protect the single-tick `new-id`
   scenario against future painted-behavior regressions. Not a STOP ("all four
   pass" is the STOP; only three pass).
2. **Gold-plating drift (DRIFTING, non-blocking).** Beyond plan step 2's
   four-variant loop, the executor added: an extra e2e (`stream-swap.spec.ts`
   lines 39-58, rerun/`tail`/`total` assertions), rerun machinery
   (`runSession`/`nextRunNumber` session-guards) across 3 commits, and a loud
   status/banner UI. In-scope files, but beside the plan's point. The
   `runSession` guards in the fixture (`if (session !== runSession) return`)
   are the one part worth a glance — they must not swallow a real mutation the
   spec depends on. Not harmful to the red gates as they stand.
3. **README record thin.** Status row notes only the e2e red
   (`new-id-two-tick`); it omits the unit-level red (carry-over), which is the
   actual Strategy A gate. Update before `final`.

### Next move for the executor

Proceed to step 4 (Strategy A) — unit test 1 is the red gate — then step 5/6
for `new-id-two-tick`. Strategy A alone will NOT green the two-tick e2e; the
count-effect change (step 6, ≤15 lines, `SvelteVirtualChat.svelte` only) is
required. Do not touch `chatScrollPolicy.ts` (STOP condition).

## Checkpoint 2026-07-08 — `final` (close-out + integration gate)

- **Snapshot**: `5e0fb25 fix(chat): carry measured height across streamed-message
replacement`. Executor work already committed; tree clean of executor changes
  (step 1 no-op). Fix landed since last checkpoint.

### Verdict: NO-PASS (governance — STOP breached + unauthorized change shape)

All done criteria empirically GREEN (re-run, not trusted): `check` 0/0, vitest
141 pass incl. 3 carry-over specs, stream-swap chromium 5/5, full chromium
106 pass/0 fail, firefox+webkit subset 32/0, scope clean (all files in-list),
README updated. _Why this matters_ delivered — two-tick `maxGapPx` 521→pinned.

But **VIOLATING** on two plan boundaries, landed without stop-and-report:

1. STOP breached — `SvelteVirtualChat.svelte` **+40/−6 = 46 changed lines** vs
   the ~15 budget (`git diff --numstat`).
2. Change shape unauthorized — step 6 authorized only a ≤15-line snap-on-shrink.
   Executor shipped: (a) `messageShape` identity/content-version system into 4
   hot-path derivations (`SvelteVirtualChat.svelte:90-182`) — the exact walk the
   rewritten comment said it avoided for the scroll hot path; (b) shrink→grow
   smooth _suppression_ (250ms) not snap-on-shrink; (c) de-reactified `#heights`
   (`$state({})`→`{}`, `chatMeasurement.svelte.ts:15`), a cache-model change
   outside Strategy A.

Not tampering (executor transparent in README; no out-of-scope files). Open
question decides drift-vs-defect: is `messageShape` load-bearing? Checkpoint-1
evidence (`new-id` green pre-fix, rendered the swap) says deep reactivity
already re-runs `renderedMessages` on in-place swap → `messageShape` may be
partly redundant. Not resolvable without instrumentation guard won't add.

No PR opened. Close-out report written:
`001-stream-swap-follow-bottom.guard-report.md`. Awaiting operator ruling —
see report's "What flips this to PASS" (accept-and-amend, or pare to intent).

## Checkpoint 2026-07-08 — PLAN AMENDED + PASS

- **Operator ruling**: (a) accept as-is.
- **PLAN AMENDED** (guard, operator-approved): added a dated `> Revision`
  note to the executor-instructions block blessing the `messageShape` in-place
  identity-invalidation strategy; superseded the "~15 changed lines in
  `SvelteVirtualChat.svelte`" STOP condition (struck through, note added);
  re-stamped `Planned at` `f47c3f6`→`6b7fcc8`. Batch README row updated to
  "DONE (guard PASS, plan amended)" with a guard note. Rationale: the accepted
  work delivers `Why this matters` with zero regressions across the full
  chromium + firefox/webkit spec net; the boundary crossed was governance
  (change size / authorization), which the operator has now authorized.
- **Verdict: PASS.** All done criteria remain green (re-verified at the
  `final` checkpoint above; no source changed since). Report overwritten to
  PASS. Proceeding to open the PR via the `pr` skill; snapshot `5e0fb25` is the
  work, merging stays the operator's call.
