# Plan 002: Decide whether CSS scroll anchoring can give follow-bottom a pre-paint guarantee, and land it if it can

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/stream-swap-follow/README.md`).
>
> **This plan has a decision gate (step 3).** Steps 1–3 are investigation and
> are always executed. Steps 4–7 are implementation and run ONLY if step 3's
> gate passes. If the gate fails, you write up the result and stop — that is a
> successful outcome for this plan, not a failure.
>
> **Drift check (run first)**:
> `git diff --stat be915fa..HEAD -- src/lib/SvelteVirtualChat.svelte src/lib/virtual-chat/ tests/chat/ src/routes/tests/chat/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (touches the scroll container's layout contract; the follow
  policy and virtualization transform are both heavily spec-guarded)
- **Depends on**: 001 (DONE — its height carry-over and `messageShape`
  invalidation are assumed present)
- **Category**: bug
- **Planned at**: commit `be915fa`, 2026-07-09

## Why this matters

Plan 001 fixed the message-identity half of stream-then-swap, and its spec went
green. The bug did not go away. `tests/chat/stream-swap.spec.ts`'s
`new-id-regrow` variant still fails roughly **5% of runs in chromium** — it
passed 001's gate only because that gate ran each variant exactly once per
browser. Consumers report it as a Firefox problem; it is not Firefox-specific,
Firefox just loses the underlying race more often under heavier layout.

The defect is structural. The component guarantees follow-bottom by writing
`scrollTop` from a ResizeObserver callback, on the documented assumption that
"RO callbacks run after layout and before paint" (`snapToBottomPrePaint`,
`src/lib/SvelteVirtualChat.svelte:830`). That assumption holds on most frames
and breaks on some: a DOM mutation can land after both the rAF phase _and_ the
observer step, and the browser still paints the new layout in that frame. When
it breaks, the viewport paints off-bottom by exactly the displaced height.

**No JS-side hook can close this.** That was measured, not assumed — see
"Evidence already gathered". The only mechanism that runs inside layout, before
paint, is the browser's own CSS scroll anchoring, which the component currently
switches off (`overflow-anchor: none`,
`src/lib/SvelteVirtualChat.svelte:1055`). This plan determines whether that
switch can be flipped, and flips it if so.

## Evidence already gathered

All of the following was **measured on commit `be915fa`**. Do not re-derive it;
do re-run anything you want to confirm.

1. **The bug reproduces in chromium**, on the committed fixture and spec, with
   no modifications:

    ```bash
    npx playwright test tests/chat/stream-swap.spec.ts --project=chromium \
        --repeat-each=25 -g "new-id-regrow"
    # → 1 failed, 49 passed   (rate is ~5%; it is a race, so your count will vary)
    ```

2. **The failing timeline** (captured post-paint; `sh` = scrollHeight,
   `st` = scrollTop, gap = `sh - clientHeight - st`):

    ```text
    +315ms remeasure  convex-1=113           ← swap: streamed msg replaced by collapsed final doc
    +315ms prePaint   st=2670 sh=3142        ← RO fires; scrollHeight still STALE (spacer not resized)
    +316ms painted    gap=0 sh=2758 st=2286  ← spacer shrinks; browser CLAMPS scrollTop 2670→2286
    +416ms painted    gap=408 sh=3166 st=2286 ← regrow PAINTS; no rAF and no RO ran first
    +434ms remeasure  convex-1=521           ← RO arrives a frame late
    +434ms write      v=2694                 ← snap corrects; user already saw the jump
    ```

    Note the gap (408px) equals the displaced height exactly
    (`521 − 113 = 408`). This was confirmed across five different block
    heights; it is arithmetic, not coincidence.

