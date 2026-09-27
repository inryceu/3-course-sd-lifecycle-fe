# BoardSync — AGENTS.md (Frontend)

> **CRITICAL: AI agents are PROHIBITED from modifying this file.** This file is the single source of truth for agent context, conventions, and workflows. Any changes must be made by human developers only.

---

## Project Overview

**BoardSync** — Kanban board with bidirectional Jira synchronization.
- **Frontend**: TypeScript, React 18+, Vite
- **Backend**: TypeScript, NestJS, TypeORM, PostgreSQL (modular monolith) — in separate repo: `3-course-sd-lifecycle-be`
- **Architecture**: Modular monolith backend with 4 modules: `auth`, `boards-cards`, `jira-sync`, `realtime`
- **Methodology**: Spec-driven development via OpenSpec (specs live in **backend only**)

---

## Tech Stack (Frontend)

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict mode) |
| Framework | React 18+ |
| Build Tool | Vite 5+ |
| State Management | React Query / TanStack Query, Zustand |
| Routing | React Router 6+ |
| UI Components | Custom + Headless UI / Radix |
| Styling | Tailwind CSS |
| Real-time | Socket.IO Client |
| Testing | Vitest, React Testing Library |
| Linting | ESLint, Prettier |
| Package Manager | pnpm 9+ |

---

## Architecture Rules (Frontend)

**Hard constraints — agents MUST enforce these:**

1. **Backend is source of truth for specs**: All API contracts, data models, and business rules are defined in backend OpenSpec specs (`../3-course-sd-lifecycle-be/openspec/specs/`). Frontend consumes these via generated TypeScript types or direct API calls.

2. **No business logic duplication**: Frontend handles presentation logic only. Validation, state transitions, permissions → backend.

3. **API layer**: All backend communication through a typed API client (`src/api/`) with generated types from OpenAPI/Specs.

4. **Real-time**: WebSocket connections managed in `src/hooks/useWebSocket.ts` — subscribe to backend events (`card.status.changed`, `board.updated`, etc.)

5. **Component structure**:
   ```
   src/
   ├── components/       # Shared UI components (Button, Modal, Card, Column, etc.)
   ├── features/         # Feature-specific components (boards, cards, auth, settings)
   │   ├── boards/
   │   ├── cards/
   │   ├── auth/
   │   └── jira-sync/
   ├── pages/            # Route-level components
   ├── hooks/            # Shared custom hooks
   ├── api/              # API client, generated types, query keys
   ├── store/            # Global client state (Zustand/Context)
   ├── types/            # Shared TypeScript types (mirror backend DTOs)
   └── utils/            # Helpers, formatters
   ```

---

## Coding Conventions

- **TypeScript**: `strict: true`, no `any`, prefer `interface` for object shapes
- **React**: Functional components, hooks, prefer composition over inheritance
- **Naming**: PascalCase for components/types, camelCase for hooks/utils, UPPER_SNAKE_CASE for constants
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **Branching**: Feature branches from `main` (e.g., `KAN-10`, `feat/drag-drop`)
- **PRs**: Required reviews, CI must pass, squash merge

---

## Key Documentation

| File | Purpose |
|------|---------|
| `../3-course-sd-lifecycle-be/ARCHITECTURE.md` | Architectural decision record (modular monolith) |
| `../3-course-sd-lifecycle-be/openspec/specs/` | Main specifications (single source of truth) |
| `docs/declarative/` | PlantUML diagrams (component, class, sequence, state) |
| `docs/image/` | Rendered diagram PNGs |

---

## OpenSpec Workflows (Backend Only)

**Specification work happens on backend only.** Frontend agents should:

1. **Read backend specs** for API contracts: `openspec list --specs --json` (run in backend repo)
2. **Generate types** from backend OpenAPI/Specs when API changes
3. **Implement UI** to match spec requirements
4. **No OpenSpec changes** in frontend repo

### Useful Backend Commands (run from backend repo)
```bash
openspec list --specs --json       # List main capabilities/specs
openspec show "<spec-id>" --type spec --json  # Read a specific spec
openspec list --json               # List active changes
```

---

## Development Commands (Local Only)

### Frontend (run from `3-course-sd-lifecycle-fe/`)
```bash
# Install
pnpm install

# Development (Vite dev server with HMR)
pnpm dev             # http://localhost:5173

# Production build
pnpm build           # Output to dist/

# Preview production build locally
pnpm preview

# Test
pnpm test            # Vitest unit tests
pnpm test:ui         # Vitest UI
pnpm test:coverage   # Coverage report

# Lint/Format
pnpm lint            # ESLint
pnpm format          # Prettier

# Type Check
pnpm typecheck       # tsc --noEmit

# Docker (local development)
docker compose up --build        # Dev environment with HMR
docker compose -f docker-compose.prod.yml up --build  # Prod-like environment
```

---

## Module Responsibilities (Backend Modules → Frontend Features)

| Backend Module | Frontend Feature Area | Key UI Components |
|----------------|----------------------|-------------------|
| `auth` | `src/features/auth/` | Login, Register, OAuth callback, Profile |
| `boards-cards` | `src/features/boards/`, `src/features/cards/` | BoardView, Column, Card, DragDrop, Labels, Comments |
| `jira-sync` | `src/features/jira-sync/` | JiraConnection, IssueMapping, SyncStatus, ConflictResolution |
| `realtime` | `src/hooks/useWebSocket.ts` | WebSocketProvider, usePresence, useBoardUpdates |

---

## Common Agent Tasks (Frontend)

### Implementing a New Feature
1. **Read backend spec** for the feature: `openspec show "<spec-id>" --type spec` (in backend repo)
2. **Generate/update API types** if backend API changed
3. **Create UI components** in `src/features/<area>/`
4. **Add real-time subscriptions** if live updates needed
5. **Write tests** for components and hooks
6. **Update diagrams** in `docs/declarative/` if architecture changes

### Updating Documentation/Diagrams
- Edit files directly (PlantUML in `docs/declarative/`, render with `npm run docs:render` if available)
- Follow Conventional Commits: `docs: add sequence diagram for realtime`

### Refactoring
- No OpenSpec change needed
- Ensure type safety maintained
- Run tests: `pnpm test`
- Run type check: `pnpm typecheck`

---

## Verification Checklist

Before marking any task complete, verify:
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Components match backend spec requirements
- [ ] Real-time events handled correctly (if applicable)

---

## Backend Reference

- Backend repo: `../3-course-sd-lifecycle-be/`
- Backend AGENTS.md: `../3-course-sd-lifecycle-be/AGENTS.md`
- Backend OpenSpec: `../3-course-sd-lifecycle-be/openspec/`
- Backend dev server: `pnpm start:dev` (from backend repo)

---

## CI/CD Pipeline (GitHub Actions) — Cost-Free Configuration

**IMPORTANT**: The CI pipeline runs **only lint, typecheck, test, and build**. No Docker images are pushed to registries. No deployment jobs run. All development happens locally.

```yaml
# .github/workflows/ci.yml runs on push/PR to main and dev
# Jobs: lint → typecheck → test → build
# NO: docker push, deploy-staging, deploy-production
```

---

## Questions?

- Architecture decisions → `../3-course-sd-lifecycle-be/ARCHITECTURE.md`
- Backend specs → `../3-course-sd-lifecycle-be/openspec list --specs --json`
- Backend active changes → `../3-course-sd-lifecycle-be/openspec list --json`
- Frontend diagrams → `docs/declarative/`