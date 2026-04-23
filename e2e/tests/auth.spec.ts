import { test, expect, type Page } from '@playwright/test';

let counter = 0;
const uniqueEmail = () => `test+${Date.now()}-${counter++}@example.com`;

async function register(page: Page, email: string, password = 'password123', name = 'Test User') {
  await page.goto('/');
  await page.getByText('Register', { exact: true }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/#\/login$/);
}

test('register lands on home with email visible', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByText(email)).toBeVisible();
});

test('logout clears jwt and returns to login', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await expect(page).toHaveURL(/#\/home$/);

  await logout(page);

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('jwt'));
  expect(token).toBeNull();
});

test('login with registered credentials lands on home', async ({ page }) => {
  const email = uniqueEmail();
  const password = 'password123';
  await register(page, email, password);
  await expect(page).toHaveURL(/#\/home$/);

  await logout(page);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByText(email)).toBeVisible();
});

test('refresh while on home stays on home', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await expect(page).toHaveURL(/#\/home$/);

  await page.reload();

  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByText(email)).toBeVisible();
});

test('unauthenticated navigation to #/home redirects to #/login', async ({ page }) => {
  await page.goto('/#/home');
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('duplicate-email registration surfaces error in the form', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await expect(page).toHaveURL(/#\/home$/);

  await logout(page);
  await page.getByText('Register', { exact: true }).click();
  await page.getByLabel('Name').fill('Another User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password456');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByText(/already registered/)).toBeVisible();
  await expect(page).toHaveURL(/#\/login$/);
});

test('wrong-password login surfaces generic invalid-credentials message', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await expect(page).toHaveURL(/#\/home$/);

  await logout(page);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrongpassword');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/#\/login$/);
});