3. **A rAF-based re-pin was attempted and reverted.** Opening a short rAF
   window after any measured shrink (rAF runs _before_ the observer step) cut
   the failure rate from ~1-in-4 to ~1-in-22 but did **not** eliminate it: the
   trace showed the rAF write also landing a frame late, because the mutation
   landed after the rAF phase too. Do not re-attempt this; a probability
   reduction that leaves the bug intact is worse than none, because it makes
   the residual failure much harder to find. **If your diagnosis leads you back
   to a JS-timing hook, that is a STOP condition.**

4. **`CSS.supports('overflow-anchor', 'auto')` returns `true` in chromium,
   firefox, AND webkit.** It is therefore **useless as a feature detect** — it
   only reports that the property parses. Any feature detection in this plan
   must be _behavioral_.

5. **Scroll anchoring itself works in all three engines**, including webkit.
   A minimal scroller — plain in-flow growing block, 1px sentinel after it,
   `overflow-anchor: none` on the growing block, `auto` on the sentinel, growth
   driven from a `setTimeout` task — produced, in chromium, firefox and webkit
   alike:

    ```text
    before={"st":301,"gap":0}  afterOneFrame={"st":601,"gap":0}  settled={"st":601,"gap":0}
    ```

    `scrollTop` self-corrected by exactly the +300px growth, and the gap was
    **0 on the first post-paint frame**. This is the pre-paint guarantee the
    component needs. A fallback path for webkit is therefore **not** required.

6. **The catch that step 2 exists to resolve.** Finding 5 used a plain in-flow
   block. This component does not lay out that way. Messages live in an
   **absolutely-positioned, `translateY`-transformed** container inside a
   **JS-height-driven spacer** (excerpts below). When a message grows:
    - the spacer's height does not change (it is `totalHeight`, from the height
      cache, which only updates on the late RO), and
    - anything in flow _after_ the spacer therefore does not move.

    A sentinel placed after the spacer would consequently **never move**, and
    scroll anchoring would have nothing to compensate for. The sentinel must go
    **inside `itemsEl`, after the last message**, so growth actually displaces
    it. Whether an anchor node inside an absolutely-positioned, transformed
    subtree is still selected and compensated is **unverified in every engine**
    and is exactly what step 2 measures.

    (Related, and worth knowing: `scrollHeight` here is
    `max(spacer height, absolutely-positioned overflow)`. That is why the trace
    at `+416ms` shows `sh=3166` while the spacer was still `2758`.)

## Current state

Files that matter, and their role:

- `src/lib/SvelteVirtualChat.svelte` — the component. Scroll container markup,
  the snap machinery, and the ResizeObserver wiring all live here.
- `src/lib/virtual-chat/chatMeasurement.svelte.ts` — height cache (prefix
  sums) + `collectPitchChanges`, the offset-delta measurement the RO drives.
- `src/lib/virtual-chat/chatScrollPolicy.ts` — per-scroll-event follow
  decision. **Hardened across several releases. Out of scope (see Scope).**
- `src/lib/virtual-chat/chatAnchoring.ts` — scroll-anchor capture/restore for
  **history prepend** (JS, not CSS). `captureScrollAnchor` / `restoreScrollAnchor`.
- `src/lib/virtual-chat/chatVisualAnchoring.ts` — `captureVisualAnchor` /
  `restoreVisualAnchor`, used when the user is scrolled away and content grows.
- `tests/chat/regrow-trace.debug.ts` — **untracked** loop-until-failure tracer
  that produced the timeline in "Evidence" above. Deliberately named `.debug.ts`
  so Playwright's `testMatch` does not collect it. If it is absent from your
  working tree, ignore it; it is a convenience, not a gate.

### The scroll container opts out of anchoring

`src/lib/SvelteVirtualChat.svelte:1048-1058`:

```svelte
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        bind:this={viewportEl}
        class={viewportClass}
        onscroll={handleScroll}
        use:handleViewportKeyboard
        use:trackViewportScrollIntent
        style="overflow-y: auto; overflow-anchor: none; flex: 1 1 0%; min-height: 0;"
        data-testid={testId ? `${testId}-viewport` : undefined}
        role="region"
        aria-label={viewportLabel}
        tabindex="0"
    >
```

