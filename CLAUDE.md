# CLAUDE.md

Project context for Claude Code sessions.

## Project Overview

`@humanspeak/svelte-virtual-chat` — A high-performance virtual chat viewport for Svelte 5. Purpose-built for LLM conversations, support chat, and any message-based UI with follow-bottom, streaming stability, and history prepend with anchor preservation.

- **Package**: `@humanspeak/svelte-virtual-chat`
- **Homepage**: <https://virtualchat.svelte.page>
- **Repository**: <https://github.com/humanspeak/svelte-virtual-chat>

## Workspace Structure

This is a **PNPM workspace** with two packages:

- **`./`** — Main library package (`@humanspeak/svelte-virtual-chat`)
- **`./docs`** — Documentation site (SvelteKit) with interactive examples

## Tech Stack

- **Svelte 5** — Uses runes (`$state`, `$derived`, `$effect`) and snippets (`{#snippet}`)
- **SvelteKit** — For dev server, test routes, and docs site
- **TypeScript** — Strict mode, full type safety
- **Vitest** — Unit tests
- **Playwright** — E2E tests

## Key Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # Start dev server (library)
pnpm run dev:all      # Start library + docs dev servers
pnpm build            # Build library (vite build + svelte-package + publint)
pnpm test             # Run vitest with coverage
pnpm run test:e2e     # Run Playwright tests
pnpm run check        # svelte-check (TypeScript validation)
```

## Architecture

### Core Component

- `src/lib/SvelteVirtualChat.svelte` — Main component. Message-aware virtual chat viewport with follow-bottom, streaming support, and history prepend.

### Key Design Decisions

1. **Normal chronological order** — messages stored oldest-first, rendered top-to-bottom. No inverted geometry.
2. **Two states** — following bottom, or user scrolled away.
3. **Message-aware** — uses `getMessageId` for identity, not just array indices.
4. **Streaming-native** — batches height changes per animation frame.

### Helper Modules

- `src/lib/virtual-chat/chatTypes.ts` — Internal type definitions
- `src/lib/virtual-chat/chatMeasurement.svelte.ts` — Height measurement and caching via ResizeObserver
- `src/lib/virtual-chat/chatAnchoring.ts` — Scroll anchor preservation for history prepend

### Sibling Projects

- `@humanspeak/svelte-virtual-list` — General-purpose virtual list (this component reuses concepts but not code)
- `@humanspeak/svelte-markdown` — Markdown renderer with LLM streaming support (natural pairing for chat UIs)

## Conventions

- Commit messages follow **conventional commits** (`feat:`, `fix:`, `docs:`, `build:`, etc.)
- PRs target `main` branch
- Examples live in `docs/src/routes/examples/` with components in `docs/src/lib/examples/`
