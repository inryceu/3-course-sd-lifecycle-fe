import { expect, PASSWORD, test, unique } from './fixtures';

// FR-01 · spec system-tests "Sign-up and sign-in journey"
test('register, log out and sign in again', async ({ page }) => {
  const name = unique('pw-reg');
  const email = `${name}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});
