# Plan 001: Lint the unit-test files and enable type-aware lint rules that catch floating promises

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/typed-lint/README.md`).
>
> **Drift check (run first)**:
> `git diff --stat 7257307..HEAD -- eslint.config.mjs package.json`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (The SHA sits on the
> `fix/overflow-anchor-follow-bottom` branch; if it is not an ancestor of your
> HEAD, fall back to comparing the excerpts textually — they are authoritative.)
>
> **Precondition**: confirm the `fix/overflow-anchor-follow-bottom` branch
> (batch `stream-swap-follow`, plan 002) has merged to `main`, or is abandoned,
> before starting. That branch actively modifies
> `src/lib/virtual-chat/chatMeasurement.svelte.ts`,
> `src/lib/SvelteVirtualChat.svelte`, and the stream-swap fixture — files this
> plan will surface lint fixes in. Running both concurrently produces
> conflicting edits to the same lines. If it is still open and active, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (turning on typed rules surfaces a batch of pre-existing
  violations to triage; the fixes themselves are mechanical)
- **Depends on**: none within this batch (see Precondition above for the
  cross-batch ordering constraint)
- **Category**: dx
- **Planned at**: commit `7257307`, 2026-07-09

## Why this matters

Two lint blind spots in a promise-and-rAF-heavy virtual-scroll library:

1. `eslint.config.mjs` puts `'**/*.test.ts'` in the top-level `ignores`, so the
   **7 vitest unit-test files** in `src/lib/virtual-chat/` get zero static
   checking. These are exactly the tests guarding the height cache's deferred
   microtask version bumps (`chatMeasurement.svelte.test.ts`), scroll-intent
   attribution, and anchoring math — async-adjacent code where an unawaited
   promise or an accidental `.only` ships silently. (Unlike the sibling
   svelte-markdown repo where ~150 files were dark, the blast radius here is
   small: the 20 Playwright `.spec.ts` files under `tests/` are named `.spec.ts`,
   don't match the ignore glob, and are **already linted**.)
2. The config uses `ts.configs.recommended` (not `recommendedTypeChecked`) and
   never sets `parserOptions.project`/`projectService`, so no type information
   reaches any rule — `@typescript-eslint/no-floating-promises` and
   `no-misused-promises` are effectively off **everywhere**, including the 20
   already-linted Playwright specs. Those are the rules that catch a dropped
   `await` on `expect.poll(...)`, on a fixture's `runScenario(...)`, or on the
   component's rAF/microtask scheduling. `svelte-check` does not catch floating
   promises; nothing currently does.

This is bug-prevention, not cosmetics: the stream-swap work (batch
`stream-swap-follow`) repeatedly hinged on exactly-once awaited paint monitors
and settle promises in fixtures and specs; a silently dropped `await` there
produces the flaky-CI class of failure this repo just spent a cycle chasing.

## Current state

Recorded at commit `7257307`. All excerpts verified by direct read.

### The ignore and the untyped preset — `eslint.config.mjs`

```js
// eslint.config.mjs (abridged; full file is ~110 lines)
export default [
    includeIgnoreFile(gitignorePath),
    {
        ignores: [
            /* ...build dirs, lockfiles... */
            '**/dist',
            '**/*.test.ts' // ← the unit-test blind spot
        ]
    },
    js.configs.recommended,
    ...ts.configs.recommended, // ← NOT recommendedTypeChecked
    ...svelte.configs['flat/recommended'],
    prettier,
    ...svelte.configs['flat/prettier'],
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            parserOptions: {
                tsconfigRootDir // ← no `project` / `projectService`
            }
        },
        rules: {
            /* stylistic tweaks + no-unused-vars patterns */
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: { parser: ts.parser }
        },
        rules: {
            'prefer-const': ['off'],
            'svelte/no-navigation-without-resolve': ['off']
        }
    }
]
```

### The 7 unlinted unit-test files (complete list)

```text
src/lib/virtual-chat/chatAnchoring.test.ts
src/lib/virtual-chat/chatLayoutPreservation.test.ts
src/lib/virtual-chat/chatMeasurement.svelte.test.ts   ← uses Svelte runes ($state via the class under test)
src/lib/virtual-chat/chatScrollIntent.test.ts
src/lib/virtual-chat/chatScrollPolicy.test.ts
src/lib/virtual-chat/chatScrollProgress.test.ts
src/lib/virtual-chat/chatVisualAnchoring.test.ts
```

Vitest runs with `types: ["vitest/globals"]` (root `tsconfig.json`), so
`describe`/`it`/`expect` are ambient globals in these files — the test override
block in Step 1 must not re-flag them (in TS files `no-undef` is already off via
the TS preset, so this should be free; verify, don't assume).

### Type-project coverage (matters for typed linting)

Root `tsconfig.json` extends `.svelte-kit/tsconfig.json`, whose `include`
covers `../src/**/*.ts`, `../src/**/*.svelte`, `../tests/**/*.ts`, and
`../vite.config.ts` — so **source, unit tests, Playwright specs, and fixtures
are all inside the TS project**. However, these root files are **NOT** in any
tsconfig include and will error under typed linting unless handled:

```text
playwright.config.ts
vitest.setup.ts
eslint.config.mjs (itself)
```

Step 2 handles them with `projectService.allowDefaultProject` (preferred) or by
scoping the type-checked preset away from them.

### Tooling conventions (Trunk is the source of truth — CLAUDE.md, "Code Style & Linting")

- **Never run `npx prettier` or `npx eslint` directly** (CLAUDE.md
  prohibition, adopted 2026-07-09 to match the sibling svelte-markdown repo).
  Format and lint via Trunk only: `trunk fmt`, `trunk check` (changed files),
  `trunk check --all` (full repo / CI parity). The `lint`/`format` scripts
  were **removed from `package.json` and `docs/package.json`** in the same
  adoption — if `pnpm lint` fails as "missing script", that is by design, not
  drift.
- **Trunk is also the CI gate**: a `Trunk Check` job runs on PRs
  (eslint@10.5.0 + prettier@3.8.4 among its linters, `.trunk/trunk.yaml`), and
  the husky pre-commit hook (`.husky/pre-commit`) runs `trunk fmt`,
  `trunk check --fix`, then `pnpm run -s check` on every commit — you cannot
  commit with lint red.
- **Never use `eslint-disable` comments.** The only sanctioned suppression is
  Trunk's inline ignore, with a one-line rationale comment:
  `// trunk-ignore(eslint/rule-name)`. Exemplars:
    - `src/lib/types.ts:6` — `/* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */`
    - `src/lib/virtual-chat/chatMeasurement.svelte.ts` (search
      `trunk-ignore(eslint/svelte/prefer-svelte-reactivity)`) — next-line form
      with a rationale comment above it.

    Note: raw ESLint still reports trunk-ignored lines as violations because the
    suppression lives at the Trunk layer — verify through `trunk check`, never
    through raw ESLint output. Blanket-disabling a rule in `eslint.config.mjs`
    to force green is prohibited (Done criteria).

