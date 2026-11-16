import { expect, signedInTest as test, unique } from './fixtures';

// FR-03, FR-04 · spec system-tests "Board and card journey" (starts from the stored session)
test('create a board, add cards and drag a card to another column', async ({ page }) => {
  const title = unique('Board');

  await page.goto('/boards');
  await page.getByLabel('New board title').fill(title);
  await page.getByRole('button', { name: 'Create board' }).click();
  await expect(page).toHaveURL(/\/boards\/[0-9a-f-]{36}$/);

  const todo = page.getByRole('region', { name: 'Column To Do' });
  const inProgress = page.getByRole('region', { name: 'Column In Progress' });
  await expect(todo).toBeVisible();
  await expect(inProgress).toBeVisible();

  for (const card of ['First card', 'Second card']) {
    await todo.getByLabel('New card in To Do').fill(card);
    await todo.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(todo.getByRole('listitem').filter({ hasText: card })).toBeVisible();
  }

  // The UI moves the card optimistically; wait for the backend to accept the move before reloading.
  const moved = page.waitForResponse(
    (res) => /\/cards\/[^/]+\/move$/.test(res.url()) && res.request().method() === 'PATCH'
  );
  await todo.getByRole('listitem').filter({ hasText: 'First card' }).dragTo(inProgress);
  expect((await moved).ok()).toBe(true);

  const assertMoved = async () => {
    await expect(inProgress.getByRole('listitem').filter({ hasText: 'First card' })).toBeVisible();
    await expect(todo.getByRole('listitem').filter({ hasText: 'First card' })).toHaveCount(0);
    await expect(todo.getByRole('listitem').filter({ hasText: 'Second card' })).toBeVisible();
  };
  await assertMoved();
  await page.reload();
  await assertMoved();
});
