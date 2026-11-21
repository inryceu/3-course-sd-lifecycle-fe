import { expect, signedInTest as test, unique } from './fixtures';

const CARDS = 100;
const BUDGET_MS = 2000;

test.use({ viewport: { width: 1280, height: 720 } });

// NFR-PERF-1. A timing test is only meaningful without parallel load and without a retry that
// hides a slow first run, so it runs serially and never retries.
test.describe('Performance (NFR-PERF-1)', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  test(`loads a board with ${CARDS} cards in under ${BUDGET_MS / 1000} seconds`, async ({
    page,
    browser,
    seed,
    account,
  }, testInfo) => {
    const board = await seed.createBoard(account.token, unique('PerfBoard'));
    const columnId = board.columns[0].id;

    // One request at a time: concurrent inserts into one column race for the card position.
    for (let i = 0; i < CARDS; i++) {
      await seed.addCard(account.token, columnId, `Perf Card ${i}`);
    }

    const startTime = Date.now();
    await page.goto(`/boards/${board.id}`);
    await expect(page.getByText(`Perf Card ${CARDS - 1}`, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    const durationMs = Date.now() - startTime;

    // Recorded in the report (annotation) and as a JSON attachment.
    const measurement = {
      metric: 'board-load-ms',
      durationMs,
      budgetMs: BUDGET_MS,
      cards: CARDS,
      viewport: '1280x720',
      project: testInfo.project.name,
      browser: `${browser.browserType().name()} ${browser.version()}`,
    };
    testInfo.annotations.push({ type: 'board-load-ms', description: String(durationMs) });
    await testInfo.attach('performance.json', {
      body: JSON.stringify(measurement, null, 2),
      contentType: 'application/json',
    });

    expect(durationMs).toBeLessThanOrEqual(BUDGET_MS);
  });
});

// NFR-UI-1: independent of the timing test, so one failure never hides the other.
test.describe('Layout at 1280 px (NFR-UI-1, NFR-COMP-1)', () => {
  test('the board page has no horizontal overflow', async ({ page, seed, account }) => {
    const board = await seed.createBoard(account.token, unique('LayoutBoard'));
    await seed.addCard(account.token, board.columns[0].id, 'Layout Card');

    await page.goto(`/boards/${board.id}`);
    await expect(page.getByText('Layout Card', { exact: true })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
