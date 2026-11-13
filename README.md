# BoardSync — Frontend

[![CI (dev)](https://github.com/inryceu/3-course-sd-lifecycle-fe/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/inryceu/3-course-sd-lifecycle-fe/actions/workflows/ci.yml?query=branch%3Adev)
[![CI (main)](https://github.com/inryceu/3-course-sd-lifecycle-fe/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/inryceu/3-course-sd-lifecycle-fe/actions/workflows/ci.yml?query=branch%3Amain)

> Kanban board UI with two-way Jira synchronization. Frontend repository (React + TypeScript).

## Concept

BoardSync gives teams a fast, visual kanban board that stays in sync with Jira automatically, so no one has to update a card's status twice. This repository implements the client: the drag-and-drop board, real-time updates, and the Jira-connection UI.

## Approach

- **Spec-driven development.** UI features are implemented against the agreed requirements/API spec, not ad hoc (see the project's *Специфікація вимог* document).
- **Modular structure.** Feature-based folders (`auth/`, `boards/`, `cards/`, `jira-sync/`, plus the `realtime` hook; see `docs/architecture/frontend-structure.md`), each with its own components and hooks, mirroring the backend's module boundaries.
- **Real-time first.** The board subscribes to a WebSocket channel so every connected user sees cards created, edited and moved, and board changes, without a page reload.

## Project Structure

```
src/
├── App.tsx, main.tsx    # routes, providers
├── api/                 # client.ts, endpoints.ts, schema.ts, token-storage.ts, api.generated.ts
├── components/          # ConfirmButton, auth/ProtectedRoute, layout/Layout
├── features/
│   ├── auth/            # LoginPage, RegisterPage, AuthContext, validation
│   ├── boards/          # BoardsPage, BoardPage, BoardHeader, ColumnView, MembersPanel,
│   │                    #   move-card.ts (drag & drop positions), use-members.ts
│   ├── cards/           # CardDialog
│   └── jira-sync/       # JiraSyncPage, JiraImportPanel, JiraCallbackPage (OAuth callback)
└── hooks/               # useWebSocket (realtime)
```

## Key features

| Area | What it covers |
| --- | --- |
| Boards & columns | Create/edit boards and columns, drag-and-drop cards, board members and roles |
| Cards | Create/edit cards, deadline, assignee; labels and comments are planned (KAN-42) |
| Jira connection | OAuth 2.0 flow, connect/disconnect a Jira site, import open issues, status → column mapping |
| Realtime | Live board updates via WebSocket |
| Auth | Login/registration, role-based UI (Admin / Member / Viewer) |

## Tech stack

| Layer | Technology | Version |
| --- | --- | --- |
| Language | TypeScript | 5.3+ |
| Framework | React | 18+ |
| Build Tool | Vite | 5+ |
| Server state | TanStack Query | 5+ |
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

Short summary; [`CONTRIBUTING.md`](CONTRIBUTING.md) is the authority and wins if the two differ.

- **Branch naming**: `KAN-<n>` (from `dev`), one branch per Jira ticket
- **Conflict resolution**: create `KAN-<n>-dev` branch from `dev`, resolve conflicts, open PR `KAN-<n>-dev` → `dev`
- **Merge flow**: PR into `dev` → squash merge → `dev` → `main` at sprint end
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **PR requirements** (per `CONTRIBUTING.md`): CI green (Lint, TypeCheck, Tests, Build, Docker Build), 1 approval, conversations resolved
- **AI agents**: may open/comment/edit PRs, **never merge**
- **Details**: `CONTRIBUTING.md`, `AGENTS.md#git-workflow-rules`

## User guide

🚧 Basic walkthrough; parts marked *planned* are not released yet.

1. **Create a board** — On **Boards**, type a title and click **Create board**. A new board starts with the columns To Do, In Progress and Done; on the board page you can add more with **Add column**, rename or reorder them.
2. **Add cards** — Type a title into **Add a card** at the bottom of a column and click **Add**. Click a card to edit its title, description, deadline, column and assignee.
3. **Drag & drop** — Drag a card to another position or column. Everyone with the board open sees the change without reloading.
4. **Members** — Click **Members (n)** on a board to open the panel; the board Admin invites a registered user by e-mail as MEMBER or VIEWER, changes roles or removes members.
5. **Connect Jira** — Open **Jira Sync** in the top navigation and click **Connect Jira** next to a board (board Admin only); complete the Atlassian OAuth 2.0 flow.
6. **Import issues** — On **Jira Sync**, enter the Jira project key and click **Import open issues**; adjust the status → column mapping and click **Save mapping**.

Planned:

- Moving a card updates the Jira issue status — *planned* (KAN-36).
- Jira changes appear on the board via webhook — *planned* (KAN-37).
- Labels and comments in the card dialog — *planned* (KAN-42).

## Related

- Backend repository: [`3-course-sd-lifecycle-be`](https://github.com/inryceu/3-course-sd-lifecycle-be)
- Requirements specification: `Специфікація_вимог_BoardSync.md`
