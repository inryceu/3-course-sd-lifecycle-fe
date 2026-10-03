# BoardSync — Frontend

> Kanban board UI with two-way Jira synchronization. Frontend repository (React + TypeScript).

## Concept

BoardSync gives teams a fast, visual kanban board that stays in sync with Jira automatically, so no one has to update a card's status twice. This repository implements the client: the drag-and-drop board, real-time updates, and the Jira-connection UI.

## Approach

- **Spec-driven development.** UI features are implemented against the agreed requirements/API spec, not ad hoc (see the project's *Специфікація вимог* document).
- **Modular structure.** Feature-based folders (`auth/`, `boards/`, `cards/`, `jira-sync/`, plus the `realtime` hook; see `docs/architecture/frontend-structure.md`), each with its own components, hooks and state, mirroring the backend's module boundaries.
- **Real-time first.** The board subscribes to a WebSocket channel so every connected user sees card moves, comments and Jira-driven status changes instantly, without a page reload.

## Key features

| Area | What it covers |
| --- | --- |
| Boards & columns | Create/edit boards and columns, drag-and-drop cards |
| Cards | Create/edit cards, labels, deadlines, comments |
| Jira connection | OAuth 2.0 flow, connect/disconnect a Jira project |
| Realtime | Live board updates via WebSocket |
| Auth | Login/registration, role-based UI (Admin / Member / Viewer) |

## Tech stack

- **Language:** TypeScript
- **Library:** React
- **Real-time client:** WebSocket (client library TBD)
- **Containerization:** Docker / Docker Compose
- **CI/CD:** pipeline for this repository (provider TBD)

## Team

| Name | Role |
| --- | --- |
| Pavlo | PM + Fullstack developer — boards & cards module |
| Edward | Fullstack developer — Jira integration module |
| Denys | Fullstack developer — auth & users module |
| Kyrylo | Fullstack developer — realtime module, DevOps/CI-CD |

## Getting started

```bash
# install dependencies (pnpm 9, Node 20+)
pnpm install

# run in development (Vite on http://localhost:5173, expects the backend on :3000)
cp .env.example .env.local
pnpm dev

# checks
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# run with Docker (frontend dev compose)
docker compose up --build
```

### Run the full stack

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

## User guide

> 🚧 To be added — a walkthrough for end users: connecting a Jira project, creating boards and cards, using labels and deadlines.

## Related

- Backend repository: `boardsync-backend`
- Requirements specification: `Специфікація_вимог_BoardSync.md`
