# Executor report — 001 lint-unit-tests-and-typed-lint

## Summary

Plan 001 is complete after the guard follow-up. The typed lint config is wired
for `.ts`, `.test.ts`, and `.svelte` parser paths; the seven unit-test files are
no longer ignored; and the final gates are green.

The amended plan records one important limitation: TypeScript-ESLint's
`no-misused-promises` `checksVoidReturn.attributes` option does not inspect
Svelte event attributes. Statement-level floating promises are covered in
Svelte files, but promise-returning Svelte event handlers are not. The
`sweep.start(...)` event handlers in the test fixtures are therefore marked
with `void` as a consistency/style choice, not because a rule enforces it.

## Step 3 proof

The three scratch-file probes all reported
`@typescript-eslint/no-floating-promises`:

| Probe file                                   | Result         |
| -------------------------------------------- | -------------- |
| `src/lib/virtual-chat/scratch-check.ts`      | fired at `2:5` |
| `src/lib/virtual-chat/scratch-check.test.ts` | fired at `2:5` |
| `src/routes/tests/chat/scratch-check.svelte` | fired at `3:9` |

All scratch files were deleted after the proof, and `trunk check` was clean
after deletion.

## Scoped relaxations

| Scope                                                                                                                                              |                                                    Count | Rationale                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files: ['**/*.test.ts', 'tests/**/*.spec.ts']` disables `@typescript-eslint/no-non-null-assertion`                                                |        13 current non-null assertions in test/spec files | Tests intentionally assert prior existence, then dereference Playwright boxes, DOM descriptors, or captured anchors. Keeping this scoped to tests avoids weakening production code. |
| Root config/script block uses `ts.configs.disableTypeChecked` for `*.mjs`, `*.config.js`, `*.config.ts`, `vitest.setup.ts`, and `scripts/**/*.mjs` | 6 project-service parse errors observed before the block | Trunk runs these files from temporary paths outside the TS project. Untyped lint still runs, but typed parser rules cannot attach reliably there.                                   |
| `docs/**/*` uses `ts.configs.disableTypeChecked`                                                                                                   |   11 docs typed/project issues observed before the block | `docs/` has its own workspace tooling and is out of scope for this root typed-lint plan. Untyped lint still runs; root typed rules do not invade the docs tsconfig boundary.        |

No rule from the type-checked preset was disabled repo-wide to force green.

## Promise handling

- `src/lib/SvelteVirtualChat.svelte`: `onNeedHistory()` is marked with `void`
  because history loading is consumer-owned async work and scroll handling must
  keep moving.
- `src/routes/tests/chat/margin-bubbles/+page.svelte`: both `sweep.start(...)`
  calls are marked with `void` because Svelte event attributes do not lint
  returned promises and fixture sweeps are intentionally fire-and-forget.
- `src/routes/tests/chat/estimate-miss/+page.svelte`: the matching
  `sweep.start(...)` call is also marked with `void` for consistency with the
  byte-identical margin-bubbles pattern.
- `src/routes/tests/chat/stream-swap/+page.svelte` is intentionally untouched;
  the amended plan says that pattern is not a lint violation.

## Suppression counts

- Added `eslint-disable` comments: 0
- Added `trunk-ignore` comments: 0

## Verification

- `pnpm run check` — 0 errors, 0 warnings
- `npx vitest run` — 8 files, 150 tests passed
- `trunk fmt` — no issues
- `trunk check --all` — no issues
- `npx playwright test tests/chat/basic.spec.ts tests/chat/stream-swap.spec.ts --project=chromium` — 20 passed

## Notes

- The idle snap-loop probe now casts the native `scrollTop` getter result to
  `number` instead of falling back to `0`, so a broken getter remains loud.
- The `docs/**/*` typed-rule escape is intentionally documented here because
  the plan's written scope says to leave docs behavior alone.
