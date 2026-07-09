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

Observed on 2026-07-09 with the corrected no-border probe:

```text
PROBE chromium A firstFrameGap=0 settledGap=0
PROBE chromium B firstFrameGap=298 settledGap=298
PROBE chromium C firstFrameGap=0 settledGap=0
PROBE firefox A firstFrameGap=0 settledGap=0
PROBE firefox B firstFrameGap=298 settledGap=298
PROBE firefox C firstFrameGap=0 settledGap=0
PROBE webkit A firstFrameGap=0 settledGap=0
PROBE webkit B firstFrameGap=298 settledGap=298
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

To be completed in step 6 after the sentinel implementation: record plain
streaming `maxGapPx` before/after and confirm it drops from about one block to 0.
