import { expect, test } from '@playwright/test';

test('register view validates mismatched password', async ({ page }) => {
  await page.goto('/?switch=1');
  await page.getByRole('tab', { name: 'Registreren' }).click();

  await page.getByLabel('Volledige naam').fill('Jan de Vries');
  await page.getByLabel('E-mailadres').fill('jan@chefgroep.nl');
  await page.getByLabel('Gebruikersnaam').fill('jan_user');
  await page.getByLabel('Wachtwoord', { exact: true }).fill('supersecret');
  await page.getByLabel('Bevestig wachtwoord').fill('different');
  await page.getByRole('button', { name: 'Account aanmaken' }).click();

  await expect(page.getByRole('alert')).toContainText('Wachtwoorden komen niet overeen.');
});

test('register view validates invalid email address', async ({ page }) => {
  await page.goto('/?switch=1');
  await page.getByRole('tab', { name: 'Registreren' }).click();

  await page.getByLabel('Volledige naam').fill('Jan de Vries');
  await page.getByLabel('E-mailadres').fill('geen-geldig-email');
  await page.getByLabel('Gebruikersnaam').fill('jan_user');
  await page.getByLabel('Wachtwoord', { exact: true }).fill('supersecret');
  await page.getByLabel('Bevestig wachtwoord').fill('supersecret');
  await page.getByRole('button', { name: 'Account aanmaken' }).click();

  await expect(page.getByRole('alert')).toContainText('E-mailadres is ongeldig.');
});

test('login form shows error when fields are empty', async ({ page }) => {
  await page.goto('/?switch=1');

  await page.getByRole('button', { name: 'Inloggen' }).click();

  await expect(page.getByRole('alert')).toContainText('Vul gebruikersnaam en wachtwoord in.');
});