### The geometry that complicates the sentinel

`src/lib/SvelteVirtualChat.svelte:1062-1090`:

```svelte
        <div
            bind:this={contentEl}
            style="min-height: 100%; position: relative; width: 100%; display: flex; flex-direction: column; justify-content: flex-end;"
            data-testid={testId ? `${testId}-content` : undefined}
        >
            {#if header}...{/if}
            <div style="height: {totalHeight}px; position: relative; flex-shrink: 0;">
                <div
                    bind:this={itemsEl}
                    style="position: absolute; top: 0; left: 0; right: 0; transform: translateY({startOffset}px);"
                >
                    {#each renderedMessages as message, i (getMessageId(message))}
                        {@const globalIndex = visibleRange.start + i}
                        <div
                            use:measureMessage
                            data-testid={testId ? `${testId}-item-${globalIndex}` : undefined}
                            data-message-id={getMessageId(message)}
                        >
                            {@render renderMessage(message, globalIndex)}
                        </div>
                    {/each}
                </div>
            </div>
```

Note `justify-content: flex-end` + `min-height: 100%` on `contentEl` — that is
the bottom-gravity behavior for short conversations. A sentinel must not
disturb it.

### The assumption this plan attacks

`src/lib/SvelteVirtualChat.svelte:820-838`:

```ts
/**
 * Pre-paint correction for ResizeObserver contexts (height changes,
 * viewport resizes): RO callbacks run after layout and before paint, so a
 * synchronous snap pins the bottom in the same frame the content changed —
 * deferring to a rAF paints one frame off-bottom per growth step (#42).
 * ...
 */
const snapToBottomPrePaint = () => {
    layoutPreservation.begin()
    if (!(isAnimatingToBottom || pendingSmoothSnap)) {
        snapToBottom()
    }
    scheduleSnapToBottom()
}
```

The comment's premise ("RO callbacks run after layout and before paint") is
what the evidence disproves for _some_ frames.

### Conventions to match

- **Fixtures**: `src/routes/tests/chat/<name>/+page.svelte`. Exemplar:
  `src/routes/tests/chat/stream-swap/+page.svelte`. Deterministic fixed-height
  blocks; wrapper with **inline** `style="height: 480px;"` (do NOT use Tailwind
  arbitrary heights like `h-[480px]` in fixtures — the JIT scan has silently
  failed to pick them up in new fixture files before); `data-testid` buttons;
  a `data-testid="debug-stats"` line of `key=value` tokens.
- **Post-paint sampling** (sample AFTER the browser paints, via
  rAF → MessageChannel): copy the `afterPaint` idiom from
  `src/routes/tests/chat/stream-swap/+page.svelte`. A plain `requestAnimationFrame`
  samples _before_ the observer step and will lie to you.
- **Specs**: `tests/chat/<name>.spec.ts`, helpers from `tests/helpers.ts`
  (`waitForMount`, `waitForFollowing`, `waitForStat`, `getStats`,
  `getScrollState`, `isFollowing`, `SETTLE_MS`, `VIEWPORT`). Exemplar:
  `tests/chat/stream-swap.spec.ts`. Prefer condition-based waits
  (`waitForStat`, `expect.poll`) over `waitForTimeout`; a fixed window is
  acceptable only when asserting the _absence_ of a change.
- Commit style: conventional commits, matching `git log`
  (`test(chat): ...`, `fix(chat): ...`, `chore(plan): ...`).

## Commands you will need

| Purpose            | Command                                                                                                     | Expected on success   |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------- |
| Install            | `pnpm install`                                                                                              | exit 0                |
| Typecheck          | `pnpm run check`                                                                                            | `0 ERRORS 0 WARNINGS` |
| Unit tests         | `npx vitest run`                                                                                            | all pass              |
| One e2e spec       | `npx playwright test tests/chat/<name>.spec.ts --project=chromium`                                          | see step text         |
| Stress one variant | `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"` | see step text         |
| Full chromium e2e  | `npx playwright test --project=chromium`                                                                    | 0 failed              |
| Cross-engine       | `npx playwright test --project=firefox --project=webkit`                                                    | 0 failed              |

