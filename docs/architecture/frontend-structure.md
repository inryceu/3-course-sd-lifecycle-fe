# Frontend Architecture Structure

## Directory Layout & Feature Boundaries

The frontend strictly follows a modular monolith architecture, mirroring the backend module boundaries:

- `src/features/auth/` - Authentication, registration, protected routes.
- `src/features/boards/` - Board management, lists.
- `src/features/cards/` - Card details, creation, drag-and-drop.
- `src/features/jira-sync/` - Jira OAuth connection, issue mapping.

**Other Core Directories:**

- `src/api/` - HTTP client (`client.ts`), API endpoints, and generated OpenAPI types.
- `src/components/` - Shared/Global UI components (e.g., `Layout`, `ProtectedRoute`).
- `src/hooks/` - Shared custom hooks. **Note:** Real-time (WebSocket) logic is centralized here in `useWebSocket.ts`.
- `src/types/` - Global TypeScript interfaces (manual types to be replaced by OpenAPI).
- `src/pages/` - Top-level route components (if not co-located in features).
- `src/store/` - Global client state (Zustand/Context).
- `src/utils/` - Helper functions and formatters.

## Naming Conventions

- **Components, Types, and Interfaces:** `PascalCase` (e.g., `BoardPage.tsx`, `AuthContext.tsx`).
- **Hooks and Utilities:** `camelCase`, hooks must be prefixed with `use` (e.g., `useWebSocket.ts`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`).
- **Files/Folders:** `kebab-case` for non-component files and feature folders (e.g., `jira-sync`).

## Import & Dependency Rules

1. **Strict Feature Isolation:** A feature module (e.g., `boards`) **MUST NOT** import internal components or logic directly from another feature module (e.g., `cards` or `auth`).
2. **Cross-Feature Communication:** Must be handled via global state (`src/store/`), shared hooks (`src/hooks/`), or global context providers.
3. **Public APIs:** If a feature needs to expose something, it should be exported through an `index.ts` file acting as a public API.

## API & OpenAPI Generation

The API client types are generated deterministically from the backend's OpenAPI specification.
_Currently, a stub `openapi.yaml` is used. Once the backend finalizes the spec, it will replace the stub._

**Command to generate types:**

```bash
pnpm run api:generate
```
