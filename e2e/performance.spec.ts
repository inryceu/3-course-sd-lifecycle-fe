import { expect, signedInTest as test, unique } from './fixtures';
import type { Page } from '@playwright/test';

type Fixtures = {
  page: Page;
  seed: ReturnType<typeof import('./fixtures').seeder>;
  account: import('./fixtures').Account;
};

test.describe('Performance and layout (NFR-PERF-1, NFR-UI-1, NFR-COMP-1)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('loads a board with 100 cards in under 2 seconds and verifies layout', async ({
    page,
    seed,
    account,
  }: Fixtures) => {
    await page.goto('/');

    const boardTitle = unique('PerfBoard');
    const board = await seed.createBoard(account.token, boardTitle);

    expect(board.columns).toBeDefined();
    expect(board.columns.length).toBeGreaterThan(0);
    const columnId = board.columns[0].id;

    const cardPromises = [];
    for (let i = 0; i < 100; i++) {
      cardPromises.push(seed.addCard(account.token, columnId, `Perf Card ${i}`));
    }
    await Promise.all(cardPromises);

    const startTime = Date.now();

    await page.goto(`/boards/${board.id}`);
    await expect(page.locator(`text="Perf Card 99"`)).toBeVisible({ timeout: 10000 });

    const durationMs = Date.now() - startTime;

    console.log(`Board with 100 cards loaded in ${durationMs} ms`);

    expect(durationMs).toBeLessThanOrEqual(2000);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
