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
