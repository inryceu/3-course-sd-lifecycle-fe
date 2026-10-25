# BoardSync — Frontend

> Kanban board UI with two-way Jira synchronization. Frontend repository (React + TypeScript).

## Concept

BoardSync gives teams a fast, visual kanban board that stays in sync with Jira automatically, so no one has to update a card's status twice. This repository implements the client: the drag-and-drop board, real-time updates, and the Jira-connection UI.

## Approach

- **Spec-driven development.** UI features are implemented against the agreed requirements/API spec, not ad hoc (see the project's *Специфікація вимог* document).
- **Modular structure.** Feature-based folders (`auth/`, `boards/`, `cards/`, `jira-sync/`, plus the `realtime` hook; see `docs/architecture/frontend-structure.md`), each with its own components, hooks and state, mirroring the backend's module boundaries.
- **Real-time first.** The board subscribes to a WebSocket channel so every connected user sees card moves, comments and Jira-driven status changes instantly, without a page reload.

## Project Structure

```
src/
├── api/                 # HTTP client, generated types, endpoints
├── components/          # Shared UI (Layout, ProtectedRoute)
├── features/
│   ├── auth/            # Login, Register, AuthContext
│   ├── boards/          # BoardView, Column, DragDrop
│   ├── cards/           # CardDialog, labels, comments
│   └── jira-sync/       # JiraConnection, Import, OAuth callback
├── hooks/               # useWebSocket (realtime)
├── store/               # Zustand global state
├── types/               # Shared TS types (mirror backend DTOs)
└── utils/               # Helpers, formatters
```

## Key features

| Area | What it covers |
| --- | --- |
| Boards & columns | Create/edit boards and columns, drag-and-drop cards |
| Cards | Create/edit cards, labels, deadlines, comments |
| Jira connection | OAuth 2.0 flow, connect/disconnect a Jira project |
| Realtime | Live board updates via WebSocket |
| Auth | Login/registration, role-based UI (Admin / Member / Viewer) |

## Tech stack

| Layer | Technology | Min Version |
| --- | --- | --- |
| Language | TypeScript | 5.3+ |
| Framework | React | 18+ |
| Build Tool | Vite | 5+ |
| State Management | TanStack Query, Zustand | 5+, 4+ |
| Routing | React Router | 6+ |
| Styling | Tailwind CSS | 3+ |
| Real-time | Socket.IO Client | 4+ |
| Testing | Vitest | 1+ |
| Runtime | Node.js | 20+ |
| Package Manager | pnpm | 9+ |
| Containerization | Docker / Docker Compose | — |
| CI/CD | GitHub Actions (workflow in `.github/workflows/ci.yml`) | — |

## Team

| Name | Role | Modules |
| --- | --- | --- |
| Pavlo | PM + Fullstack developer — boards & cards module | `src/features/boards/`, `src/features/cards/` |
| Edward | Fullstack developer — Jira integration module | `src/features/jira-sync/` |
| Denys | Fullstack developer — auth & users module | `src/features/auth/` |
| Kyrylo | Fullstack developer — realtime module, DevOps/CI-CD | `src/hooks/useWebSocket.ts`, CI/CD, nginx |

## Getting started

```bash
# install dependencies (pnpm 9, Node 20+)
pnpm install

# run in development (Vite on http://localhost:5173, expects the backend on :3000)
cp .env.example .env.local
pnpm dev

# checks
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# run with Docker (local full stack: frontend + backend + postgres)
docker compose up --build

# run production-like build locally
docker compose -f docker-compose.prod.yml up --build
```

### Run the full stack (cross-repo alternative)

Postgres, backend (migrations applied) and this frontend start together from the **backend**
repository, with both repositories checked out side by side:

```bash
cd ../3-course-sd-lifecycle-be
cp .env.full.example .env.full   # fill in the secrets
docker compose --env-file .env.full -f docker-compose.full.yml up --build
```

The web UI is then on http://localhost:8080; nginx proxies `/api/` and `/socket.io/` (WebSocket,
namespace `/realtime`) to the backend, so the SPA uses same-origin URLs.
If port 8080 or 3000 is already used on your machine, set `WEB_PORT` / `BACKEND_PORT` in `.env.full`
(the web UI then is on `http://localhost:<WEB_PORT>`).

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3000/api/v1` | REST base URL. The Docker image is built with `/api/v1` (same origin). |
| `VITE_WS_URL` | page origin | Origin of the Socket.IO server; the client connects to `<origin>/realtime`. Empty = same origin. |

Values are read at build time (`import.meta.env`). See `.env.example`.

## API contract and generated types

The contract lives in the backend repository (`docs/api/openapi.yaml`, `docs/api/ws-events.md`).
This repo keeps a synced copy and generated types:

```bash
pnpm api:sync       # copy the spec from ../3-course-sd-lifecycle-be (override with BACKEND_REPO=...)
pnpm api:generate   # docs/api/openapi.yaml -> src/api/api.generated.ts (deterministic)
```

CI regenerates the types and fails if `src/api/api.generated.ts` is out of date.

## Specifications and diagrams

- **Backend OpenSpec specs** (single source of truth): `../3-course-sd-lifecycle-be/openspec/specs/`
  - List specs: `openspec list --specs --json` (run in backend repo)
  - Active changes: `openspec list --json` (run in backend repo)
- **PlantUML diagrams** (source): `docs/declarative/`
  - Component diagram: `01-component.puml`
  - Class diagram: `02-class.puml`
  - Jira sync sequence: `03-sequence-jira-sync.puml`
  - OAuth sequence: `05-sequence-oauth.puml`
  - Realtime sequence: `06-sequence-realtime.puml`
  - State diagram: `04-state.puml`
- **Rendered diagrams** (PNG): `docs/image/`
- **Frontend architecture doc**: `docs/architecture/frontend-structure.md`

## Branch & PR workflow

- **Branch naming**: `KAN-<n>` (from `dev`), one branch per Jira ticket
- **Conflict resolution**: create `KAN-<n>-dev` branch from `dev`, resolve conflicts, open PR `KAN-<n>-dev` → `dev`
- **Merge flow**: PR into `dev` → squash merge → `dev` → `main` at sprint end
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **PR requirements**: CI green (lint, typecheck, test, build), 1 approval, conversations resolved
- **AI agents**: may open/comment/edit PRs, **never merge**
- **Details**: `CONTRIBUTING.md`, `AGENTS.md#git-workflow-rules`

## User guide

🚧 Work still in progress. Here you can see user guide that represent basic model of interaction with our project

1. **Connect Jira** — Open Settings → Jira Sync, click "Connect Jira", complete OAuth 2.0 flow
2. **Create a board** — Click "New Board", name it, add columns (e.g., To Do, In Progress, Done)
3. **Add cards** — In any column, click "+" to create a card; fill in title, description, labels, deadline
4. **Drag & drop** — Move cards across columns; changes sync to Jira automatically
5. **Real-time** — All connected users see moves, comments, and status changes instantly
6. **Comments & labels** — Open a card to add comments, assign labels, or update deadlines

## Related

- Backend repository: [`boardsync-backend`](https://github.com/inryceu/3-course-sd-lifecycle-be)
- Requirements specification: `Специфікація_вимог_BoardSync.md`