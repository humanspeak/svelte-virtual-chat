# 001 — Migrating from svelte-virtual-scroll-list to Svelte Virtual Chat

**Read `README.md` in this directory first.** It carries the thesis, the
honesty constraints, the verified fact sheet, and the wiring checklist. This
plan carries only what is specific to this post.

- **Slug:** `docs/src/routes/blog/migrating-from-svelte-virtual-scroll-list/+page.svx`
- **Working title:** Migrating from svelte-virtual-scroll-list to a Svelte 5 chat viewport
- **Target length:** ~1,400–1,800 words, similar shape to the existing chatbot post
- **Tags:** `migration`, `svelte-5`, `virtualization`, `svelte-chatbot`

## Why this post exists

~16.8k weekly downloads, and the author has put an explicit "No longer
maintained" notice on the README. Those users have to move. This is the
highest-intent migration audience we have.

Crucially, this package's own README advertises **"dynamic both-directional
lists"** and it ships `topThreshold` / `bottomThreshold` events plus
`scrollToBottom()`. That is chat-and-infinite-scroll tooling. Its users are
disproportionately building message timelines — so unlike a generic
virtualizer, the audience overlap with us is genuinely high. Say the routing
caveat anyway (README §3), but expect most readers to be in scope.

## The cold open

Their setup is almost certainly this: `on:bottom` to append, `on:top` to
prepend history, and a `$effect` or `afterUpdate` calling
`scrollToBottom()` whenever `data` changes. Open on what that does during a
streaming response — `scrollToBottom()` fires on every token, so scrolling up
mid-stream is physically impossible; the next chunk snaps the reader back.
Then the second symptom: `on:top` loads 50 older messages and the paragraph
they were reading leaves the screen, because the list got taller above them.

Write both as behavior the reader recognizes, not as bugs in v1ack's library.
The library was asked to do something it never claimed to do.

## Migration specifics

Prop and API mapping to use for the side-by-side table. Do not improvise
beyond this.

| `svelte-virtual-scroll-list`                                                                       | Svelte Virtual Chat                        | Note                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `data`                                                                                             | `messages`                                 | Same chronological order, oldest first                                               |
| `key` (default `"id"`, a string field name)                                                        | `getMessageId` (a function)                | Function, not a field name — handles composite/derived IDs                           |
| `estimateSize`                                                                                     | `estimatedMessageHeight` (default 72)      | Estimate only; real heights are measured automatically                               |
| `keeps` (default 30)                                                                               | Not needed                                 | Rendered count derives from viewport height; `overscan` (default 6) tunes the margin |
| default slot, `let:data let:index`                                                                 | `{#snippet renderMessage(message, index)}` | Svelte 5 snippet, not a legacy slot                                                  |
| `<svelte:fragment slot="header">` / `"footer"`                                                     | `header` / `footer` snippets               | Same idea, non-virtualized, scrolls with content                                     |
| `on:top` + `topThreshold`                                                                          | `onNeedHistory`                            | Fires near the top; prepend anchoring is handled for you                             |
| `on:bottom` + `bottomThreshold`                                                                    | Not supported directly                     | Use `isAtBottom()` or `onFollowBottomChange` — see below                             |
| `on:scroll`                                                                                        | `onDebugInfo` / `onFollowBottomChange`     | We expose intent, not raw scroll events                                              |
| `scrollToBottom()`                                                                                 | `scrollToBottom({ smooth })`               | Rarely needed now — follow-bottom is automatic                                       |
| `scrollToIndex(i)`                                                                                 | `scrollToMessage(id, { smooth })`          | Identity, not position                                                               |
| `scrollToOffset()`, `getOffset()`, `getSize()`, `getSizes()`, `getClientSize()`, `getScrollSize()` | `getDebugInfo()`                           | One snapshot object instead of eight getters                                         |
| `pageMode`                                                                                         | Not supported                              | Document-level scrolling; tracked as the `window-scroll-mode` open gap               |
| `isHorizontal`                                                                                     | Not supported                              | Vertical message timelines only, by design                                           |
| `start` / `offset`                                                                                 | Not supported as initial props             | Mount at the bottom, then `scrollToMessage()` if you need a specific position        |

Two mappings need prose, not just a table row:

**`on:bottom` has no direct equivalent, and that is deliberate.** In their code
`on:bottom` was probably doing two different jobs — "load newer" and "the user
is at the bottom, so autoscroll". Split them: the second job is now
`onFollowBottomChange` / `isAtBottom()`, and the first usually disappears
entirely for chat, where new messages are pushed rather than paged. Do not
paper over this with a fake equivalence.

**`key` → `getMessageId` is the conceptual centre of the post.** Their `key`
is a field name; ours is a function, and it is what makes the prepend anchor
possible. Land this before the code, and the anchoring section writes itself.

## The deletion pass

Give this its own `##` heading. Show a realistic hand-rolled follow-bottom —
an `afterUpdate` / `$effect` calling `scrollToBottom()` guarded by a
`shouldFollow` boolean that is maintained from `on:scroll`, plus the
`topThreshold` handler that captures `scrollHeight` before a prepend and
restores `scrollTop` after. Roughly 25–40 lines. Then show it deleted, and
name what each deleted piece is replaced by. This is the payoff.

## Status and alternatives paragraph

Facts in README §6. Required content:

- Quote the README notice and link to it directly.
- Note that the last commit to the repo (2025-03-21) _was_ that notice — the
  package has had no functional change since the 1.3.0 release in July 2023.
- Name the fork the author points at, and its npm name
  `@josesan9/svelte-virtual-scroll-list` (peer `svelte: >=5.0.0`).
- Be fair about the fork: **if your list is not a conversation, the fork is the
  smaller migration and you should take it.** Note honestly that it is early
  (~26 weekly downloads) so the reader can weigh that themselves. Do not
  editorialize further.
- On Svelte 5: the original is not broken, it is legacy-mode-only (`let:`
  slots, `createEventDispatcher`). Precision here, not FUD.

## What you give up

`pageMode` (document scrolling), horizontal lists, `stickyIndices`-style
pinned rows, and direct offset control. Link the first to the
`window-scroll-mode` open gap and the third to `sticky-indices`; both are
tracked as things we intend to do, and saying so is more credible than
pretending they do not matter.

## Done criteria

All of README §9, plus:

- [ ] The `on:bottom` split (follow-state vs. load-newer) is explained in
      prose, not just a table row.
- [ ] The deletion pass shows ≥25 lines of real removed code.
- [ ] The fork is recommended, by name, for the non-chat reader.
- [ ] The Svelte 5 status is stated as "legacy mode only", never as "broken".
