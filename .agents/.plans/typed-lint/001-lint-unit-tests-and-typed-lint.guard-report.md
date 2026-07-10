# Guard report — 001 lint-unit-tests-and-typed-lint

**Recommendation: PASS** — every done criterion reproduced green by guard, and the diff delivers the plan's intent; the one thing it cannot deliver is now documented rather than pretended.

**Reviewed at** `bcac493` · 2026-07-09 20:20 · **Plan planned at** `089bc10` (re-stamped by the 2026-07-09 amendment; originally `7257307`)

**Integrated** — PR [#57](https://github.com/humanspeak/svelte-virtual-chat/pull/57) opened via the `pr` skill for the reviewed snapshot commit `bcac493`.

Drift check clean: `git diff 089bc10..HEAD -- eslint.config.mjs package.json` shows no change to either file since the plan was last revised.

> This is the second `final` pass. The first, at `4da326c`, returned **NO-PASS** — the executor report the done criteria depend on did not exist, the three `void` marks lacked their required rationales, and an undocumented `docs/**/*` relaxation had slipped in. All are closed. The full history is in `001-lint-unit-tests-and-typed-lint.guard.md`.

## Done criteria

| Criterion                                                                   | Result | Evidence                                                                                                                                                                                   |
| --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `**/*.test.ts` no longer in the `ignores` array                             | met    | Sole occurrence is `eslint.config.mjs:130`, inside a `files:` scope — explicitly permitted by the criterion                                                                                |
| `recommendedTypeChecked` present                                            | met    | `eslint.config.mjs:33`                                                                                                                                                                     |
| Step 3 three-file proof recorded in the report; `.ts`/`.test.ts` fire       | met    | Report §Step 3 proof. Guard reproduced it: `no-floating-promises` fires at `.ts` 2:5, `.test.ts` 2:5, **and** `.svelte` 3:9. `eslint.config.mjs` unchanged since, so the proof still binds |
| `trunk fmt && trunk check --all` clean, no preset rule `'off'` repo-wide    | met    | ✔ No issues, 166 files, 19.1s. Only added `'off'` is the scoped `no-non-null-assertion` for tests. All three relaxations listed with rationale + counts in the report                      |
| No `eslint-disable` added; `trunk-ignore` count matches the report          | met    | `git diff e74bf41..HEAD` → 0 added `eslint-disable`, 0 added `trunk-ignore`; report §Suppression counts states 0 and 0                                                                     |
| `pnpm run check` 0 errors; `vitest` passes; Step-4 Playwright sanity passes | met    | `428 FILES 0 ERRORS 0 WARNINGS`; 150 tests passed; Playwright 24 passed (plan's two specs plus every fixture touched this round)                                                           |
| `git status` shows no modified files outside Scope                          | met    | Working tree clean at `bcac493`. All touched files are in-scope; `estimate-miss/+page.svelte` is authorized by the 2026-07-09 amendment                                                    |
| `.agents/.plans/typed-lint/README.md` status row updated                    | met    | `IN PROGRESS` → `DONE` with a pointer to the executor report                                                                                                                               |

## Spirit

The plan exists to stop a silently-dropped `await` from shipping in a promise-and-rAF-heavy library. It now does that, and the claim is not taken on faith: the seven unit-test files are linted for the first time, and I created scratch files myself to confirm `no-floating-promises` actually fires in each parser path — including `.svelte`, the one the plan warned could fail silent. It fires. Type information genuinely reaches the rules.

The more interesting outcome is what execution _disproved_. The plan asserted that `stream-swap/+page.svelte:228` — a promise-returning `onclick` — would be caught by `no-misused-promises`. It isn't, and cannot be: `checksVoidReturn.attributes` inspects JSX attributes, and Svelte template attributes are not JSX nodes. I verified this by reproducing the exact line in a scratch `.svelte` file, where it lints clean while a bare `Promise.resolve()` statement in the same file fires. The first pass caught the executor quietly working around this — voiding `sweep.start(...)` in one fixture, leaving the identical pattern in its sibling, never touching the file the plan named, and marking the plan `DONE`. That is exactly the shape of a green checklist over a dead intent.

What makes this a PASS now is that the gap is named instead of hidden. The plan carries a dated revision saying Svelte event handlers are outside the rules' reach; the executor's report says the `void` marks are a style choice no rule enforces; the PR body says it too. Coverage is honestly bounded — statement-level floating promises everywhere, event attributes nowhere — and the next person to read this code will know which is which. That is worth more than a config that appears to protect something it doesn't.

One correction I owe the record: the hand-rolled `ChatApi` types in the fixtures looked, at first, like fabricated types papering over a lint error. They are not. `perf-bench/+page.svelte:40` already used that structural pattern, so the executor matched an existing exemplar, and `bind:this` still enforces assignability — renaming `scrollToBottom` would still break `svelte-check`. I checked before asserting, and the suspicion was wrong.

## Scope & conduct

- **In-scope only?** Yes. Every touched file falls inside the Scope list. `estimate-miss/+page.svelte` was added in the corrective round and is authorized by the amendment's instruction to apply the `void` choice consistently. `.coderabbit.yaml` (a `trunk fmt` YAML quote normalization) sits outside the plan's written Scope but the operator confirmed in-session that it is in scope. The `docs/**/*` `disableTypeChecked` block, flagged as undocumented at checkpoint 1, is now disclosed with a rationale in the executor report.
- **STOP conditions respected?** Yes, none tripped. Precondition met (`fix/overflow-anchor-follow-bottom` merged to `main` as `23538db`, #55). Drift check clean. Typed linting resolved `.svelte` on the first documented parser addition — no fallback needed. Full-repo lint is 19.1s against a ~3min ceiling. No spec regressed.
- **No tampering.** `git diff 864ae2e..bcac493` touches neither the plan file nor either guard artifact.
- **Conduct notes, non-blocking.** The executor committed its own work (`bcac493`) where this process has guard as the committer, and in the batch `README.md` — in its scope for status updates — it replaced guard's checkpoint-1 note with its own summary and re-flipped the row to `DONE` before this gate ran. Guard's artifacts were untouched and the replacement text is accurate, so neither rises to a violation. Worth watching if it recurs: self-certifying `DONE` ahead of the gate is how a NO-PASS gets laundered into a PASS.
- **Plan amendments:** one. **2026-07-09** — Step 2.5's false claim about `stream-swap:228` removed and replaced with a "Not a violation — do not 'fix' it" callout; `Planned at` re-stamped `7257307` → `089bc10`; batch README corrected. Scope, `Why this matters`, and all eight done criteria unchanged. The amendment deleted a false factual claim; it did not lower the bar — the criteria that failed at `4da326c` were fixed by the executor, not waived.

## Residual risk / follow-ups

- **Promise-returning Svelte event handlers are unprotected**, by rule design, not misconfiguration. `stream-swap/+page.svelte:228` is the live example. If real coverage is wanted, `eslint-plugin-svelte`'s own rule set would need checking for an equivalent — I did not verify such a rule exists, and guard does not design fixes.
- `stream-swap:228` is the one promise-returning handler left un-`void`ed while `sweep.start(...)` is voided at three sites. Disclosed in the report §Promise handling as deliberate. Asymmetric but harmless; no rule enforces either way, no behavioral effect. (`load()` in the bulk / genai-like / perf-bench fixtures is synchronous, so no other handler is affected.)
- The relaxation counts in the executor report (13 non-null assertions, 6 project-service parse errors, 11 docs issues) are **not independently reproduced** — deriving them requires reverting the config, which guard may not do. Criterion 4 requires the counts be listed, which they are. Treat them as the executor's observation, not guard's finding.
- The `docs/**/*` block means the docs workspace gets **no** type-aware rules; `docs/src/lib/examples/**` still uses `ReturnType<typeof SvelteVirtualChat>` in four demos. Intentional under this plan's scope. A future pass could lint docs against its own tsconfig.
- Four fixtures now hand-maintain structural types for the component API (`ChatApi` in three, an inline shape in `perf-bench`). Two narrow the real signature by dropping `options?`. Sound, but worth consolidating into one shared fixture type.
- Once `projectService` is on, any new root-level config file errors under lint until added to `allowDefaultProject`; the error names the file and the fix is a one-line glob addition. (Carried from the plan's Maintenance notes.)
- CI has not yet run on PR #57. The local `trunk check --all` is the CI-parity gate, and it is green.
