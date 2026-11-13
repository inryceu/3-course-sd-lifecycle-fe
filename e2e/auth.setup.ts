import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AUTH_FILE, test } from './fixtures';

test('store a signed-in session', async ({ seed }) => {
  const account = await seed.register('owner');
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(account));
});
