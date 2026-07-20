import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let counter = 0;
const uniqueEmail = () => `test+${Date.now()}-${counter++}@example.com`;

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const fixtureSizeLabel = (name: string) => `${statSync(fixturePath(name)).size} B`;

async function register(page: Page, email: string, password = 'password123', name = 'Test User') {
  await page.goto('/');
  await page.getByText('Register', { exact: true }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/#\/home$/);
}

// Selects the fixture and submits; assertions on the outcome stay in the tests.
// mimeType overrides the declared part type Playwright would otherwise infer.
async function uploadFixture(page: Page, fixture: string, mimeType?: string) {
  await page.getByRole('button', { name: 'Upload' }).click();
  const files = mimeType
    ? { name: fixture, mimeType, buffer: readFileSync(fixturePath(fixture)) }
    : fixturePath(fixture);
  await page.locator('upload-modal input[type="file"]').setInputFiles(files);
  await page.locator('upload-modal').getByRole('button', { name: 'Upload' }).click();
}

function fileRow(page: Page, name: string): Locator {
  return page.locator('file-row').filter({ hasText: name });
}

test.beforeEach(async ({ page }) => {
  await register(page, uniqueEmail());
});

test('upload a png shows it in the list with filename and size', async ({ page }) => {
  await uploadFixture(page, 'sample.png');

  const row = fileRow(page, 'sample.png');
  await expect(row).toBeVisible();
  await expect(row.getByText('sample.png', { exact: true })).toBeVisible();
  await expect(row.getByText(fixtureSizeLabel('sample.png'))).toBeVisible();
});

test('clicking a png filename opens an image preview', async ({ page }) => {
  await uploadFixture(page, 'sample.png');

  await fileRow(page, 'sample.png').getByText('sample.png', { exact: true }).click();

  await expect(page.getByRole('heading', { name: 'sample.png' })).toBeVisible();
  await expect(page.getByAltText('sample.png')).toBeVisible();
});

test('download saves the original filename and bytes', async ({ page }) => {
  await uploadFixture(page, 'sample.png');

  const downloadPromise = page.waitForEvent('download');
  await fileRow(page, 'sample.png').getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('sample.png');
  const savedPath = await download.path();
  expect(readFileSync(savedPath)).toEqual(readFileSync(fixturePath('sample.png')));
});

test('delete with confirmation removes the row and survives a refetch', async ({ page }) => {
  await uploadFixture(page, 'sample.png');
  const row = fileRow(page, 'sample.png');
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Delete' }).click();

  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('No files yet — upload your first.')).toBeVisible();
});

test('clicking a txt filename shows the text content', async ({ page }) => {
  await uploadFixture(page, 'sample.txt');

  await fileRow(page, 'sample.txt').getByText('sample.txt', { exact: true }).click();

  await expect(page.getByRole('heading', { name: 'sample.txt' })).toBeVisible();
  const contents = readFileSync(fixturePath('sample.txt'), 'utf8');
  await expect(page.locator('file-preview pre')).toHaveText(contents);
});

test('clicking a rar filename shows the icon-only preview with metadata', async ({ page }) => {
  // octet-stream is what real browsers send for .rar
  await uploadFixture(page, 'sample.rar', 'application/octet-stream');

  await fileRow(page, 'sample.rar').getByText('sample.rar', { exact: true }).click();

  await expect(page.getByRole('heading', { name: 'sample.rar' })).toBeVisible();
  await expect(page.getByText('📦')).toBeVisible();
  await expect(
    page.getByText(`application/x-rar-compressed · ${fixtureSizeLabel('sample.rar')}`),
  ).toBeVisible();
  await expect(page.locator('file-preview img')).toBeHidden();
  await expect(page.locator('file-preview pre')).toBeHidden();
});

test('uploading a disallowed type keeps the modal open with the server error', async ({ page }) => {
  await uploadFixture(page, 'sample.pdf');

  await expect(page.getByText('Unsupported file type: .pdf')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upload file' })).toBeVisible();
  await expect(page.locator('upload-modal').getByText('sample.pdf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change file' })).toBeVisible();

  await expect(page.getByText('No files yet — upload your first.')).toBeVisible();
});
