# Guard log — 001 lint-unit-tests-and-typed-lint

## Checkpoint 1 — 2026-07-09 19:51 — DRIFTING

`4da326c` · final close-out pass; snapshot-committed the executor's uncommitted working tree (19 files), then re-ran every done criterion

Pre-flight — no STOP conditions tripped:

- Precondition met: `fix/overflow-anchor-follow-bottom` merged to `main` as `23538db` (#55).
- Drift check clean: `git diff 7257307..HEAD -- eslint.config.mjs` empty; `package.json`'s only delta is the `0.1.17→0.1.18` bump plus the `lint`/`format` script removal the plan itself documents as expected (Current state, "Tooling conventions").
- No tampering: `git diff e74bf41..HEAD -- .agents/` touches only `README.md` (status row), which Scope explicitly permits. Plan file unmodified.
- Lint time 19.2s, far under the ~3min STOP threshold.

Substance verified (guard re-ran, did not trust a report):

- `pnpm run check` → `428 FILES 0 ERRORS 0 WARNINGS`; `npx vitest run` → 150 passed; `trunk check --all` → ✔ No issues (163 files).
- Playwright Step-4 sanity → 20 passed. Additionally ran every behaviorally-edited spec (anchor-probe, fill-in-sawtooth, idle-snap-loop, late-table-growth, smooth-scroll, wheel-scroll-jump) → 21 passed, 2 skipped.
- Step 3 proof executed by guard (executor left none): a bare `Promise.resolve()` fires `@typescript-eslint/no-floating-promises` in all three parser paths — `.ts` 2:5, `.test.ts` 2:5, `.svelte` 3:9. Typed linting is genuinely wired, including Svelte. Scratch files deleted; `git status --porcelain` clean.

Findings:

- **Plan defect — the plan's named `.svelte` example cannot be caught.** Plan Step 2.5 asserts `src/routes/tests/chat/stream-swap/+page.svelte:228` (`onclick={() => runScenario(selectedVariant)}`, `runScenario` is `async`, line 116) trips `no-misused-promises` / `checksVoidReturn.attributes`. It does not: `checksVoidReturn.attributes` inspects JSX attributes only, and Svelte template event attributes are not JSX nodes. Proven — a scratch `.svelte` reproducing that exact line reports ✔ No issues while a bare `Promise.resolve()` statement _in the same file_ fires `no-floating-promises`.
- **Drift — three `void` marks, zero rationale comments.** `src/lib/SvelteVirtualChat.svelte:640`, `src/routes/tests/chat/margin-bubbles/+page.svelte:93,102`. Plan Step 2.5 ("`void` it with a one-line rationale") and Maintenance note (1) ("every `void`-marked promise has a rationale") both require one.
- **Drift — the two `margin-bubbles` `void` edits were not rule-required.** The identical `onclick={() => sweep.start('up')}` at `src/routes/tests/chat/estimate-miss/+page.svelte:53` is untouched and lints green (`sweepMonitor.svelte.ts:68` — `async start(...): Promise<void>`). Behavior is unchanged, but the same pattern is now voided in one fixture and not its sibling with nothing explaining why.
- **Drift — undocumented relaxation.** `eslint.config.mjs:121-128` adds a `docs/**/*` `disableTypeChecked` block the plan never authorized (`docs/` is out of scope, "Leave it"). Defensible — `docs/` is outside the root tsconfig so `projectService` would error there, and it keeps docs on untyped rules rather than off — but Done-criterion 4 requires each scoped relaxation be listed in the report with a one-line rationale.
- **Drift — behavioral spec edit.** `tests/chat/idle-snap-loop.spec.ts:34-35` substitutes `0` when the native `scrollTop` getter returns a non-number, silently masking rather than failing loudly; `as number` would have preserved the old semantics. Scope calls behavioral edits to the spec suite drift.
- **Done criteria 3, 4, 5 unmet — no executor report exists.** All three read "recorded in the report" / "listed in the report with violation counts" / "matches the count listed in the report". Nothing was produced anywhere in the repo. The executor nonetheless flipped the README status row to `DONE`.

- Action: reported to operator; close-out report written with **NO-PASS**; no PR opened. Plan defect surfaced for the operator's decision — **not** amended, per the rule that guard amends only with explicit agreement.

## Checkpoint 2 — 2026-07-09 20:00 — PLAN AMENDED

`089bc10` · operator agreed to record the Svelte event-handler coverage gap in the plan

- Rationale: checkpoint 1 proved Step 2.5's central prediction false. `no-misused-promises`' `checksVoidReturn.attributes` inspects JSX attributes only, so `onclick={() => runScenario(selectedVariant)}` at `stream-swap/+page.svelte:228` is unreachable by the rule. Left as written, the plan would keep directing executors to "fix" a non-violation and would leave the next reader believing Svelte event handlers are promise-safe. This is the plan being wrong about reality — the defect case — not the work being wrong about the plan.
- Amendments applied:
    - Dated `> Revision 2026-07-09` note added under the executor-instructions block.
    - Step 2.5's stream-swap prediction removed and replaced with an explicit **"Not a violation — do not 'fix' it"** callout naming the sibling `estimate-miss/+page.svelte:53`, and stating that the gap is a property of the rule, not a mis-wiring (Step 3 proves type info reaches `.svelte`).
    - `Planned at` re-stamped `7257307` → `089bc10`; the drift-check command re-baselined to the same SHA, with a note that the "Current state" excerpts still describe the pre-implementation config.
    - Batch `README.md` status corrected `DONE` → `IN PROGRESS` with a pointer to the guard report; the executor had self-certified `DONE` against a NO-PASS.
- Scope, `Why this matters`, and all eight done criteria are **unchanged** — the amendment removes a false factual claim, it does not lower the bar. The three failing criteria still fail.
- Action: plan amended with operator agreement. Verdict on the work stands at **NO-PASS** (`4da326c`); no PR opened. Back to the operator to hand the revised plan to the executor.

## Checkpoint 3 — 2026-07-09 20:20 — ON TRACK

`bcac493` · second `final` pass after the executor's corrective round; nothing to snapshot (tree already clean — the executor committed its own work as `bcac493`)

Every checkpoint-1 finding is closed, and I re-ran the gates rather than reading the report's claims:

- **Report now exists** — `001-lint-unit-tests-and-typed-lint.report.md`. Carries the Step 3 three-file proof as a table, all three scoped relaxations with rationale and violation counts, and suppression counts (0/0). Closes done criteria 3, 4, 5.
- **Rationale comments added to all three `void` marks** — `SvelteVirtualChat.svelte:640`, `margin-bubbles/+page.svelte:94,105`.
- **`margin-bubbles`/`estimate-miss` inconsistency resolved** — `estimate-miss/+page.svelte:53` now voided with a comment stating no rule enforces it. Authorized by the 2026-07-09 amendment.
- **`idle-snap-loop.spec.ts:34`** reverted from the silent `0` fallback to `desc.get!.call(this) as number` — a broken getter now fails loud.
- **No tampering.** `git diff 864ae2e..bcac493` touches neither the plan file nor either guard artifact.
- **Step 3 proof still valid** — `git diff 4da326c..HEAD -- eslint.config.mjs` is empty, so the activation proof I ran at checkpoint 1 (`.ts` 2:5, `.test.ts` 2:5, `.svelte` 3:9) holds unchanged by construction.
- Gates re-run at `bcac493`: `pnpm run check` → `428 FILES 0 ERRORS 0 WARNINGS`; `npx vitest run` → 150 passed; `trunk check --all` → ✔ No issues (166 files, 19.1s); Playwright over the plan's two specs plus every fixture touched this round (estimate-miss, margin-bubbles, idle-snap-loop) → 24 passed.

Residual observations, none blocking:

- `stream-swap/+page.svelte:228` (`onclick={() => runScenario(...)}`, async) remains the one promise-returning handler without a `void`, while `sweep.start(...)` is voided at three sites. The report addresses it explicitly (§Promise handling) as a deliberate choice on the grounds that the amended plan marks it a non-violation. Asymmetric but disclosed, no rule enforces either way, zero behavioral effect. Verified `load()` in the bulk/genai-like/perf-bench fixtures is synchronous, so no other handler is affected.
- The relaxation counts (13 / 6 / 11) are **not independently reproduced** — deriving them requires reverting the config, which guard may not do. Criterion 4 requires the counts be _listed_, which they are.
- Conduct, non-blocking: the executor committed its own work and, in the batch `README.md` (in its scope for status updates), replaced guard's checkpoint-1 note with its own summary and re-flipped the row to `DONE` ahead of this gate. Guard's own artifacts were untouched and the replacement text is accurate.

- Action: verdict **PASS**. Close-out report overwritten. PR opened via the `pr` skill — [#57](https://github.com/humanspeak/svelte-virtual-chat/pull/57). Merging is the operator's call; guard stops here.