- Indentation is 4 spaces, single quotes, no semicolons (prettier enforces,
  via Trunk).

## Commands you will need

| Purpose          | Command                                                           | Expected on success         |
| ---------------- | ----------------------------------------------------------------- | --------------------------- |
| Install          | `pnpm install`                                                    | exit 0                      |
| Format changed   | `trunk fmt`                                                       | exit 0                      |
| Lint changed     | `trunk check`                                                     | ✔ No issues                 |
| Lint one path    | `trunk check <path>`                                              | ✔ No issues                 |
| Lint (CI parity) | `trunk check --all`                                               | ✔ No issues                 |
| Typecheck        | `pnpm run check`                                                  | `0 ERRORS 0 WARNINGS`       |
| Unit tests       | `npx vitest run`                                                  | all pass (141+ at planning) |
| One e2e sanity   | `npx playwright test tests/chat/basic.spec.ts --project=chromium` | passes                      |

Never run `npx prettier` or `npx eslint` directly (CLAUDE.md, "Code Style &
Linting"); the `pnpm lint`/`pnpm format` scripts no longer exist.

Notes:

- `trunk check` without `--all` only inspects files changed vs. upstream —
  that covers new/untracked files like Step 3's scratch files. Because this
  plan turns on repo-wide rules, the CI-parity gate is `trunk check --all`.
- Playwright owns port 4173; if e2e mass-fails with timeouts, run
  `lsof -ti :4173 | xargs kill -9` and retry before diagnosing.

## Scope

**In scope** (the only files you should create or modify):

- `eslint.config.mjs` — remove the test-file ignore, add a test override
  block, enable typed linting.
- Source, fixture, unit-test, and spec files **only** to fix violations the
  newly-enabled rules surface — minimal, mechanical fixes (add a missing
  `await`, `void`-mark a justified fire-and-forget, remove a dead expression).
- `.agents/.plans/typed-lint/README.md` (status update).

**Out of scope** (do NOT touch, even though they look related):

- `tsconfig.json` compile behavior and `.svelte-kit/tsconfig.json` (generated).
  If typed linting needs the root config files covered, use
  `projectService.allowDefaultProject` in `eslint.config.mjs` — do not widen
  the build tsconfig.
- `.trunk/trunk.yaml` — the Trunk linter set and versions stay as they are.
- Prettier config, `.husky/pre-commit`.
- Rewriting any test's logic or assertions beyond what a rule violation
  mechanically requires. The spec suite is the regression net for in-flight
  scroll work; behavioral edits to it are drift.
- `docs/` — the docs workspace has its own tooling; `tsconfig.json` already
  excludes it and the eslint gitignore-include keeps its build out. Leave it.

## Git workflow

- Branch off `main`: `chore/typed-lint` (repo convention is `type/short-slug`,
  e.g. `fix/stream-swap-follow-bottom` from `git log`).
- Conventional commits. Two commits recommended:
    1. `chore(lint): lint unit test files and enable type-aware promise rules`
       (config only)
    2. `fix(chat): resolve violations surfaced by typed lint` (the mechanical
       fixes — use `fix(...)` only if a real bug was surfaced; otherwise fold
       into a single `chore(lint)` commit)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Lint the unit-test files with a scoped override

In `eslint.config.mjs`:

1. Remove `'**/*.test.ts'` from the top-level `ignores` array.
2. Append a flat-config override block scoped to
   `files: ['**/*.test.ts', 'tests/**/*.spec.ts']` that relaxes only what
   tests legitimately need. Start minimal — likely only:

    ```js
    {
        files: ['**/*.test.ts', 'tests/**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off'
        }
    }
    ```

    Add further relaxations **only** when a surfaced violation is genuinely
    test-appropriate (e.g. `no-explicit-any` on a deliberately malformed input);
    record each in your report with its violation count.

3. Run `trunk check src/lib/virtual-chat/` and triage what surfaces in the 7
   unit-test files. Fix violations minimally.

**Verify**:
`trunk check src/lib/virtual-chat/chatMeasurement.svelte.test.ts` → ✔ No
issues, and the file is actually inspected (temporarily add `const x = 1`
unused-var to confirm a finding appears, then remove it). Then
`trunk fmt && trunk check` → ✔ No issues.

### Step 2: Enable type-aware linting

In `eslint.config.mjs`:

1. Replace `...ts.configs.recommended` with `...ts.configs.recommendedTypeChecked`.
2. In the shared `languageOptions.parserOptions`, add:

    ```js
    parserOptions: {
        tsconfigRootDir,
        projectService: {
            allowDefaultProject: ['*.ts', '*.mjs']
        }
    }
    ```

    `allowDefaultProject` covers the root files outside the tsconfig include
    (`playwright.config.ts`, `vitest.setup.ts`, `eslint.config.mjs`) — its
    globs must not contain `**` (typescript-eslint restriction).

3. Add the standard escape hatch for `.mjs`/config files if typed rules choke
   on them: a `{ files: ['*.mjs', '*.config.ts', 'vitest.setup.ts'], extends:
[ts.configs.disableTypeChecked] }`-style block (flat-config spread form) is
   acceptable and does not count as gaming the rules.
4. For the Svelte block, extend its `parserOptions` so the svelte parser feeds
   type info: keep `parser: ts.parser` and add `projectService: true` plus
   `extraFileExtensions: ['.svelte']` at the level `svelte-eslint-parser`
   documents for typed linting. If `.svelte` typed linting fails to resolve
   after this one addition, fall back to applying `recommendedTypeChecked`
   only to `**/*.ts` files and leaving `.svelte` files on the untyped preset —
   record that in the report; do NOT iterate further (STOP condition guards
   the rabbit hole).

5. Triage surfaced violations. Known-likely hits from planning recon (verify,
   don't assume): - `src/routes/tests/chat/stream-swap/+page.svelte` — `onclick={() =>
runScenario(selectedVariant)}` returns a promise into a void handler
   (`no-misused-promises` with `checksVoidReturn.attributes`). The idiomatic
   minimal fix is `onclick={() => { void runScenario(selectedVariant) }}`.
   If this pattern recurs across many fixtures, relaxing
   `checksVoidReturn: { attributes: false }` for `**/*.svelte` only is an
   accepted, documented alternative (rationale: Svelte event attributes are
   fire-and-forget by design) — choose one approach, apply consistently. - Playwright specs — any unawaited `expect(...)` /`expect.poll` chains.
   Fix with `await`. - Fire-and-forget monitors in fixtures (`monitorPaintedBottomGap`-style) —
   these are deliberately concurrent; where one is intentionally not awaited
   at call site, `void` it with a one-line rationale.

**Verify**: `trunk fmt && trunk check --all` → ✔ No issues.
`pnpm run check` → `0 ERRORS 0 WARNINGS`.

### Step 3: Prove the promise rules are actually wired to type info

Type-aware rules fail silent — a mis-wired parser path just reports nothing.
Prove activation in each parser path:

1. Create three scratch files, each containing a bare `Promise.resolve()`
   statement (no `await`, no `void`):
    - `src/lib/virtual-chat/scratch-check.ts`
    - `src/lib/virtual-chat/scratch-check.test.ts`
    - `src/routes/tests/chat/scratch-check.svelte` (the statement inside
      `<script lang="ts">`, e.g. in a function body)
2. Run `trunk check <each path>` and confirm each reports
   `@typescript-eslint/no-floating-promises`. If the `.svelte` one does not
   fire AND you took the Step-2 fallback (untyped `.svelte`), that is expected
   — record it; the `.ts` and `.test.ts` ones must fire regardless.
3. Delete all three scratch files.

**Verify**: after deletion, `git status --porcelain` shows no scratch files;
`trunk check` → ✔ No issues. Record the three per-file results verbatim in
your report.

### Step 4: Full gate

**Verify, in order**:

1. `pnpm run check` → `0 ERRORS 0 WARNINGS`
2. `npx vitest run` → all pass
3. `trunk fmt && trunk check --all` → ✔ No issues (CI parity — the CI `Trunk
Check` job runs this same linter set)
4. `npx playwright test tests/chat/basic.spec.ts tests/chat/stream-swap.spec.ts --project=chromium`
   → all pass (sanity that mechanical `await`/`void` fixes didn't alter spec
   or fixture behavior)

## Test plan

- No new unit tests — this is tooling. The behavioral guard is Step 3 (rules
  provably active in each parser path) plus green vitest + the two-spec
  Playwright sanity in Step 4.
- If a surfaced violation was a **real bug** (a genuinely missing `await` that
  changed behavior), that fix DOES need a regression test — model it on the
  nearest existing test file and flag it prominently in the report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "\*\*/\*\.test\.ts" eslint.config.mjs` → no match in the
      `ignores` array (a `files:` scope for the override block is fine).
- [ ] `grep -n "recommendedTypeChecked" eslint.config.mjs` → present.
- [ ] Step 3's three-file proof recorded in the report; `.ts` and `.test.ts`
      paths provably fire `no-floating-promises`.
- [ ] `trunk fmt && trunk check --all` reports no issues — with no rule from
      the type-checked preset set `'off'` repo-wide to force green. Scoped
      relaxations (test override, Svelte `checksVoidReturn.attributes`,
      `disableTypeChecked` for root config files) are permitted only with a
      one-line rationale each, listed in the report with violation counts.
- [ ] No `eslint-disable` comments introduced:
      `git diff main -- '*.ts' '*.svelte' '*.mjs' | grep -c "eslint-disable"`
      → 0 added. Every new `trunk-ignore` carries a rationale line, and
      `git diff main -- '*.ts' '*.svelte' | grep -c "trunk-ignore"` matches
      the count listed in the report.
- [ ] `pnpm run check` → 0 errors; `npx vitest run` → all pass; the Step-4
      Playwright sanity passes.
- [ ] `git status` shows no modified files outside the Scope list.
- [ ] `.agents/.plans/typed-lint/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The Precondition fails: `fix/overflow-anchor-follow-bottom` is still open
  and active.
- `eslint.config.mjs` or `package.json` no longer match the "Current state"
  excerpts (drift).
- Typed linting cannot resolve `.svelte` files after the single documented
  parser addition in Step 2.4 AND the `.ts`-only fallback also fails — report
  the exact parser error. (Step 1 alone — linting the unit-test files with
  the untyped preset — is independently shippable; say so in the report.)
- Full-repo lint time exceeds ~3 minutes after enabling `projectService`
  (unacceptable for the husky pre-commit hook, which runs on every commit) —
  report the timing; do not ship a config that makes committing painful.
- A surfaced violation cannot be fixed mechanically — it reveals a genuine
  behavioral bug in `src/lib/**` whose fix would change component behavior.
  Flag it as a correctness finding; fixing it may exceed this plan's scope.
- Any Playwright spec that passed before your changes fails after them and
  the cause isn't the stale-server issue (port 4173 note above).

## Maintenance notes

- Once `projectService` is on, files newly created outside the tsconfig
  include (new root-level configs) will error under lint until added to
  `allowDefaultProject` — the error message names the file; the fix is a
  one-line glob addition.
- Reviewers should scrutinize: (1) every `void`-marked promise has a rationale
  and is genuinely safe to not await; (2) no preset rule was silently turned
  off repo-wide; (3) test files' override block stayed minimal.
- Deferred out of this plan: `eslint-plugin-unused-imports` is installed in
  devDependencies but never registered in `eslint.config.mjs` — either wire it
  or remove the dependency in a future hygiene pass; entangling it here would
  widen the diff.
- The husky pre-commit hook runs `trunk check --fix` on every commit; after
  this plan, that includes typed rules. If contributors report slow commits,
  the first lever is Trunk's changed-files scoping (already default), not
  weakening the config.
