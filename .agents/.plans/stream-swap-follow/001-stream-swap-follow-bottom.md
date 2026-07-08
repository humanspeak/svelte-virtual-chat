# Plan 001: Keep follow-bottom locked when a streamed message is replaced by its final document

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/stream-swap-follow/README.md`).
>
> **Drift check (run first)**:
> `git diff --stat f47c3f6..HEAD -- src/lib/SvelteVirtualChat.svelte src/lib/virtual-chat/chatMeasurement.svelte.ts tests/chat src/routes/tests/chat`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Revision 2026-07-08 (guard, operator-approved)**: The executed fix
> exceeded the original ~15-line `SvelteVirtualChat.svelte` budget (46 lines)
> and added a third, unplanned strategy — **in-place identity invalidation**
> (`messageShape`: a per-message `WeakMap` identity token + full-list
> content-version `$derived` threaded into `totalHeight`, `visibleRange`,
> `startOffset`, `renderedMessages`) — plus shrink→grow smooth _suppression_
> and de-reactified `#heights` (`$state({})`→`{}`). The operator reviewed and
> accepted this as-is: it delivers `Why this matters` with zero regressions
> across the full chromium + firefox/webkit spec net. The `~15-line` STOP and
> the "only snap-on-shrink" step-6 authorization below are hereby superseded
> for this plan (see amended STOP conditions and Strategy list). `Planned at`
> re-stamped so the drift check re-baselines against the amended intent.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the height cache and follow policy — both heavily
  spec-guarded, which is your safety net)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6b7fcc8`, 2026-07-08 (re-stamped by guard on
  amendment; originally `f47c3f6`, 2026-07-07)

## Why this matters

Consumer apps using this library commonly stream an assistant reply into a
placeholder message, then — when the reply is complete — **replace that
message with the final document from their reactive store** (e.g. a Convex
document with its own server-generated id). During that replacement the
viewport loses its lock on the bottom: the user, who was pinned watching the
stream, ends up stranded mid-conversation while content continues below. This
is the flagship usage pattern for the library (LLM chat with persistence),
and no existing fixture or spec covers _replacement_ at all — the streaming
fixture only mutates content on a constant message id.

## Current state

### The replacement pattern is untested

Repo fixtures live in `src/routes/tests/chat/<name>/+page.svelte`, specs in
`tests/chat/<name>.spec.ts`. The streaming fixture
(`src/routes/tests/chat/streaming/+page.svelte`) grows `msg.content` on a
fixed id. Nothing swaps a message object for a different-id object, removes
and re-adds a message, or re-renders a message with a different component.

### Suspected mechanism 1 — an id swap discards the measured height

`src/lib/virtual-chat/chatMeasurement.svelte.ts` — heights are cached by
message id. When the messages array has the same length but a different tail
id (the streamed temp-id message replaced by the final-id document), `sync()`
falls through the same-length check to a **full rebuild**, and the new id has
no cached height, so it enters at the estimate:

```ts
// chatMeasurement.svelte.ts:197-220 (sync)
        // Same-length no-op path — handles Svelte's `$state` proxy producing a
        // new reference for the same logical array. ...
        if (newN === oldN) {
            let allMatch = true
            for (let i = 0; i < newN; i++) {
                if (getMessageId(messages[i]) !== this.#orderedIds[i]) {
                    allMatch = false
                    break
                }
            }
            if (allMatch) { ... return }
        }

        // Full rebuild (splice/random reorder/length-shrink/etc).
        this.#rebuildOrdering(messages, getMessageId)
        this.#dirtyFromIndex = 0
