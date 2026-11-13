import { expect, signIn, test, unique } from './fixtures';

// FR-12 · spec system-tests "Viewer restrictions journey"
test('a Viewer sees the board but cannot change it', async ({ page, seed }) => {
  const admin = await seed.register('admin');
  const viewer = await seed.register('viewer');
  const board = await seed.createBoard(admin.token, unique('Shared board'));
  await seed.addCard(admin.token, board.columns[0].id, 'Read-only card');
  await seed.invite(admin.token, board.id, viewer.email, 'VIEWER');

  await signIn(page, viewer.token);
  await page.goto(`/boards/${board.id}`);

  const todo = page.getByRole('region', { name: 'Column To Do' });
  const card = todo.getByRole('listitem').filter({ hasText: 'Read-only card' });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('draggable', 'false');

  await expect(page.getByPlaceholder('Add a card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add column' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Members (2)' }).click();
  const members = page.getByRole('region', { name: 'Board members' });
  await expect(members.getByText(viewer.email)).toBeVisible();
  await expect(members.getByRole('button', { name: 'Invite' })).toHaveCount(0);
  await expect(members.getByRole('combobox')).toHaveCount(0);
});
