// Partecipanti, conferme e accompagnatori (SPEC §24): elenco facoltativo, +N, coperti manuali
// e calcolati con confronto, il proprio invito, «Chi porta» con un partecipante che non viene.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/partecipanti'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}

test('partecipanti, accompagnatori e coperti calcolati', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  const io = await apiLeggi<{ utente: { id: string; nome: string } }>(request, '/sessione')
  await apiScrivi(request, 'post', '/eventi', { id: 'ev-part', nome: 'Pasqua dai nonni', data: '2027-03-28', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Pasqua', adulti: 10, bambini: 2, coefficienteBambini: 0.5, note: '', gruppoId: famiglia.id })

  await page.goto('/#/eventi/ev-part/partecipanti')
  await expect(page.getByText('Nessun partecipante')).toBeVisible()
  await expect(page.getByText('· manuali')).toBeVisible()

  // ── Zio Marco, confermato, da solo
  await page.getByRole('button', { name: 'Aggiungi partecipante' }).click()
  let dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Zio Marco')
  await dialogo.getByLabel('Presenza').selectOption('confermato')
  await dialogo.getByRole('button', { name: 'Aggiungi' }).click()
  const marco = page.getByTestId('invito').filter({ hasText: 'Zio Marco' })
  await expect(marco.getByRole('group', { name: 'Presenza di Zio Marco' }).getByRole('button', { name: 'Confermato' })).toHaveAttribute('aria-pressed', 'true')

  // ── Zia Anna con un adulto in più (senza nome) e la piccola Sofia (con nome)
  await page.getByRole('button', { name: 'Aggiungi partecipante' }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Zia Anna')
  await dialogo.getByLabel('Presenza').selectOption('confermato')
  await dialogo.getByRole('button', { name: 'Aggiungi' }).click()
  const anna = page.getByTestId('invito').filter({ hasText: 'Zia Anna' })
  await anna.getByRole('button', { name: 'Azioni per Zia Anna' }).click()
  await page.getByRole('menuitem', { name: 'Aggiungi accompagnatori' }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Sofia')
  await dialogo.getByLabel('Adulto o bambino').selectOption('bambino')
  await dialogo.getByRole('button', { name: 'Aggiungi con nome' }).click()
  await expect(page.getByText('Sofia aggiunto')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Più adulti confermati' }).click()
  await dialogo.getByRole('button', { name: 'Salva' }).click()
  await expect(anna.getByRole('list', { name: 'Accompagnatori di Zia Anna' })).toContainText('Sofia')
  await expect(anna).toContainText('+ 1 adulto (confermato) senza nome')

  // ── Io, con l'app: conferma presenza dal mio invito
  await page.getByRole('button', { name: 'Aggiungi partecipante' }).click()
  await page.getByRole('dialog').getByLabel('Chi', { exact: true }).selectOption({ label: io.utente.nome })
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi' }).click()
  const mio = page.getByTestId('mio-invito')
  await mio.getByRole('button', { name: 'Ci sono' }).click()
  await expect(mio.getByRole('button', { name: 'Ci sono' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('conteggio-partecipanti')).toContainText('Confermati: 4 adulti, 1 bambino')

  // ── Coperti calcolati: confronto e conferma
  await page.getByRole('button', { name: 'Cambia' }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByText('Calcolati dai partecipanti').click()
  await expect(dialogo.getByRole('note')).toContainText('passano da 11 a 4,5')
  await dialogo.getByRole('button', { name: 'Conferma: 4,5 coperti' }).click()
  await expect(page.getByText('· calcolati dai partecipanti')).toBeVisible()
  await foto(page, '01-partecipanti')

  // ── «Chi porta»: il vino a Zio Marco, che poi non viene
  await apiScrivi(request, 'post', '/eventi/ev-part/cose', { id: 'c-vino-part', nome: 'Vino', quantitaNumero: 4, unita: 'bottiglie' })
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Chi porta' }).click()
  const vino = page.getByTestId('incarico').filter({ hasText: 'Vino' })
  await vino.getByRole('button', { name: 'Affida' }).click()
  await page.getByRole('dialog').getByLabel('Persona').selectOption({ label: 'Zio Marco' })
  await page.getByRole('dialog').getByRole('button', { name: 'Affida', exact: true }).click()
  await expect(vino).toContainText('Zio Marco')
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Partecipanti' }).click()
  await expect(marco).toContainText('Porta: Vino')
  await marco.getByRole('button', { name: 'Non partecipa' }).click()
  await expect(marco.getByRole('note')).toContainText('Non partecipa ma ha un incarico: Vino')
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Chi porta' }).click()
  await expect(vino.getByRole('note')).toContainText('non partecipa')
  await expect(vino).toContainText('4 bottiglie')

  // Panoramica: coperti dai confermati (Marco non c'è più): 3 adulti + 1 bambino × 0,5.
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Panoramica' }).click()
  await expect(page.getByText('3,5 equivalenti')).toBeVisible()
  await expect(page.getByRole('link', { name: 'calcolati dai partecipanti', exact: true })).toBeVisible()
})
