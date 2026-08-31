# 002 — Migrating from svelte-virtual to Svelte Virtual Chat

**Read `README.md` in this directory first.** It carries the thesis, the
honesty constraints, the verified fact sheet, and the wiring checklist. This
plan carries only what is specific to this post.

- **Slug:** `docs/src/routes/blog/migrating-from-svelte-virtual/+page.svx`
- **Working title:** Migrating from svelte-virtual to a Svelte 5 chat viewport
- **Target length:** ~1,200–1,600 words
- **Tags:** `migration`, `svelte-5`, `virtualization`, `variable-height`

## Why this post exists, and why it is the harder one to write honestly

`ghostebony/svelte-virtual` is **not abandoned** — there are commits from April 2026. Read README §3 before writing a single sentence about its status. The
only defensible status claim is about the npm tags:

- `latest` is `0.6.3` (2024-02-26), peer `^3.54.0 || ^4.0.0` — no Svelte 5.
- `next` is `1.0.0-next.22` (2024-11-11), peer `^5.0.0` — Svelte 5, prerelease.
- Nothing has been published to either tag in ~21 months, though the repo has
  moved.

So the reader's actual situation is one of two, and the post must handle both:
they are on `0.6.3` and blocked from Svelte 5, or they are on a `next.22`
prerelease that has not been promoted to stable in nearly two years. Address
them separately and by name; conflating them is how this post gets a factual
correction in the replies.

**The version trap:** the repo README documents the `next` line — snippets,
`item`/`placeholder`/`header`/`footer`, Svelte 5. That is not what `pnpm add
svelte-virtual` installs. Warn about this explicitly; it is genuinely useful
to the reader independent of any migration, and it is the kind of detail that
earns the rest of the post's credibility.

## The cold open — lead with fixed `itemSize`

This is the strongest technical hook we have, and it is not about maintenance
at all. `List` requires **`itemSize`, a single fixed number**. Chat messages
are not a fixed height: a one-word "ok" and a forty-line code block are the
same `itemSize` to this component.

Open there. The reader has already fought it — they either padded every
message to a uniform height, or they gave every message a scroll container of
its own, or they gave up on virtualization for the last N messages. Then the
second beat: a streaming message changes height _while it is on screen_, which
a fixed size cannot represent at all.

Our answer is automatic per-message measurement with in-frame correction:
`estimatedMessageHeight` is a starting guess, not a contract.

## Migration specifics

`svelte-virtual` exports `List` and `Grid`. **Only `List` maps to us.** If they
are using `Grid`, they are not building a conversation — route them to
`@humanspeak/svelte-virtual-list` per README §3 and let them go.

| `svelte-virtual` `List`                                       | Svelte Virtual Chat                        | Note                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `itemCount`                                                   | Not needed                                 | Derived from `messages.length`                                                                |
| `itemSize` (required, fixed)                                  | `estimatedMessageHeight` (default 72)      | An estimate that gets replaced by real measurements                                           |
| `getKey(index)`                                               | `getMessageId(message)`                    | Takes the message, not the index — identity survives prepends                                 |
| `{#snippet item({ index, style })}`                           | `{#snippet renderMessage(message, index)}` | You receive the message itself; positioning is not your job, so there is no `style` to spread |
| `overScan` (default 1)                                        | `overscan` (default 6)                     | Same concept, different spelling and default                                                  |
| `height` / `width` props                                      | `containerClass` / `viewportClass`         | Size with CSS; the container must have a bounded height                                       |
| `header` / `footer` snippets                                  | `header` / `footer` snippets               | Direct equivalent                                                                             |
| `placeholder` snippet                                         | Not supported                              | We measure rather than skip, so there is no fast-scroll placeholder state                     |
| `scrollToIndex(i, alignment, behavior)`                       | `scrollToMessage(id, { smooth })`          | Identity instead of position; no alignment control                                            |
| `scrollToPosition(px)`                                        | Not supported                              | Pixel offsets are not stable across a prepend                                                 |
| `scrollPosition` / `scrollAlignment` / `scrollBehavior` props | Not supported as props                     | Use the imperative methods                                                                    |
| `stickyIndices`                                               | **Not supported**                          | Tracked as the `sticky-indices` open gap                                                      |
| `layout: "horizontal"`                                        | Not supported                              | Vertical message timelines only, by design                                                    |
| `marginTop` / `marginLeft`                                    | Not supported                              | Use `header` / CSS                                                                            |
| `Grid`                                                        | Not supported                              | Out of scope — see the routing box                                                            |

Two rows need prose:

**The `style` prop disappearing is the interesting one.** In `svelte-virtual`
the `item` snippet receives a `style` string that the consumer must spread onto
their element — positioning is the consumer's responsibility, which is exactly
why a wrong `itemSize` produces overlapping messages. In `renderMessage` there
is nothing to spread. Use this to explain _why_ we can measure and they cannot.

**`stickyIndices` is a real loss.** `svelte-virtual` has it and we do not, and
the obvious chat use — a pinned "Today" / "Yesterday" date separator — is the
canonical example. Say so directly, link the open gap, and suggest the
interim workaround (a non-virtualized separator rendered in `header`, or
inline separators as ordinary messages in the array).

## Status and alternatives paragraph

Required content, facts from README §6:

- The two-tag situation, stated precisely, with dates.
- The repo is active; do not imply otherwise. Link recent commit history.
- Name `svelte-virtual@next` as the maintained alternative: **if you want a
  generic Svelte 5 virtual list and you are comfortable pinning a prerelease,
  that is the smaller migration.** Say that plainly.
- The honest framing for choosing us: it is not "theirs is stale", it is "a
  fixed `itemSize` cannot describe a conversation, and no maintenance schedule
  changes that."

## What you give up

`stickyIndices`, `Grid`, horizontal layouts, pixel-offset scrolling, scroll
alignment control, and the `placeholder` fast-scroll affordance. That is a
longer list than post 001's, and the post is better for printing it in full.

## Done criteria

All of README §9, plus:

- [ ] The `latest` vs. `next` distinction is stated with both versions and both
      dates, and the two reader situations are addressed separately.
- [ ] The post never states or implies the package is abandoned.
- [ ] The repo-README-documents-`next` version trap is called out.
- [ ] `stickyIndices` is named as a genuine loss, with the open-gap link and an
      interim workaround.
- [ ] `Grid` users are routed to `@humanspeak/svelte-virtual-list` early.
