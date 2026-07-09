# Guard report — 001 lint-unit-tests-and-typed-lint

**Recommendation: NO-PASS** — the tooling works and every gate is green, but the plan's required report was never written, so three done criteria that depend on it fail; and the plan's own headline `.svelte` example turns out to be uncatchable, which nobody recorded.

**Reviewed at** `4da326c` · 2026-07-09 19:51 · **Plan planned at** `7257307`

Drift check run and clean: `git diff 7257307..HEAD -- eslint.config.mjs` is empty; `package.json`'s only delta is the `0.1.17→0.1.18` version bump plus the `lint`/`format` script removal the plan documents as expected.

## Done criteria

| Criterion                                                                   | Result   | Evidence                                                                                                                                                                         |
| --------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**/*.test.ts` no longer in the `ignores` array                             | met      | Only occurrence is `eslint.config.mjs:130`, inside a `files:` scope — permitted by the criterion                                                                                 |
| `recommendedTypeChecked` present                                            | met      | `eslint.config.mjs:33`                                                                                                                                                           |
| Step 3 three-file proof **recorded in the report**; `.ts`/`.test.ts` fire   | **FAIL** | Rules provably fire — guard re-ran the probe: `.ts` 2:5, `.test.ts` 2:5, **and** `.svelte` 3:9 all report `no-floating-promises`. But **no executor report exists** to record it |
| `trunk fmt && trunk check --all` clean, no preset rule `'off'` repo-wide    | **FAIL** | Lint is clean (✔ No issues, 163 files, 19.2s) and the only `'off'` is the sanctioned scoped `no-non-null-assertion`. But the `docs/**/*` relaxation is listed in no report       |
| No `eslint-disable` added; `trunk-ignore` count matches the report          | **FAIL** | `git diff e74bf41..HEAD` → 0 added `eslint-disable`, 0 added `trunk-ignore`. Counts are correct; there is no report to match them against                                        |
| `pnpm run check` 0 errors; `vitest` passes; Step-4 Playwright sanity passes | met      | `428 FILES 0 ERRORS 0 WARNINGS`; 150 tests passed; `basic.spec.ts` + `stream-swap.spec.ts` → 20 passed                                                                           |
| `git status` shows no modified files outside Scope                          | met      | `.coderabbit.yaml` is outside the written Scope list; operator confirmed in-session that it is in scope. Everything else is in-scope                                             |
| `.agents/.plans/typed-lint/README.md` status row updated                    | met      | `TODO` → `DONE`                                                                                                                                                                  |

## Spirit

The plan's purpose is to stop a silently-dropped `await` from shipping in a promise-and-rAF-heavy library. On the part that can be delivered, the executor delivered it, and I confirmed it rather than taking its word: the 7 unit-test files are now linted, and `no-floating-promises` provably fires in all three parser paths — `.ts`, `.test.ts`, and `.svelte`. The `.svelte` path is the one the plan warned could "fail silent," and it does not. That is the real win, and it is genuine.

The gap is one the plan created, not the executor: **`no-misused-promises`' `checksVoidReturn.attributes` only inspects JSX attributes, so a promise-returning Svelte event handler is invisible to it.** Step 2.5 names `stream-swap/+page.svelte:228` as the canonical catch; that line is untouched, lints green, and always will. I verified this directly — a scratch `.svelte` reproducing the line reports ✔ No issues while a bare `Promise.resolve()` statement in the same file fires. So the protection the plan advertises for fixture event handlers does not exist. Statement-level floating promises are covered everywhere; the event-attribute case is not.

What the executor owed here was a report saying so. Instead it voided `sweep.start(...)` in `margin-bubbles` — which no rule demanded — left the byte-identical pattern at `estimate-miss/+page.svelte:53` alone, never touched the file the plan named, and marked the plan `DONE`. The code is fine; the record is not. Someone reading this branch in six months would believe Svelte event handlers are promise-safe. They aren't.

I want to be precise about what is _not_ wrong, because it looked wrong at first: the hand-rolled `ChatApi` types in the three fixtures are **not** fabrication or a safety regression. `perf-bench/+page.svelte:40` already used that exact structural-type pattern for `bind:this` before this work, so the executor converged on an existing in-repo exemplar. And the coupling survives — `bind:this` still requires the component instance be assignable, so renaming `scrollToBottom` would still break `svelte-check`. Two of the three declarations narrow the signature (dropping `options?`), which is sound but imprecise.

## Scope & conduct

- **In-scope only?** Yes. `.coderabbit.yaml` sits outside the plan's written Scope list, but the operator confirmed in-session that it is in scope; the change is a `trunk fmt` YAML quote normalization (`['coderabbit']` → `[coderabbit]`). The one genuine boundary question is `eslint.config.mjs:121-128`, a `docs/**/*` `disableTypeChecked` block: it edits an in-scope file but grants an exemption to a directory the plan marked out-of-scope with "Leave it." It is technically necessary — `docs/` is outside the root tsconfig, so `projectService` would error there — and it disables only _typed_ rules, leaving untyped ones active. Defensible, undocumented.
- **STOP conditions respected?** Yes, none tripped. Precondition met (`fix/overflow-anchor-follow-bottom` merged to `main` as `23538db`, #55). Drift check clean. Typed linting resolved `.svelte` on the first documented parser addition — no fallback needed. Full-repo lint is 19.2s against a ~3min ceiling. No spec regressed: beyond the plan's two-spec sanity, I ran every behaviorally-edited spec (anchor-probe, fill-in-sawtooth, idle-snap-loop, late-table-growth, smooth-scroll, wheel-scroll-jump) → 21 passed, 2 skipped.
- **No tampering.** The plan file itself is unmodified; `git diff e74bf41..HEAD -- .agents/` touches only `README.md`'s status row, which Scope explicitly permits.
- **Plan amendments during execution:** none. The plan defect above is surfaced for the operator's decision, not applied — guard amends only with explicit agreement.

## What would flip this to PASS

1. **Write the executor report.** It is the artifact three done criteria hang on. It must carry: the Step 3 three-file proof (guard's results above may be cited); an inventory of every scoped relaxation with a one-line rationale each — the test-file `no-non-null-assertion` override, the root-config `disableTypeChecked` block, and the `docs/**/*` block; and the `trunk-ignore` count (0).
2. **Add the one-line rationale above each `void`** — `SvelteVirtualChat.svelte:640`, `margin-bubbles/+page.svelte:93` and `:102` — as Step 2.5 and Maintenance note (1) require.
3. **Resolve the `margin-bubbles` / `estimate-miss` inconsistency.** Either `void` both and note that it is a style choice no rule enforces, or revert the `margin-bubbles` voids. Pick one; the current split state is the confusing outcome.
4. **Operator decision on the plan defect** (see below). At minimum it should be recorded in the plan so the false sense of coverage doesn't outlive this branch.

## Residual risk / follow-ups

- **Svelte event handlers returning promises are unprotected**, and the plan implies otherwise. If real coverage is wanted, `eslint-plugin-svelte`'s own rule set would need to be checked for an equivalent — I did not verify that one exists, and guard does not design the fix. If no rule exists, the honest move is to record the gap in the plan and accept it.
- `tests/chat/idle-snap-loop.spec.ts:34-35` now returns `0` when the native `scrollTop` getter yields a non-number. `scrollTop` is always numeric so this is inert today, but it converts a would-be loud failure in a scroll-measurement probe into a silent `0`. A cast (`as number`) would have satisfied the rule without the fallback.
- Three fixtures declare `ChatApi` structurally and two narrow the real signature (dropping `options?`). Sound, but these are now three hand-maintained shapes of one component API alongside `perf-bench`'s fourth. Worth consolidating into one shared fixture type later.
- Once `projectService` is on, any new root-level config file will error under lint until added to `allowDefaultProject` — the error names the file; the fix is a one-line glob addition. (Carried forward from the plan's Maintenance notes.)
- The `docs/**/*` block means the docs workspace gets **no** type-aware rules. `docs/src/lib/examples/**` still uses `ReturnType<typeof SvelteVirtualChat>` in four demos. Intentional under this plan's scope; a future pass could lint docs on its own tsconfig.
