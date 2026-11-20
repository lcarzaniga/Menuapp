// Primo accesso dell'amministratore, come in produzione: invito dalla console del server,
// richiesta dal browser, approvazione dalla console con il codice mostrato.
import { expect, test as preparazione } from '@playwright/test'
import { chiediAccesso, console_, invitoDaConsole } from './aiuti'

preparazione('primo accesso dell\'amministratore', async ({ page }) => {
  // Senza sessione l'app mostra solo la schermata di accesso.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dispositivo non autorizzato' })).toBeVisible()

  const codice = await chiediAccesso(page, invitoDaConsole(), 'PC di prova')
  await expect(page.getByText('In attesa di approvazione')).toBeVisible()
  expect(console_('approva', codice)).toContain('Approvata')
  await expect(page.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible({ timeout: 10_000 })
  const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-menuapp-sessione')
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' })
  await page.context().storageState({ path: process.env.MENUAPP_E2E_SESSIONE ?? 'test-results/sessione-amministratore.json' })
})
