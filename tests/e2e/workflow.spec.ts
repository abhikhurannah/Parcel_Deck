import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
test('operator imports, insurer approves, admin creates, activates, edits and removes a rule', async ({
  page,
}) => {
  await page.goto('/');
  async function login(role: string) {
    await expect(page.getByRole('button', { name: 'Sign in →', exact: true })).toBeVisible();
    await page.getByLabel('Username', { exact: true }).fill(role);
    await page.getByLabel('Password', { exact: true }).fill(`Demo-${role}-2026!`);
    await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Routing overview' })).toBeVisible();
    await expect(page.locator(`.theme-${role}`)).toBeVisible();
    await expect(page.getByText('Total parcels', { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/theme-${role}.png`, fullPage: true });
  }
  await login('admin');
  await page.getByRole('button', { name: '⚿ Account & access', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Role', exact: true }).locator('option'),
  ).toHaveCount(2);
  for (const role of ['operator', 'insurer']) {
    await page.getByLabel('Username', { exact: true }).fill(role);
    await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption(role);
    await page.getByLabel('Initial password', { exact: true }).fill(`Demo-${role}-2026!`);
    await page.getByRole('button', { name: 'Create user', exact: true }).click();
    await expect(page.getByText(`${role} · ${role} · active`, { exact: false })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login('operator');
  await page.getByRole('button', { name: '↑ Import a batch', exact: true }).click();
  await page.getByLabel('Batch file').setInputFiles(resolve('examples/Container_68465468.xml'));
  await page.getByLabel('Fallback country for XML', { exact: true }).fill('NL');
  await page.getByRole('button', { name: '1. Preview import', exact: true }).click();
  await expect(
    page.getByText('17 valid / 0 rejected · 11 routed / 6 insurance holds'),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/import-preview.png', fullPage: true });
  await page.getByRole('button', { name: '2. Confirm import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Batch #1 imported' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login('insurer');
  await page.getByRole('button', { name: '◇ Insurance queue', exact: true }).click();
  await page.getByRole('button', { name: 'Review →', exact: true }).first().click();
  await page.getByLabel('Review reason').fill('Insurance checked during acceptance test');
  await page.getByRole('button', { name: 'Record insurance decision', exact: true }).click();
  await expect(page.getByText('5 parcels · Page 1 of 1')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login('admin');
  await page.getByRole('button', { name: '⚙ Routing policy', exact: true }).click();
  await page.getByRole('button', { name: 'Add rule', exact: true }).click();
  await page.getByLabel('Rule ID', { exact: true }).last().fill('fragile-special');
  await page.getByRole('button', { name: '1. Preview impact', exact: true }).click();
  await expect(page.getByText('0 / 17 sampled inputs change')).toBeVisible();
  await page.getByLabel('Fragile', { exact: true }).check();
  await page.getByRole('button', { name: 'Test without saving' }).click();
  await expect(page.getByText('Special · pending_insurance', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/policy-editor.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Routing policy · v1' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/policy-mobile.png', fullPage: true });
  await expect(
    page.getByRole('button', { name: '2. Activate policy', exact: true }),
  ).toBeDisabled();
  async function activate(version: number) {
    await page
      .getByLabel('Reason for change')
      .fill('Update fragile routing during acceptance test');
    await page.getByRole('button', { name: '1. Preview impact', exact: true }).click();
    await page.getByRole('button', { name: '2. Activate policy', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: `Routing policy · v${version}`, exact: true }),
    ).toBeVisible();
  }
  await activate(2);
  await page.reload();
  await page.getByRole('button', { name: '⚙ Routing policy', exact: true }).click();
  const rule = page
    .locator('.rule-row')
    .filter({ has: page.locator('input[value="fragile-special"]') });
  await expect(rule.getByLabel('Department', { exact: true })).toHaveValue('Special');
  await rule.getByLabel('Department', { exact: true }).fill('Care');
  await activate(3);
  await page.getByLabel('Fragile', { exact: true }).check();
  await page.getByRole('button', { name: 'Test without saving' }).click();
  await expect(page.getByText('Care · pending_insurance', { exact: true })).toBeVisible();
  await rule.getByRole('button', { name: 'Remove rule', exact: true }).click();
  await activate(4);
  await expect(page.locator('input[value="fragile-special"]')).toHaveCount(0);
  await page.getByLabel('Fragile', { exact: true }).check();
  await page.getByRole('button', { name: 'Test without saving' }).click();
  await expect(page.getByText('Heavy · pending_insurance', { exact: true })).toBeVisible();
  const mailRule = page.locator('.rule-row').filter({ has: page.locator('input[value="Mail"]') });
  await mailRule.getByLabel('Department', { exact: true }).fill('Whale');
  await activate(5);
  await page.getByRole('button', { name: '◫ Overview', exact: true }).click();
  await expect(
    page.getByRole('progressbar', { name: 'Whale: 0 routed parcels', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.retired-department').filter({ hasText: 'Mail' })).toBeVisible();
  await page.getByRole('button', { name: '＋ New parcel', exact: true }).click();
  await page.getByLabel('Weight (kg)').fill('0.5');
  await page.getByLabel('Declared value (€)').fill('20');
  await page.getByLabel('Destination country').fill('NL');
  await page.getByRole('button', { name: 'Check & route parcel →', exact: true }).click();
  await expect(
    page.getByRole('progressbar', { name: 'Whale: 1 routed parcels', exact: true }),
  ).toBeVisible();
});
