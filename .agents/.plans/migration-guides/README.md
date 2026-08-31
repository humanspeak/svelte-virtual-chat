# Editorial — migration guides from dormant Svelte virtual lists

**Status: OPEN** · Authored 2026-08-31 · Two posts, executable independently.

This is the editorial spine for a pair of `/blog` posts aimed at people
already running a Svelte virtual-list package that has stopped moving. It
exists because the 2026-08-31 competitive-intel run surfaced roughly **23k
combined weekly npm downloads** sitting on two packages that will not follow
their users into Svelte 5 — addressable migration demand, not a competitive
threat.

Read this file before either plan. It carries the thesis, the honesty
constraints, the voice, and the verified fact sheet. The numbered plans carry
only what is specific to their post.

---

## 1. The thesis

**A conversation is not a generic list, and that — not abandonment — is the
reason to move.**

Both target packages are competent generic virtualizers. If we lead with "this
library is dead, use ours," we write something that is half untrue (see §3),
ages badly, and reads like a landgrab. We also lose the reader who checks the
repo and finds recent commits.

Lead instead with the thing that is durably true and that the reader has
already felt: they took a generic windowing component and hand-built
follow-bottom, history-prepend, and streaming height correction on top of it,
and that hand-built layer is where their bugs live. The dormancy is the reason
they are searching _today_; the shape mismatch is the reason they should land
on us rather than on the nearest maintained generic fork.

Order of argument, in both posts:

1. Here is the scroll bug you have (concrete, reproducible, framed as
   behavior, not as a library flaw).
2. Here is why a generic virtualizer cannot close it for you — it does not
   know which item is "the newest message" or what the reader is doing.
3. Here is the mechanical migration, prop by prop.
4. Here is what you give up, stated without flinching.

## 2. Who the reader is

Someone with a working app. They are not evaluating libraries for fun; they
hit a wall — a Svelte 5 upgrade, a streaming response that fights the
scrollbar, an "load older messages" button that teleports the viewport. They
want a diff, not a pitch.

Consequences for the writing:

- Every migration step must be **copy-pasteable and complete**. No `// ...rest
of your code`.
- Assume their existing code works. Never imply they built it wrong. The
  hand-rolled follow-bottom in these posts is written the way a competent
  person would write it, and it still breaks — that is the whole point.
- No "blazing fast", no "battle-tested", no download-count flexing. The
  existing post `building-a-chatbot-ui-in-svelte` sets the register: calm,
  declarative, second person, short paragraphs. Match it.

## 3. Honesty constraints — non-negotiable

These are the claims that would make the posts wrong. The competitive-intel
digest now validates `/compare` claims automatically via `compare_data_paths`;
blog prose has no such guard, so it has to be right on the way in.

**Do not call either package abandoned as a blanket statement.**

- `svelte-virtual-scroll-list` — the author says it himself. Quote the README
  notice, link it, and point at the fork he points at. That is honest and it
  is stronger than anything we could assert.
- `svelte-virtual` — **not abandoned.** The repo had commits in April 2026.
  The accurate, narrower claim is about the npm tags: Svelte 5 support exists
  only on a `next` prerelease that has not shipped in ~21 months, while the
  `latest` tag is still Svelte 4. Say exactly that and nothing more.

**Name the maintained alternative in both posts.** For post 001 that is
`@josesan9/svelte-virtual-scroll-list`; for post 002 it is
`svelte-virtual@next`. A migration guide that hides the smaller migration is a
sales page. Recommending the smaller change where it genuinely fits is what
makes the rest of the post credible.

**Route non-chat readers away from us.** Most people using these packages have
generic lists, not conversations. Both posts need an early, unmissable fork in
the road:

