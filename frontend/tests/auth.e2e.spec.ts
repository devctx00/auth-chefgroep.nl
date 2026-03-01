import { expect, test } from '@playwright/test';

test('register view validates mismatched password', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Registreren' }).click();

  await page.getByLabel('Volledige naam').fill('Jan de Vries');
  await page.getByLabel('E-mailadres').fill('jan@chefgroep.nl');
  await page.getByLabel('Gebruikersnaam').fill('jan_user');
  await page.getByLabel('Wachtwoord', { exact: true }).fill('supersecret');
  await page.getByLabel('Bevestig wachtwoord').fill('different');
  await page.getByRole('button', { name: 'Account aanmaken' }).click();

  await expect(page.getByRole('alert')).toContainText('Wachtwoorden komen niet overeen.');
});