```

```ts
// chatMeasurement.svelte.ts:175 (prefix sum uses estimate for unknown ids)
const h = this.#heights[id] ?? this.#estimatedHeight
```

So a 700px streamed message swapped for a new id makes `totalHeight` drop by
~628px (700 → 72 estimate) for at least one reactive tick, until the new
node's ResizeObserver-triggered re-measure lands. The old id's height is
orphaned in the cache forever (`ChatHeightCache.delete()` at
`chatMeasurement.svelte.ts:54` has **zero callers** in `src/lib`).

### Suspected mechanism 2 — the count effect is blind to same-length swaps

`src/lib/SvelteVirtualChat.svelte:812-822`:

```ts
// ── Follow-bottom on new messages ───────────────────────────────
$effect(() => {
    const count = messages.length
    // Ease only on a real message-count increase — not on the effect's
    // mount/settle re-fires, which would animate the initial positioning.
    const grew = previousMessageCount >= 0 && count > previousMessageCount
    previousMessageCount = count
    if (isFollowingBottom && viewportEl && !isUserScrollPreservationActive()) {
        layoutPreservation.begin()
        scheduleSnapToBottom({ smooth: grew })
    }
})
```

A same-length replacement never re-runs this effect (its only dependency that
changes is nothing — `messages.length` is unchanged). Follow-bottom defense
during the swap therefore rests entirely on the ResizeObserver path
(`handleLayoutHeightChange` → `snapToBottomPrePaint`) and on scroll-event
policy.

### Suspected mechanism 3 — two-tick replacement (remove, then add)

Reactive stores often deliver the swap as two updates: the streamed message
disappears (length N→N−1, large content shrink, browser clamps `scrollTop`),
then the final document arrives (N−1→N, `grew=true`, smooth-ease snap from a
clamped position). Each tick is turbulence; the combination is the closest
model of the reported real-world behavior.

### Follow policy background (do not re-derive; this is how it works today)

`src/lib/virtual-chat/chatScrollPolicy.ts` decides follow state per scroll
event. Key facts: unfollow requires accumulated _user-attributable upward
travel_ beyond `followBottomThresholdPx`; movement during layout turbulence
(`preservingLayout` && landing on a clamp boundary of 0/`maxScroll`) is not
attributed to the user; the at-bottom zone re-engages follow only on
non-upward arrivals (`movedUp` arg). Measured-height changes snap
synchronously pre-paint via `snapToBottomPrePaint`
(`src/lib/SvelteVirtualChat.svelte`, search for that symbol). Your fix must
not weaken any of this — the guarding specs are listed in the test plan.

### Fixture and spec conventions (match these exactly)

- Fixture exemplar: `src/routes/tests/chat/fill-in/+page.svelte` —
  deterministic fixed-height 24px blocks (no font/wrap variance), wrapper
  with inline `style="height: 480px;"` (do NOT use Tailwind arbitrary
  heights like `h-[480px]` in fixtures — the JIT scan has failed to pick
  them up in new fixture files before, silently unconstraining the layout),
  `data-testid` buttons, and a `data-testid="debug-stats"` line of
  `key=value` tokens.
- Post-paint sampling idiom (sampling AFTER the browser paints, via
  rAF → MessageChannel): see `src/routes/tests/chat/sweepMonitor.svelte.ts`
  (`afterPaint`) — copy the idiom, not the class; SweepMonitor itself drives
  sweeps, which is not what this fixture needs.
- Spec exemplar: `tests/chat/scroll-escape.spec.ts` — uses helpers from
  `tests/helpers.ts`: `waitForMount`, `waitForFollowing`, `waitForStat`,
  `getStats`, `getScrollState`, `isFollowing`, `SETTLE_MS`, `VIEWPORT`.
  Prefer condition-based waits (`waitForStat`, `expect.poll`) over
  `waitForTimeout` wherever a state _change_ is awaited; a fixed window is
  acceptable only when asserting the _absence_ of a change.
- Unit-test exemplar for the cache:
  `src/lib/virtual-chat/chatMeasurement.svelte.test.ts` (describe block
  "ChatHeightCache.sync (prefix sums)").

## Commands you will need

| Purpose           | Command                                                            | Expected on success   |
| ----------------- | ------------------------------------------------------------------ | --------------------- |
| Install           | `pnpm install`                                                     | exit 0                |
| Typecheck         | `pnpm run check`                                                   | `0 ERRORS 0 WARNINGS` |
| Unit tests        | `npx vitest run`                                                   | all pass              |
| One e2e spec      | `npx playwright test tests/chat/<name>.spec.ts --project=chromium` | see step text         |
| Full chromium e2e | `npx playwright test --project=chromium`                           | 0 failed              |
| Format            | `npx prettier --write <files>`                                     | exit 0                |

Notes:

- Playwright builds and serves the app itself (port 4173). **If every test
  suddenly fails with `waitForSelector` timeouts or 404s, a stale orphaned
  preview server is serving an old build — run
  `lsof -ti :4173 | xargs kill -9` and retry** before diagnosing anything.
- The pre-commit hook runs trunk + prettier + svelte-check; run prettier on
  touched files before committing to avoid churn.

## Scope

**In scope** (the only files you should create or modify):

- `src/routes/tests/chat/stream-swap/+page.svelte` (create — fixture)
- `tests/chat/stream-swap.spec.ts` (create — red spec)
- `src/lib/virtual-chat/chatMeasurement.svelte.ts` (fix, Strategy A)
- `src/lib/virtual-chat/chatMeasurement.svelte.test.ts` (unit tests for fix)
- `src/lib/SvelteVirtualChat.svelte` (ONLY if step 6's decision rules say so)
- `.agents/.plans/stream-swap-follow/README.md` (status update)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/virtual-chat/chatScrollPolicy.ts` and its tests — the follow
  policy was recently hardened across several releases; changing it here
  risks regressing wheel/keyboard/programmatic behavior covered by
  scroll-escape, follow-drop, scroll-away, and wheel-scroll-jump specs. If
  your diagnosis points there, that is a STOP condition, not an invitation.
