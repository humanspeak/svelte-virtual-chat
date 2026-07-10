# Plan 002 Findings

## Step 1: Red Gate

Command:

```bash
npx playwright test tests/chat/stream-swap.spec.ts -g "stress" --project=chromium --repeat-each=3
```

Observed on 2026-07-09:

```text
2 failed
1 passed
```

Failures:

```text
run 4 maxGapPx
Expected: <= 48
Received:    408

run 10 maxGapPx
Expected: <= 48
Received:    408
```

This confirms the committed stress test can see the transient follow-bottom
race before the CSS anchoring change.

## Step 2: Overflow-Anchor Probe

Command:

```bash
npx playwright test tests/chat/anchor-probe.spec.ts --project=chromium --project=firefox --project=webkit
```

Observed on 2026-07-09 with the corrected no-border probe. The probe uses a
large nonzero `translateY(3000px)` on the absolute items container to match the
real bottom-of-list virtualized geometry:

```text
PROBE chromium A firstFrameGap=0 settledGap=0
PROBE chromium B firstFrameGap=299 settledGap=299
PROBE chromium C firstFrameGap=0 settledGap=0
PROBE firefox A firstFrameGap=0 settledGap=0
PROBE firefox B firstFrameGap=299 settledGap=299
PROBE firefox C firstFrameGap=0 settledGap=0
PROBE webkit A firstFrameGap=0 settledGap=0
PROBE webkit B firstFrameGap=299 settledGap=299
PROBE webkit C firstFrameGap=0 settledGap=0
```

Scroller A is the plain in-flow control and pinned in all three engines.
Scroller B keeps the sentinel after the JS-height spacer and did not pin in any
engine. Scroller C puts the sentinel inside the absolutely-positioned,
transformed items subtree and pinned in all three engines.

## Step 3 Verdict

The approach is viable. Scroller C's `firstFrameGap` is 0 in chromium, firefox,
and webkit, so the browser can compensate growth above a bottom sentinel inside
the component's transformed virtualized subtree.

Proceed to step 4: enable `overflow-anchor` on the viewport, exclude normal
content from anchor selection, and add a bottom sentinel inside `itemsEl`.

## Persistent-Strand Question

The red-gate failures observed here reported transient painted gaps
(`maxGapPx=408`) after the scenario completed. No failing run in this execution
reported `following=false` or `finalGap > 2`; the red gate only surfaced the
transient off-bottom paint.

This plan therefore targets the transient pre-paint race. The persistent
Firefox strand remains unreproduced and unexplained until a failing real-app
trace shows a final off-bottom state.

## Streaming Max Gap

The stream-swap fixture now measures a signed visual tail offset and records
the absolute magnitude. When the bottom sentinel exists it measures the
sentinel against the viewport bottom; otherwise it falls back to the last
rendered message wrapper, then to the legacy `scrollHeight` gap. This catches
both content below the viewport and blank space below the tail.

With only that signed oracle active and the component anchoring change stashed,
plain streaming still painted one block off-bottom before the ResizeObserver
snap corrected it:

```text
variant=same-id offBottomPaints=0 maxGapPx=24 currentGapPx=0 following=true
```

After the sentinel implementation, measured on
`/tests/chat/stream-swap?variant=same-id` in chromium:

```text
variant=same-id offBottomPaints=0 maxGapPx=0 currentGapPx=0 following=true
```

The sentinel is rendered before the message wrappers in DOM order while staying
absolutely positioned at the content bottom. That preserves
`collectPitchChanges`' existing `itemsEl.children` message-boundary invariant:
the sentinel's own no-id pitch is discarded before the walk reaches the first
message, and the final real message still closes at `containerBottom` rather
than at the sentinel's offset.

## Signed Oracle Follow-up

The signed oracle also caught the inverse failure mode while validating the full
suite. WebKit `new-id-two-tick` briefly left blank space below the tail:

```text
Expected: <= 48
Received:    521
```

That regression was not visible to the previous clamped oracle. The fix routes
message-count shrink/removal while following through the existing pre-paint
snap path. Follow-up verification:

```text
npx playwright test tests/chat/stream-swap.spec.ts -g "new-id-two-tick" --project=webkit
1 passed

npx playwright test tests/chat/stream-swap.spec.ts --project=chromium --project=firefox --project=webkit
18 passed
```
