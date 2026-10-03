# Frontend Architecture Structure

## Directory Layout & Feature Boundaries

The frontend mirrors the backend module boundaries. Ticket T-08 names the areas `board/`, `card/`,
`auth/`, `jira/`, `realtime/`; they are mapped to the folders below.

| Area (T-08) | Folder | Notes |
| --- | --- | --- |
| auth | `src/features/auth/` | Login, registration, session (`AuthProvider`, `useAuth`). |
| board | `src/features/boards/` | Board list and board view. |
| card | `src/features/cards/` | Card details, creation, drag-and-drop (placeholder). |
| jira | `src/features/jira-sync/` | Jira OAuth connection, issue mapping. |
| realtime | `src/hooks/useWebSocket.ts` | Socket.IO client for `docs/api/ws-events.md`; shared hook, not a feature, because every feature may subscribe. |

**Other core directories**

- `src/api/` — HTTP client (`client.ts`), token storage (`token-storage.ts`), endpoints
  (`endpoints.ts`), generated OpenAPI types (`api.generated.ts`) and their short aliases (`schema.ts`).
- `src/components/` — shared UI (`Layout`, `ProtectedRoute`).
- `src/hooks/` — shared hooks.
- `src/store/`, `src/utils/` — global client state and helpers.
- `docs/api/openapi.yaml` — synced copy of the backend contract; `docs/adr/` — decision records.

## Naming Conventions

- **Components, types and interfaces:** `PascalCase` (e.g. `BoardPage.tsx`, `AuthContext.tsx`).
- **Hooks and utilities:** `camelCase`, hooks prefixed with `use` (e.g. `useWebSocket.ts`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g. `API_BASE_URL`).
- **Folders:** `kebab-case` for feature folders (e.g. `jira-sync`).

## Import & Dependency Rules (enforced by ESLint `no-restricted-imports`)

1. **Public API only.** Code outside a feature imports it through its `index.ts`
   (`../../features/auth`), never a deeper path (`../../features/auth/AuthContext`).
2. **No reaching into siblings.** A feature must not import files of another feature
   (`../boards/BoardsPage`); it may use the other feature's `index.ts`.
3. **Shared code** (`components/`, `hooks/`, `api/`) may use a feature only through its public API.
4. **Server data comes from the contract.** Types come from `src/api/schema.ts` (aliases of the
   generated schemas); do not hand-write DTO types that the spec already defines.

## API & OpenAPI Generation

Types are generated deterministically from the backend contract.

```bash
pnpm api:sync       # copy ../3-course-sd-lifecycle-be/docs/api/openapi.yaml (BACKEND_REPO overrides the path)
pnpm api:generate   # docs/api/openapi.yaml -> src/api/api.generated.ts
```

CI runs `pnpm api:generate` and fails on a diff of `src/api/api.generated.ts`. Operations the spec
marks `x-implemented-in: T-<n>` are not implemented by the backend yet.

## Runtime configuration

`VITE_API_URL` (REST) and `VITE_WS_URL` (Socket.IO origin) are read at build time; see `.env.example`.

## Error handling

`ApiClient` shows a toast for failed requests. Pass `{ silent: true }` when the caller renders the
error itself (login and registration forms). A 401 on any other endpoint clears the session and
redirects to `/login`.