- `src/routes/tests/chat/sweepMonitor.svelte.ts` — shared by other fixtures.
- All other fixtures and specs (they are the regression net proving you
  didn't break existing behavior).
- `docs/` — no docs changes in this plan.

## Git workflow

- Branch off `main`: `fix/stream-swap-follow-bottom`
- Conventional commits, matching repo style (from `git log`:
  `test(chat): add failing spec for ...`, `fix(chat): ...`). Commit the
  failing spec + fixture FIRST as its own `test(chat):` commit (repo
  convention — see `git log --oneline | grep "failing spec"`), then the fix
  as a `fix(chat):` commit.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the `stream-swap` fixture

Create `src/routes/tests/chat/stream-swap/+page.svelte`, modeled on
`src/routes/tests/chat/fill-in/+page.svelte` (copy its structure: block-based
messages of `BLOCK_PX = 24`, wrapper `style="height: 480px;"`,
`testId="chat"`, debug-stats line).

Content requirements:

- Seed ~25 fixed messages (id `"1"`..`"25"`, 4 blocks each) plus the scenario
  machinery below. Estimated height prop: `estimatedMessageHeight={72}`
  (default-like, deliberately far from the streamed message's final size).
- A `runScenario(variant)` function driven by a `variant` read from the URL
  (`$page.url.searchParams.get('variant')`, default `'new-id'`), started by a
  `data-testid="run-scenario"` button. The scenario:
    1. Append a streaming message `{ id: 'streaming-1', blocks: 1, kind: 'stream' }`.
    2. Grow it by 1 block every 40ms (setTimeout cadence — real streams arrive
       as tasks) until it reaches 20 blocks (~480px+header — taller than the
       viewport is the interesting case).
    3. Perform the swap per variant:
        - `same-id` (control): replace the last array element with a NEW object
          `{ id: 'streaming-1', blocks: 20, kind: 'final' }` (same id, new
          object, `kind` switches the rendered branch).
        - `new-id`: replace the last element with
          `{ id: 'convex-1', blocks: 20, kind: 'final' }` — different id, same
          final height. THIS mimics temp-id → server-id replacement.
        - `new-id-two-tick`: remove the last element (length N−1); then in a
          `setTimeout(..., 50)` append `{ id: 'convex-1', blocks: 20, kind: 'final' }`.
        - `new-id-regrow`: like `new-id` but the final message renders
          initially collapsed (`blocks: 3`) and expands to 20 blocks in a
          `setTimeout(..., 100)` after the swap — mimics the live component
          hydrating (query results, markdown, images).
    4. Keep a post-paint monitor running from scenario start until 800ms after
       the last mutation: an `afterPaint()` loop (copy the rAF→MessageChannel
       idiom from `sweepMonitor.svelte.ts`) that each painted frame records
       `gap = scrollHeight - clientHeight - scrollTop` of the viewport
       (`[data-testid="chat-viewport"]`); track `offBottomPaints` (frames with
       gap > 48), `maxGapPx`, then set `scenario=done`.
- Render `kind: 'stream'` and `kind: 'final'` through visibly different
  branches (e.g. different background classes) — the swap must actually
  destroy/recreate DOM the way a different component would.
- Debug-stats line must include (exact keys, they are the spec's API):
  `following=`, `scenario=` (`idle|running|done`), `offBottomPaints=`,
  `maxGapPx=`, `total=`.
- Important fixture detail: mutate via `messages[messages.length - 1] = ...`
  and `messages.pop()` / `messages.push(...)` on a `$state` array — in-place
  mutation is what reactive-store consumers do. Do not reassign the array.

**Verify**: `pnpm run check` → `0 ERRORS`. Then
`npx playwright test tests/chat/basic.spec.ts --project=chromium` → passes
(sanity that the app still builds and serves; the new route compiles as part
of the build).

### Step 2: Write the red spec

Create `tests/chat/stream-swap.spec.ts` modeled on
`tests/chat/scroll-escape.spec.ts`. One `test.describe('Stream-then-swap
keeps follow-bottom')` with a parameterized loop over the four variants:

```ts
for (const variant of ['same-id', 'new-id', 'new-id-two-tick', 'new-id-regrow'] as const) {
    test(`${variant}: viewport stays locked to the bottom through the swap`, async ({ page }) => {
        await page.goto(`/tests/chat/stream-swap?variant=${variant}`, {
            waitUntil: 'domcontentloaded'
        })
        await waitForMount(page)
        await waitForFollowing(page, true)

        await page.locator('[data-testid="run-scenario"]').click()
        await waitForStat(page, 'scenario', 'done', 20000)

        const stats = await getStats(page)
        // End state: still following, pinned.
        expect(stats['following']).toBe('true')
        const { gapFromBottom } = await getScrollState(page)
        expect(gapFromBottom).toBeLessThanOrEqual(2)
        // Paint quality: the user never saw the view sit meaningfully off
        // the bottom during streaming + swap.
        expect(Number(stats['maxGapPx'])).toBeLessThanOrEqual(48)
    })
}
```

**Verify (this is the RED gate)**:
`npx playwright test tests/chat/stream-swap.spec.ts --project=chromium` →
**at least one `new-id*` variant FAILS** and `same-id` PASSES. Record which
variants are red in the batch README's status row notes — that record drives
step 6's decision rules.

If ALL FOUR variants pass → STOP condition (see below).

Commit fixture + spec now: `test(chat): add failing spec for
stream-then-swap losing follow-bottom`.

### Step 3: Unit-test the height carry-over (red at unit level)

In `src/lib/virtual-chat/chatMeasurement.svelte.test.ts`, add to the
`ChatHeightCache.sync (prefix sums)` describe (match its existing style —
plain object messages, `(m) => m.id` for getMessageId):

1. `same-length id replacement at one position carries the measured height`:
   sync `[a,b,c]`, set heights (e.g. a=100, b=200, c=700), then sync
   `[a,b,d]` (same length, new tail id `d`, `c` gone) → expect
   `getTotalHeight()` to still be `1000` (d inherited c's 700), and
   `get('d')` to be `700`.
2. `replacement seeding does not overwrite an already-measured new id`:
   set a height for `d` first (e.g. 300), then sync `[a,b,c]→[a,b,d]` →
   total is `600` (d keeps its own 300).
3. `multi-position reorder does not invent carry-overs`: sync `[a,b,c]` with
   heights, then sync `[c,a,b]` (permutation, no ids vanished) → totals
   unchanged, no heights transferred anywhere.

**Verify**: `npx vitest run src/lib/virtual-chat/chatMeasurement.svelte.test.ts`
→ test 1 FAILS (currently d has no height → total drops to 300+estimate),
tests 2–3 pass or fail consistently with current behavior (record it).

### Step 4: Implement Strategy A — height carry-over on positional id replacement

In `chatMeasurement.svelte.ts`, inside `sync()`, in the **full rebuild**
branch only (the fall-through after the same-length allMatch check — excerpt
in "Current state"): before `#rebuildOrdering`, when `newN === oldN`, compute
the set of positions where the id changed. If **every changed position's old
id does not appear anywhere in the new id list** (i.e. those messages were
replaced, not moved), then for each changed position `i` where the new id has
no entry in `#heights` and the old id does: copy the old id's height to the
new id (`this.#heights[newId] = this.#heights[oldId]`) and delete the old
id's entry (this also finally gives `delete`-style cleanup a caller-side
purpose; you may inline the map operations rather than calling `delete()`,
which bumps the reactive version synchronously — prefer inlining plain map
mutation here and let the rebuild's existing dirty/flush handle the sums).
Guard rails:

- Only for `newN === oldN`. Length changes (append/prepend/splice) keep
  existing behavior byte-for-byte.
- Never overwrite a height the new id already has (unit test 2).
- If any changed position's old id still exists elsewhere in the new list,
  it's a reorder — do nothing (unit test 3).
- Keep it O(n): build a Set of new ids once.

Add a short doc comment on the mechanism: streamed-message → final-document
replacement is the motivating case; carrying the displaced measurement over
prevents a one-tick estimate re-entry that breaks follow-bottom (reference
the fixture path).

**Verify**: `npx vitest run` → ALL unit tests pass, including the three new
ones and every pre-existing `sync` test (append fast path, prepend fast
path, proxy no-op path — these prove you didn't disturb the hot paths).

### Step 5: Re-run the red spec

**Verify**: `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium`

Decision rules:

- `new-id` (and `same-id`) now green, everything green → proceed to step 7.
- `new-id-regrow` still red but `new-id` green → the late expansion path is
  the issue; re-check the fixture's regrow timing is realistic (100ms), then
  investigate with the write-tracer pattern (patch the viewport's
  `scrollTop` setter in a scratch spec via
  `Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')`, log
  writes with stacks — precedent exists in this repo's history) before
  touching component code. If the diagnosis lands anywhere outside
  `SvelteVirtualChat.svelte`'s snap/measurement wiring → STOP condition.
- `new-id-two-tick` still red → the shrink tick strands the viewport.
  Permitted fix surface: `src/lib/SvelteVirtualChat.svelte` count effect
  (excerpt in "Current state") — e.g. also snapping when count _decreases_
  while following is a legitimate, scoped change. Do NOT touch
  chatScrollPolicy.ts.
- Anything still red after one scoped fix attempt per variant → STOP.

### Step 6: (Conditional) apply the count-effect change for two-tick, if red

Only if step 5's rules directed you here. The change shape: in the count
effect, the current code already schedules a (non-smooth) snap whenever the
effect re-runs while following — verify with the tracer whether the effect
actually fires on shrink and whether the snap loses to a clamp; the minimal
fix is typically ordering/coalescing within existing mechanisms, not new
state. Keep the diff under ~15 lines; anything larger → STOP.

**Verify**: spec fully green, `npx vitest run` still green.

### Step 7: Full regression gate

**Verify, in order**:

1. `pnpm run check` → `0 ERRORS 0 WARNINGS`
2. `npx vitest run` → all pass
3. `npx playwright test --project=chromium` → 0 failed (kill stale :4173
   first if mass-failures appear — see Commands notes)
4. `npx playwright test tests/chat/stream-swap.spec.ts tests/chat/streaming.spec.ts tests/chat/fill-in-sawtooth.spec.ts tests/chat/margin-bubbles.spec.ts --project=firefox --project=webkit`
   → 0 failed

Commit the fix: `fix(chat): carry measured height across streamed-message
replacement so follow-bottom holds`.

## Test plan

- New e2e: `tests/chat/stream-swap.spec.ts` — 4 variant tests (listed in
  step 2), red-first, modeled on `tests/chat/scroll-escape.spec.ts`.
- New unit tests: 3 cases in `chatMeasurement.svelte.test.ts` (step 3),
  modeled on the existing `sync` describe.
- Regression net (must stay green, already exists): `streaming`,
  `fill-in-sawtooth`, `estimate-miss`, `margin-bubbles`, `scroll-escape`,
  `follow-drop`, `scroll-away`, `wheel-scroll-jump`, `late-table-growth`,
  `history`, `idle-snap-loop` specs; full chromium suite is the gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm run check` exits with 0 errors
- [ ] `npx vitest run` exits 0; the 3 new cache tests exist and pass
- [ ] `npx playwright test tests/chat/stream-swap.spec.ts --project=chromium`
      → 4/4 pass (minus documented skips, none expected)
- [ ] `npx playwright test --project=chromium` → 0 failed
- [ ] Step 7's firefox/webkit subset → 0 failed
- [ ] `git status` shows no modified files outside the Scope list
- [ ] Batch README status row updated with: which variants were red pre-fix,
      which strategy/strategies were applied

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows in-scope files changed since `f47c3f6` and the
  "Current state" excerpts no longer match.
- **All four spec variants pass before any fix** (step 2). The library then
  handles this pattern already and the reported bug lives in app-side
  integration. Report back requesting from the operator: whether the app's
  replacement changes the message id, whether it arrives as one or two store
  updates, whether the chat component (or an ancestor) is `{#key}`-ed on
  something that changes at completion, and whether the app wraps the
  viewport in its own scroll container.
- Fixing `new-id-regrow` or `new-id-two-tick` appears to require modifying
  `chatScrollPolicy.ts` or its tests.
- ~~A conditional fix (steps 5–6) exceeds ~15 changed lines in
  `SvelteVirtualChat.svelte`~~, or any variant remains red after one scoped
  attempt. **(Superseded 2026-07-08, operator-approved: the accepted fix is
  46 lines in `SvelteVirtualChat.svelte`, adding the `messageShape` in-place
  identity-invalidation strategy. The line budget no longer applies to this
  plan; the "any variant remains red after one scoped attempt" clause still
  stands.)**
- Any pre-existing spec in the full chromium run turns red and the cause
  isn't the stale-server issue described in Commands notes.

## Maintenance notes

- The carry-over rule in `sync()` couples message identity to position for
  the replacement case. If a future feature introduces legitimate
  same-length id churn that is NOT replacement (e.g. pagination windows that
  slide), revisit the "old id absent from new list" guard — it is the load-
  bearing disambiguator.
- Reviewers should scrutinize: (1) the append/prepend fast paths in `sync()`
  are untouched (hot paths); (2) no reactive version bump was added on the
  carry-over write (it must ride the rebuild's existing dirty/flush);
  (3) the fixture's in-place mutation style (`messages[i] = ...`) was
  preserved — converting it to array reassignment would silently stop
  testing the reactive-store consumer pattern.
- Deferred out of this plan: pruning orphaned heights for ids that leave the
  list without replacement (unbounded-session memory growth) — separate,
  lower-priority concern; and a docs-site guide section on the
  "stream-then-persist" integration pattern once the behavior is fixed.
