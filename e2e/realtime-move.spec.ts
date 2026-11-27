import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, signIn, test, unique } from './fixtures';

const BUDGET_MS = 5000;

// FR-07 (UI half) · NFR-PERF-3: a move made elsewhere shows up on the open board without reload.
// The Jira -> backend -> socket half is proven in the backend system tests (jira-inbound).
test('card moved by another user appears in the target column without reload', async ({
  page,
  request,
  seed,
}) => {
  const owner = await seed.register('owner');
  const other = await seed.register('other');
  const board = await seed.createBoard(owner.token, unique('Realtime'));
  await seed.invite(owner.token, board.id, other.email, 'MEMBER');

  const todoId = board.columns.find((c) => c.title === 'To Do')?.id;
  const inProgressId = board.columns.find((c) => c.title === 'In Progress')?.id;
  if (!todoId || !inProgressId) throw new Error('Default columns not found');

  const title = unique('Card');
  const card = await seed.addCard(owner.token, todoId, title);

  await signIn(page, owner.token);
  await page.goto(`/boards/${board.id}`);

  const todo = page.getByRole('region', { name: 'Column To Do' });
  const inProgress = page.getByRole('region', { name: 'Column In Progress' });
  await expect(todo.getByRole('listitem').filter({ hasText: title })).toBeVisible();

  await page.waitForLoadState('networkidle');
  const tStart = Date.now();
  const res = await request.fetch(`/api/v1/cards/${card.id}/move`, {
    method: 'PATCH',
    data: { columnId: inProgressId, position: 0 },
    headers: { authorization: `Bearer ${other.token}` },
  });
  expect(res.ok()).toBe(true);

  await expect(inProgress.getByRole('listitem').filter({ hasText: title })).toBeVisible({
    timeout: BUDGET_MS,
  });
  const elapsedMs = Date.now() - tStart;
  await expect(todo.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);

  expect(elapsedMs).toBeLessThanOrEqual(BUDGET_MS);
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/latency-realtime-ui.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), 'move->ui': elapsedMs }, null, 2)
  );
});