> If your list is a feed, a table, a picker, or a log — not a conversation —
> the package you want is [`@humanspeak/svelte-virtual-list`](https://virtuallist.svelte.page),
> not this one. Read on only if the newest item arrives at the bottom and a
> human is reading it.

This is not modesty. `@humanspeak/svelte-virtual-chat` is deliberately
message-shaped (see `.competitive-intel/config.json` → `non_goals`), and a
reader who migrates a data table onto it will have a bad time and say so.

**State the gaps in the same voice as the wins.** We do not have
`stickyIndices`, window/page scrolling, horizontal layouts, or grids. Two of
those are tracked as open gaps in `.competitive-intel/state.json`
(`sticky-indices`, `window-scroll-mode`). Where a post's target package has one
of them, the post says so plainly and says whether it is on the roadmap. No
burying it in a closing bullet.

**Every number and date gets sourced or omitted.** Use the fact sheet in §6.
Do not let download counts into prose that will be stale in a month — "roughly
17k weekly downloads" is fine framing for _why we wrote this_, and does not
belong in an evergreen claim about anything.

## 4. Shared post structure

Both posts follow the same skeleton, so they read as a series:

1. **Cold open on the symptom.** Two or three sentences, no preamble. The
   streaming message grows and yanks the reader down; or history loads and the
   paragraph they were reading jumps off screen.
2. **Where you are** — one honest paragraph on the current package's status,
   with the maintained-alternative link. This is also the "should I even be
   reading this" filter, plus the generic-list routing box from §3.
3. **The three behaviors a chat viewport owes you.** Follow-bottom that
   survives streaming; scroll-away that stays away; prepend that preserves the
   anchor. Frame as a contract, not a feature list.
4. **The migration**, in this order:
    - install
    - message identity (`key` / `getKey` → `getMessageId`)
    - the render slot → `renderMessage` snippet
    - sizing (`estimateSize` / `itemSize` → `estimatedMessageHeight`)
    - the scroll callbacks (`on:top` / `topThreshold` → `onNeedHistory`)
    - the imperative handle (`scrollToBottom`, `scrollToMessage`, `isAtBottom`)
    - **the deletion pass** — the hand-rolled follow-bottom effect they can now
      remove. This is the emotional payoff of the post; give it its own heading
      and show the deleted code.
5. **Side-by-side prop table.** Old → new → note. Mark unsupported things
   `Not supported` with a one-line reason, never a blank cell.
6. **What you give up.** Honest, specific, links to the open-gap items.
7. **Verify it worked** — a short manual checklist the reader can actually run
   (scroll up mid-stream; load history while scrolled back; resize mid-stream).
8. **Where to go next** — links to `/docs/guides/llm-streaming`,
   `/docs/guides/history-loading`, `/compare`.

## 5. Our API, verified against source (2026-08-31)

Do not invent props. This is the real surface, from `src/lib/types.ts` and
`src/lib/SvelteVirtualChat.svelte`.

Props: `messages`, `getMessageId`, `estimatedMessageHeight` (default 72),
`followBottomThresholdPx` (default 48), `overscan` (default 6),
`renderMessage` (snippet, receives `message` and `index`), `onNeedHistory`,
`onFollowBottomChange`, `onDebugInfo`, `header`, `footer`, `containerClass`,
`viewportClass`, `viewportLabel` (default `"Chat messages"`), `testId`.

Imperative (via `bind:this`): `scrollToBottom(options?)`,
`scrollToMessage(id, options?)`, `isAtBottom()`, `getDebugInfo()`. Both scroll
methods take `{ smooth?: boolean }`, default `false`.

Also exported from the package root: `ChatHeightCache`,
`captureScrollAnchor`, `restoreScrollAnchor`, and the types
`SvelteVirtualChatProps`, `SvelteVirtualChatDebugInfo`,
`ScrollToBottomOptions`, `ScrollToMessageOptions`, `ScrollAnchor`,
`VisibleRange`.

Structural requirement worth repeating in both posts: **the container needs a
bounded height.** It is the single most common first-run failure.

## 6. Verified fact sheet (2026-08-31)

Everything below was checked against the npm registry and the GitHub API on
2026-08-31. Re-verify anything older than a couple of weeks before publishing;
`last_publish` and `pushed_at` are the two that move.

### svelte-virtual-scroll-list (v1ack)

| Fact             | Value                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| npm `latest`     | `1.3.0`, published **2023-07-16**                                                                                    |
| peer range       | `svelte: >=3.5.0` (dev dep is Svelte 4)                                                                              |
| weekly downloads | ~16.8k                                                                                                               |
| repo             | `v1ack/svelte-virtual-scroll-list` — 126 stars, 13 open issues, not archived                                         |
| last commit      | **2025-03-21**, message: `no maintained warning` — the only commit since the 1.3.0 release                           |
| README notice    | "⚠️ No longer maintained — please reffer to fork <https://github.com/ArcticKeaton/svelte-virtual-scroll-list>" (sic) |
| maintained fork  | `ArcticKeaton/svelte-virtual-scroll-list`, 20 stars, pushed 2025-10-31                                               |
| fork on npm      | `@josesan9/svelte-virtual-scroll-list` `1.1.2` (2025-10-31), peer `svelte: >=5.0.0`, ~26 weekly downloads            |

API surface (v1.3.0): component `VirtualScroll`. Props `data`, `key`
(default `"id"`), `keeps` (default 30), `estimateSize`, `isHorizontal`,
`pageMode`, `start`, `offset`, `topThreshold`, `bottomThreshold`. Events
`scroll`, `top`, `bottom`. Slots `header`, `footer`, and a default slot with
`let:data let:index`. Bound methods `scrollToBottom()`, `scrollToIndex()`,
`scrollToOffset()`, `getSize()`, `getSizes()`, `getOffset()`,
`getClientSize()`, `getScrollSize()`, `updatePageModeFront()`.

Svelte 5 status: runs in **legacy mode only** — `let:` slots and
`createEventDispatcher`. It is not broken on Svelte 5, it just cannot be used
from runes-mode components without friction. Say it that precisely.

### svelte-virtual (ghostebony)

| Fact             | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| npm `latest`     | `0.6.3`, published **2024-02-26**, peer `^3.54.0 \|\| ^4.0.0`       |
| npm `next`       | `1.0.0-next.22`, published **2024-11-11**, peer `^5.0.0`            |
| weekly downloads | ~6.0k                                                               |
| repo             | `ghostebony/svelte-virtual` — 72 stars, 8 open issues, not archived |
| last commit      | **2026-04-16** (`add class prop`) — actively worked on              |
| gap vs npm       | 21 months of commits with no publish to either tag                  |

API surface (repo `main`, which is the `1.0.0-next` line): components `List`
and `Grid`. `List` props `itemCount` (required), `itemSize` (required,
**fixed number**), `height`, `width`, `stickyIndices`, `overScan` (default 1),
`marginLeft`, `marginTop`, `layout`, `scrollPosition`, `scrollAlignment`,
`scrollBehavior`, `getKey`. Methods `scrollToIndex()`, `scrollToPosition()`.
Snippets `item` (receives `index`, `style`), `placeholder`, `header`, `footer`.

Note the version trap: the repo README documents the `next` line (snippets,
Svelte 5), **not** the `0.6.3` stable that most readers have installed. The
post must be explicit about which one it is describing at any moment, and
plan 002 says how.

## 7. SEO / GEO targets

Primary intent is "get me off X". Titles and H1s should contain the source
package name verbatim — that is the query.

- 001: `svelte-virtual-scroll-list alternative`, `svelte-virtual-scroll-list
svelte 5`, `svelte-virtual-scroll-list unmaintained`, `svelte virtual scroll
chat`
- 002: `svelte-virtual svelte 5`, `svelte-virtual alternative`, `svelte
virtual list variable height`, `svelte virtual chat`

Both reinforce the cluster the rank tracker is already moving on (`svelte chat
ui` and `svelte chatbot` are new entries landing on `/blog`, per the
2026-08-31 run). Cross-link both posts to each other and to
`/blog/building-a-chatbot-ui-in-svelte`; that post is the top-of-funnel and
these two are bottom-of-funnel for the same cluster.

Frontmatter `description` is the search snippet. Write it as a sentence a
person would read, containing the source package name and the words "Svelte
5".

## 8. Wiring checklist (applies to both posts)

Mechanical, easy to miss, breaks the site quietly if skipped:

1. `docs/src/routes/blog/<slug>/+page.svx` — frontmatter **and** the duplicate
   `BlogPostMeta` object in the `<script>` block. Both exist in the current
   post; keep them in sync with each other.
2. `docs/src/lib/docsNav.ts` → add the slug to `blogPostTitles`, or the
   breadcrumb falls back to a title-cased slug.
3. `docs/src/lib/sitemap-manifest.json` → add `/blog/<slug>` with the publish
   date.
4. The blog index globs `/src/routes/blog/*/+page.svx` automatically — no edit
   needed there.
5. `trunk fmt` then `trunk check` before committing. Never raw prettier or
   eslint.

## 9. Done criteria

A post is done when all of these hold:

- [ ] Every code block compiles against the real API in §5 — no invented props.
- [ ] Every factual claim about the source package traces to §6 or to a link
      in the post itself, and was re-verified on the day of writing.
- [ ] The maintained alternative is named and linked, with an honest sentence
      on when to pick it instead of us.
- [ ] The generic-list routing box to `@humanspeak/svelte-virtual-list` appears
      above the fold.
- [ ] "What you give up" is present, specific, and names the open gaps.
- [ ] The deletion pass shows real removed code, not a description of it.
- [ ] All five wiring steps in §8 are done.
- [ ] Voice matches `building-a-chatbot-ui-in-svelte` — read them back to back.

## 10. Out of scope

- Rewriting `/compare` pages, or adding either package to `compare-data.ts`.
  Neither is a Tier 1 competitor; they are migration sources. Keep the surfaces
  separate.
- Promoting either package from watchlist to competitor in
  `.competitive-intel/config.json`. That is a separate promote-or-drop call and
  these posts do not depend on it.
- Benchmarks. We have no measured numbers against either package and must not
  imply any.
