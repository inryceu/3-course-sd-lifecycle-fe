import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

export { expect } from '@playwright/test';

/** Session stored by auth.setup.ts and reused by the signed-in journeys (git-ignored). */
export const AUTH_FILE = fileURLToPath(new URL('.auth/user.json', import.meta.url));

const API = '/api/v1';
export const PASSWORD = 'Playwright-pass-1';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  password: string;
  token: string;
}

export interface SeededBoard {
  id: string;
  title: string;
  columns: { id: string; title: string }[];
}

/** Unique per call, so runs never collide on an already used stack. */
export const unique = (tag: string) =>
  `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function call<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  token?: string,
  data?: unknown
): Promise<T> {
  const res = await request.fetch(`${API}${path}`, {
    method,
    data,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Seeding through the public REST API (no database access, no real credentials). */
export function seeder(request: APIRequestContext) {
  return {
    async register(tag: string): Promise<Account> {
      const name = unique(`pw-${tag}`);
      const body = { email: `${name}@example.com`, password: PASSWORD, displayName: name };
      const res = await call<{ accessToken: string; user: { id: string } }>(
        request,
        'POST',
        '/auth/register',
        undefined,
        body
      );
      return { ...body, id: res.user.id, token: res.accessToken };
    },
    createBoard: (token: string, title: string) =>
      call<SeededBoard>(request, 'POST', '/boards', token, { title }),
    addCard: (token: string, columnId: string, title: string) =>
      call<{ id: string }>(request, 'POST', `/columns/${columnId}/cards`, token, { title }),
    invite: (token: string, boardId: string, email: string, role: 'MEMBER' | 'VIEWER') =>
      call<unknown>(request, 'POST', `/boards/${boardId}/members`, token, { email, role }),
  };
}

/** The web client keeps its token in sessionStorage, which Playwright's storageState does not save. */
export async function signIn(page: Page, token: string) {
  await page.addInitScript((t) => window.sessionStorage.setItem('accessToken', t), token);
}

/** Base fixture: `seed` for API seeding; the page starts signed out. */
export const test = base.extend<{ seed: ReturnType<typeof seeder> }>({
  seed: async ({ request }, use) => use(seeder(request)),
});

/** Signed-in fixture: `account` is the stored user and `page` starts with its session. */
export const signedInTest = test.extend<{ account: Account }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument
  account: async ({}, use) => use(JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Account),
  page: async ({ page, account }, use) => {
    await signIn(page, account.token);
    await use(page);
  },
});
