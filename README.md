# BoardSync — Frontend

> Kanban board UI with two-way Jira synchronization. Frontend repository (React + TypeScript).

## Concept

BoardSync gives teams a fast, visual kanban board that stays in sync with Jira automatically, so no one has to update a card's status twice. This repository implements the client: the drag-and-drop board, real-time updates, and the Jira-connection UI.

## Approach

- **Spec-driven development.** UI features are implemented against the agreed requirements/API spec, not ad hoc (see the project's *Специфікація вимог* document).
- **Modular structure.** Feature-based folders (`board/`, `card/`, `auth/`, `jira/`, `realtime/`), each with its own components, hooks and state, mirroring the backend's module boundaries.
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

> 🚧 Placeholder — to be filled in once the initial project scaffold is committed.

```bash
# clone
git clone <repo-url>
cd boardsync-frontend

# install dependencies
npm install

# run in development
npm run dev

# run with Docker
docker compose up --build
```

## Environment variables

> 🚧 To be documented: API base URL, WebSocket URL, Jira OAuth client id.

## User guide

> 🚧 To be added — a walkthrough for end users: connecting a Jira project, creating boards and cards, using labels and deadlines.

## Related

- Backend repository: `boardsync-backend`
- Requirements specification: `Специфікація_вимог_BoardSync.md`
