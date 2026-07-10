# Batch signoff — typed-lint

**Status: CLOSED** · Signed off 2026-07-09 · All plans PASS, merged to `main`.

This batch is complete and moved to `.agents/.plans-closed/`. No plan in it
remains executable; the documents are retained as the record of what was done,
how it was verified, and what was deliberately left out of scope.

## Plans

| Plan | Title                                                     | Verdict                         | PR                                                               | Merged to main             |
| ---- | --------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------- | -------------------------- |
| 001  | Lint the unit-test files and enable type-aware lint rules | PASS (2nd `final`; 1st NO-PASS) | [#57](https://github.com/humanspeak/svelte-virtual-chat/pull/57) | `a0bf83b` (2026-07-10 UTC) |

## What the batch delivered

- The 7 vitest unit-test files are linted for the first time (`**/*.test.ts`
  removed from the `ignores` array; now only a `files:` scope).
- Type-aware linting is live repo-wide via `recommendedTypeChecked` +
  `projectService`: `no-floating-promises` verified firing in `.ts`,
  `.test.ts`, **and** `.svelte` parser paths (guard reproduced each with
  scratch files — not taken on faith).
- The one thing the config cannot deliver is documented instead of pretended:
  promise-returning **Svelte event-handler attributes** are outside
  `no-misused-promises`' reach by rule design (`checksVoidReturn.attributes`
  inspects JSX nodes only). Recorded in the plan revision, the executor
  report, and PR #57's body.

## Gate history (full detail in `001-….guard.md` / `001-….guard-report.md`)

First `final` at `4da326c` was **NO-PASS**: the executor report the done
criteria depend on did not exist, three `void` marks lacked rationales, and an
undocumented `docs/**/*` relaxation had slipped in. A corrective round closed
all three; second `final` at `bcac493` reproduced every done criterion green
and returned **PASS**. One plan amendment (2026-07-09) deleted a false factual
claim about `stream-swap/+page.svelte:228`; no criterion was weakened.

## CI at close-out

PR #57 merged with builds (Node 22/24), unit tests, and Trunk Check green.
The local `trunk check --all` CI-parity gate was green at the reviewed
snapshot. CI status of the post-merge e2e run is recorded in the close-out PR
description.

## Residual follow-ups carried forward (none block closure)

- **Svelte event handlers remain unprotected** against un-awaited promises. If
  real coverage is wanted, check `eslint-plugin-svelte` for an equivalent rule
  — its existence was not verified.
- The `docs/**/*` workspace gets no type-aware rules (`disableTypeChecked`);
  a future pass could lint docs against its own tsconfig.
- Four test fixtures hand-maintain structural `ChatApi`-style types; worth
  consolidating into one shared fixture type.
- New root-level config files will error under `projectService` until added to
  `allowDefaultProject` (one-line glob fix; the error names the file).
- `eslint-plugin-unused-imports` is installed but unregistered — deferred to a
  future hygiene pass (see batch README, rejected findings).