Notes:

- Playwright builds and serves the app itself (port 4173). **If every test
  suddenly fails with `waitForSelector` timeouts or 404s, a stale orphaned
  preview server is serving an old build — run `lsof -ti :4173 | xargs kill -9`
  and retry** before diagnosing anything.
- The pre-commit hook runs trunk + prettier + svelte-check; run prettier on
  touched files before committing to avoid churn.
- This bug is a **race**. A single green run proves nothing. Every gate in this
  plan that concerns it is expressed as a repeat count, on purpose. Never
  downgrade a `--repeat-each` gate to a single run.

## Scope

**In scope** (the only files you may create or modify):

- `tests/chat/anchor-probe.spec.ts` (create — step 2 geometry probe; may be
  deleted again in step 7 if the gate fails)
- `tests/chat/stream-swap.spec.ts` (modify — stress sampling, step 1)
- `src/lib/SvelteVirtualChat.svelte` (modify — steps 4–5, ONLY if the step 3
  gate passes)
- `src/routes/tests/chat/stream-swap/+page.svelte` (modify — ONLY if step 6
  requires a new debug-stats key)
- `.agents/.plans/stream-swap-follow/README.md` (status update)
- `.agents/.plans/stream-swap-follow/002-findings.md` (create — step 3 writeup)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/virtual-chat/chatScrollPolicy.ts` and its tests — hardened across
  several releases; guarded by the scroll-escape, follow-drop, scroll-away and
  wheel-scroll-jump specs. If your diagnosis points there, that is a STOP
  condition, not an invitation.
- `src/lib/virtual-chat/chatMeasurement.svelte.ts` — plan 001 just changed it.
  Scroll anchoring is meant to make the height cache's _timing_ irrelevant, not
  to change the cache.
- `src/lib/virtual-chat/chatAnchoring.ts`, `chatVisualAnchoring.ts` — read them
  (step 5 must reason about them), do not modify them.
- All other fixtures and specs — they are the regression net.
- `docs/` — no docs changes in this plan.

## Git workflow

- Branch off the current branch: `fix/overflow-anchor-follow-bottom`
- Conventional commits. Commit the stress-sampling change (step 1) first as its
  own `test(chat):` commit, the probe + findings as `chore(plan):`, and any
  implementation as `fix(chat):`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the race visible in CI before changing anything

The committed spec runs `new-id-regrow` once per browser. That is how a ~5%
failure survived plan 001's gate. Fix the _gate_ first, so that whatever you do
next is measured against a test that can actually see the bug.

In `tests/chat/stream-swap.spec.ts`, add a dedicated stress test (keep the
existing four single-run variant tests exactly as they are — they are cheap and
they cover the other three variants):

- Name it so it is obvious why it repeats, e.g.
  `new-id-regrow: stays bottom-locked across repeated swaps (stress)`.
- Run the regrow scenario **at least 12 times in one page**, clicking
  `[data-testid="run-scenario"]` and awaiting `waitForStat(page, 'scenario', 'done', 20000)`
  each time. The fixture already supports reruns (see the existing
  `new-id reruns append distinct final messages` test), and each run appends a
  fresh `convex-N` message.
- After **every** run, assert `Number(stats['maxGapPx']) <= 48`. Do not only
  assert at the end — `maxGapPx` is reset per run by the fixture, so a
  post-loop-only assertion would test only the final iteration.
- Give the test a raised timeout (`test.setTimeout(120000)`); each run takes
  ~2.5s.

**Verify (this is the RED gate)**:

```bash
npx playwright test tests/chat/stream-swap.spec.ts -g "stress" --project=chromium --repeat-each=3
```

→ **at least one of the 3 runs FAILS** on the `maxGapPx` assertion, reporting a
gap in the hundreds of px (expect ~408 at the fixture's default geometry).

If all 3 runs pass, raise the in-page repeat count to 25 and try once more. If
it still passes → STOP condition (see below): the race may have been perturbed
by an environment change, and proceeding would mean building on a gate that
cannot see the bug.

Commit: `test(chat): stress-sample new-id-regrow so the follow-bottom race is visible`.

### Step 2: Probe whether scroll anchoring survives this component's geometry

This is the load-bearing unknown, and it is cheap to answer in isolation.
Create `tests/chat/anchor-probe.spec.ts`. It must **not** load the component —
it builds the geometry by hand with `page.setContent`, so a negative result
indicts the geometry rather than the library.

Build **three** scrollers and measure each in chromium, firefox and webkit:

- **A — control (known good)**: in-flow growing block, then a 1px sentinel.
  `overflow-anchor: none` on the growing block, `auto` on the sentinel. This is
  the shape already proven to work; if A fails, your environment is wrong.
- **B — spacer only**: a JS-height-driven spacer wrapping an
  `position: absolute` items container, sentinel **after the spacer, in flow**.
  This models the naive sentinel placement.
- **C — sentinel inside the transformed subtree**: same as B, but the sentinel
  is the **last child of the absolutely-positioned, `translateY(...)`-transformed
  items container**, after the growing "message". This models the placement the
  real fix needs.

For each: scroll to bottom, wait a post-paint frame, then grow the content
**from a `setTimeout` task** (not from rAF — the timer is what races the
hooks), then sample `scrollTop` and `gap = scrollHeight - clientHeight - scrollTop`
on the **first post-paint frame** using the rAF → MessageChannel idiom, and
again after two more frames.

Log one line per (project, scroller): `PROBE <project> <A|B|C> firstFrameGap=<n> settledGap=<n>`.

**Verify**: `npx playwright test tests/chat/anchor-probe.spec.ts --project=chromium --project=firefox --project=webkit`
→ passes (it asserts nothing yet; you are reading the log lines).

Record all nine lines verbatim. Expected, based on the evidence above: **A
firstFrameGap=0 everywhere.** B and C are genuinely unknown.

### Step 3: The decision gate

Write `.agents/.plans/stream-swap-follow/002-findings.md` containing: the nine
probe lines from step 2, the step-1 red-gate output, and your verdict.

Then gate on scroller **C**:

- **C's `firstFrameGap` is 0 in chromium, firefox AND webkit** → the approach
  is viable. Proceed to step 4.
- **C's `firstFrameGap` is 0 in some engines but not all** → partial viability.
  **STOP and report.** Per-engine divergence in the scroll container's layout
  contract is an operator decision, not an executor one. Include in your report
  which engines pinned and which did not.
- **C's `firstFrameGap` is nonzero everywhere** → anchoring cannot see growth
  inside a transformed abspos subtree. The approach as specified is dead.
  **STOP and report.** In your writeup, note the one alternative worth costing
  (do NOT implement it): removing the abspos/transform virtualization for the
  **last** message only, so the tail of the list is in normal flow and a
  sentinel after it moves with growth. That is a much larger change and needs
  its own plan.

In all three cases, commit the findings file:
`chore(plan): record overflow-anchor probe results for plan 002`.

**Only continue past this point if the gate passed outright.**

### Step 4: Introduce the sentinel and scope anchoring to it

In `src/lib/SvelteVirtualChat.svelte`:

1. Change the viewport's inline style from `overflow-anchor: none` to
   `overflow-anchor: auto` (line ~1055). This re-enables anchoring for the
   scroll container.
2. Add `overflow-anchor: none` to the **per-message wrapper** div (the one with
   `use:measureMessage`). This excludes messages and their subtrees from anchor
   selection, so the browser cannot pick a message as the anchor.
3. Add a sentinel as the **last child of `itemsEl`**, after the `{#each}`:
   a zero-or-1px element with `overflow-anchor: auto`, `aria-hidden="true"`,
   and the same `data-testid` pattern used elsewhere, ending in `-anchor`. It
   must not affect layout: no margin, no min-height beyond 1px.
4. Leave the header/footer wrappers alone, but give them `overflow-anchor: none`
   too — a visible header must never win anchor selection.

The intent, stated for the reviewer: the browser selects the sentinel as the
anchor whenever it is in view (i.e. whenever we are at/near the bottom), and
compensates `scrollTop` for any growth above it, inside layout, before paint.
When the user scrolls away the sentinel leaves the viewport, no anchor is
selected, and anchoring goes inert — which is the behavior the existing JS
anchoring paths already assume.

**Verify**:

1. `pnpm run check` → `0 ERRORS 0 WARNINGS`
2. `npx playwright test tests/chat/stream-swap.spec.ts -g "stress" --project=chromium --repeat-each=3`
   → **0 failed** (the step-1 red gate is now green)
3. `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"`
   → **0 failed**

If (2) or (3) still fails, the sentinel is not being selected as the anchor.
Before changing anything else, confirm selection empirically: in a scratch
`page.evaluate`, grow the last message and check whether `scrollTop` moved
without any JS write (patch the `scrollTop` setter as
`tests/chat/regrow-trace.debug.ts` does). One scoped fix attempt is allowed
(most likely cause: a message wrapper or the spacer still eligible for
selection). If it remains red after that → STOP.

### Step 5: Reconcile with the existing JS anchoring paths

Anchoring is now live for this scroll container, which means the browser may
also compensate during operations that the component already compensates for in
JS. Two collision sites, both of which you must reason about explicitly and
record in the PR description:

- **History prepend** (`chatAnchoring.ts`, `captureScrollAnchor` /
  `restoreScrollAnchor`): content is inserted **above** the viewport. If the
  sentinel is off-screen (the normal case when scrolled up to trigger
  `onNeedHistory`), no anchor is selected and the browser does nothing — JS
  keeps full control. The dangerous case is a **short conversation where the
  sentinel is still visible** while a prepend lands.
- **Growth while scrolled away** (`chatVisualAnchoring.ts`, `restoreAnchorPrePaint`):
  same reasoning — the sentinel is off-screen, so anchoring is inert.

Do **not** pre-emptively add code for these. Instead prove the behavior with
the existing regression net, which already covers both:

**Verify**:

1. `npx playwright test tests/chat/history.spec.ts --project=chromium --repeat-each=5` → 0 failed
2. `npx playwright test tests/chat/scroll-escape.spec.ts tests/chat/follow-drop.spec.ts tests/chat/scroll-away.spec.ts tests/chat/wheel-scroll-jump.spec.ts --project=chromium --repeat-each=3` → 0 failed
3. `npx vitest run` → all pass

If the history spec goes red, the short-conversation collision above is real.
Permitted fix surface: toggle the sentinel's `overflow-anchor` to `none` while
a prepend/anchor restore is in flight (the component already tracks this —
see `pendingAnchor` and `layoutPreservation`). Keep that change under ~10
lines. Do NOT touch `chatAnchoring.ts` or `chatScrollPolicy.ts`.

### Step 6: Confirm the streaming path improved, not just the regrow path

The same one-frame lag affects ordinary streaming — the pre-fix trace shows
every streaming tick painting `gap=24` (one block) before the snap lands. It
was invisible only because 24px is under the fixture's 48px threshold. Scroll
anchoring should drive it to 0.

Read `maxGapPx` from the fixture's debug-stats after a plain streaming run
(`tests/chat/streaming.spec.ts`'s fixture, or `stream-swap?variant=same-id`).
Record the value before and after your change in the findings file. A drop from
~24 to ~0 is strong confirmation the mechanism is doing what this plan claims;
**if `maxGapPx` stays at ~24, the sentinel is not actually anchoring and step
4's green result came from timing luck** → STOP and report.

**Verify**: `npx playwright test tests/chat/streaming.spec.ts --project=chromium --repeat-each=3` → 0 failed, and the recorded `maxGapPx` dropped.

### Step 7: Full regression gate

**Verify, in order** (kill a stale :4173 first if mass-failures appear):

1. `pnpm run check` → `0 ERRORS 0 WARNINGS`
2. `npx vitest run` → all pass
3. `npx playwright test --project=chromium` → 0 failed
4. `npx playwright test --project=firefox --project=webkit` → 0 failed
5. `npx playwright test --project=mobile-chrome --project=mobile-safari` → 0 failed
6. `npx playwright test tests/chat/stream-swap.spec.ts -g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3` → 0 failed

Then decide the fate of `tests/chat/anchor-probe.spec.ts`: keep it (it is a
fast, meaningful cross-engine guard that the platform behavior this fix depends
on still holds) but convert its logging into assertions — `firstFrameGap` must
be 0 for scroller C in every project. A future browser regression in scroll
anchoring would otherwise silently reintroduce this bug.

Commit: `fix(chat): pin follow-bottom with CSS scroll anchoring instead of a post-hoc scrollTop write`.

## The open question this plan must not assume away

The reproduced defect is a **transient**: the viewport paints off-bottom for one
frame and then self-heals (`following=true`, `finalGap=0` at the end of every
failing run). The originally reported real-world Firefox symptom is a viewport
that appears **persistently stranded**.

**These may be two different bugs.** Nothing in this session established that
fixing the transient fixes the strand.

Therefore, as part of step 3's findings file, record explicitly:

- whether any failing run you observed ended with `following=false` or
  `finalGap > 2` (i.e. a genuine strand rather than a transient), and
- if none did, state plainly that this plan fixes the transient and that the
  persistent strand remains **unreproduced and unexplained**.

Do not close out the reported Firefox issue on the strength of this plan alone.
If the operator can supply a trace from the real application (the tracer at
`tests/chat/regrow-trace.debug.ts` is adaptable — it patches the `scrollTop`
setter and samples post-paint), that is the fastest path to settling it.

## Test plan

- **Modified e2e**: `tests/chat/stream-swap.spec.ts` — add one stress test
  (step 1) that runs the regrow scenario ≥12 times in-page and asserts
  `maxGapPx <= 48` after each. Model on the existing
  `new-id reruns append distinct final messages` test, which already reruns the
  scenario.
- **New e2e**: `tests/chat/anchor-probe.spec.ts` — three hand-built scrollers
  (A control, B spacer-only, C sentinel-in-transformed-subtree) × three
  engines. Logging-only in step 2; asserting `firstFrameGap === 0` for C by
  step 7.
- **Unit tests**: none expected. This plan changes layout contract, not
  measurement logic. **If you find yourself adding a unit test to
  `chatMeasurement.svelte.test.ts`, you have drifted out of scope** — stop and
  re-read the Scope section.
- **Regression net** (must stay green, already exists): `streaming`,
  `fill-in-sawtooth`, `estimate-miss`, `margin-bubbles`, `scroll-escape`,
  `follow-drop`, `scroll-away`, `wheel-scroll-jump`, `late-table-growth`,
  `history`, `idle-snap-loop`. The full chromium suite plus the
  firefox/webkit/mobile projects is the gate (step 7).

## Done criteria

Machine-checkable. ALL must hold.

If the step-3 gate **failed** (approach not viable) — this is a legitimate,
complete outcome:

- [ ] `.agents/.plans/stream-swap-follow/002-findings.md` exists and contains
      all nine probe lines from step 2 plus the verdict
- [ ] `tests/chat/stream-swap.spec.ts` stress test from step 1 is committed and
      is RED (documented as a known-failing gate in the findings file)
- [ ] `git status` shows no modified files outside the Scope list
- [ ] Batch README status row updated to `BLOCKED` with the one-line reason

If the step-3 gate **passed**:

- [ ] `pnpm run check` exits with `0 ERRORS 0 WARNINGS`
- [ ] `npx vitest run` exits 0
- [ ] `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium --repeat-each=25 -g "new-id-regrow"` → 0 failed
- [ ] `npx playwright test tests/chat/stream-swap.spec.ts -g "stress" --project=chromium --project=firefox --project=webkit --repeat-each=3` → 0 failed
- [ ] `npx playwright test --project=chromium` → 0 failed
- [ ] `npx playwright test --project=firefox --project=webkit --project=mobile-chrome --project=mobile-safari` → 0 failed
- [ ] `grep -n "overflow-anchor: none" src/lib/SvelteVirtualChat.svelte` shows it
      on the message wrappers and header/footer, and **not** on the viewport
- [ ] `tests/chat/anchor-probe.spec.ts` asserts `firstFrameGap === 0` for
      scroller C and passes in all three engines
- [ ] `002-findings.md` records the streaming `maxGapPx` before/after (step 6)
      and answers the open question above
- [ ] `git status` shows no modified files outside the Scope list
- [ ] Batch README status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows in-scope files changed since `be915fa` and the "Current
  state" excerpts no longer match.
- **Step 1's stress test passes** at an in-page repeat count of 25 in chromium.
  The race is not visible in your environment; building a fix against a blind
  gate is worse than not fixing it.
- **Step 2's scroller A** shows a nonzero `firstFrameGap` in any engine. A is
  the known-good control; a red A means the probe itself is wrong, not the
  browser.
- **Step 3's gate is anything other than "C pins in all three engines"** —
  including the partial case. Report which engines pinned.
- Your diagnosis leads back to a JS-timing hook (rAF, ResizeObserver,
  MutationObserver, `queueMicrotask`, `setTimeout`) as the mechanism that pins
  the bottom. That path was measured and rejected — see "Evidence" item 3.
- Fixing anything here appears to require modifying `chatScrollPolicy.ts`,
  `chatAnchoring.ts`, `chatVisualAnchoring.ts`, or
  `chatMeasurement.svelte.ts`.
- Any pre-existing spec in the full chromium run turns red and the cause isn't
  the stale-server issue described in Commands notes.
- Step 5's history spec stays red after one scoped (~10 line) fix attempt.

## Maintenance notes

- **The load-bearing invariant is anchor selection.** The whole fix rests on the
  browser choosing the sentinel — and nothing else — as the anchor node. Any
  future change that adds a DOM node inside the viewport without
  `overflow-anchor: none` can silently steal selection and reintroduce the bug
  with no test failure except the stress test. Reviewers: check every new
  element inside the viewport for an explicit `overflow-anchor`.
- The virtualization transform (`translateY(startOffset)`) moves the sentinel on
  every range change. If step 2's scroller C passes, that is evidence the
  browser tolerates it — but a future change to how `startOffset` is applied
  (e.g. switching from `transform` to `top`) invalidates that evidence and
  requires re-running `anchor-probe.spec.ts`.
- `scrollHeight` on this viewport is `max(spacer height, abspos overflow)`, not
  the spacer height. Anything that reasons about `scrollHeight` must account for
  the spacer lagging the real content by one RO delivery.
- `CSS.supports('overflow-anchor', 'auto')` is `true` even where anchoring may
  not behave as expected. Never use it as a feature detect; use
  `anchor-probe.spec.ts`-style behavioral verification.
- Playwright's `webkit` is not Safari. If the operator ships to Safari, the
  probe's webkit result is suggestive, not conclusive — worth one manual check
  on a real Safari before release.
- Deferred out of this plan: the persistent-strand symptom (see "The open
  question"); and pruning orphaned height-cache entries for ids that leave the
  list without replacement (carried over from plan 001, still unaddressed).
