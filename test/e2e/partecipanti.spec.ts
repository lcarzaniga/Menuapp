// Partecipanti, conferme e accompagnatori (SPEC §24): elenco facoltativo, +N, coperti manuali
// e calcolati con confronto, elenco in tabella (comandi solo in modifica), conferme parziali, presenze solo da chi organizza (SPEC §29.2),
// «Chi porta» con un partecipante che non viene.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, schedaEvento, senzaScorrimentoOrizzontale } from './aiuti'

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
  await expect(page.getByTestId('coperti-usati')).toHaveText('11 coperti per porzioni e spesa')
  await expect(page.getByText('Manuali', { exact: true })).toBeVisible()

  // ── Zio Marco, confermato, da solo
  await page.getByRole('button', { name: 'Aggiungi partecipante' }).click()
  let dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Zio Marco')
  await dialogo.getByLabel('Presenza').selectOption('confermato')
  await dialogo.getByRole('button', { name: 'Aggiungi' }).click()
  const marco = page.getByTestId('invito').filter({ hasText: 'Zio Marco' })
  // Fuori dalla modifica: solo nome e risposta, nessun comando.
  await expect(marco.getByRole('row')).toHaveText(/Zio Marco\s*confermato/)
  await expect(page.getByLabel('Presenza di Zio Marco')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Azioni per Zio Marco' })).toHaveCount(0)

  // ── In modifica: Zia Anna con un adulto in più (senza nome) e la piccola Sofia (con nome)
  const modifica = page.getByRole('button', { name: 'Modifica elenco' })
  await modifica.click()
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Zia Anna')
  await dialogo.getByLabel('Presenza').selectOption('confermato')
  await dialogo.getByRole('button', { name: 'Aggiungi' }).click()
  const anna = page.getByTestId('invito').filter({ hasText: 'Zia Anna' })
  await anna.getByRole('button', { name: 'Azioni per Zia Anna' }).click()
  await page.getByRole('menuitem', { name: 'Accompagnatori' }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Sofia')
  await dialogo.getByLabel('Adulto o bambino').selectOption('bambino')
  await dialogo.getByRole('button', { name: 'Aggiungi con nome' }).click()
  await expect(page.getByText('Sofia aggiunto')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Più adulti confermati' }).click()
  await dialogo.getByRole('button', { name: 'Salva' }).click()
  await expect(anna.getByTestId('accompagnatore')).toContainText('Sofia')
  await expect(anna).toContainText('+ 1 adulto (confermato) senza nome')
  // Sofia ancora da confermare: finita la modifica, l'invito di Zia Anna risulta parziale.
  await page.getByLabel('Presenza di Sofia').selectOption('in_attesa')
  await expect(page.getByLabel('Presenza di Sofia')).toHaveValue('in_attesa')
  await page.getByRole('button', { name: 'Fine' }).click()
  await expect(anna.getByRole('row').first()).toContainText('parziale')
  await expect(page.getByLabel('Presenza di Sofia')).toHaveCount(0)
  await senzaScorrimentoOrizzontale(page)
  await foto(page, '00-elenco')
  await modifica.click()
  await page.getByLabel('Presenza di Sofia').selectOption('confermato')
  await expect(page.getByLabel('Presenza di Sofia')).toHaveValue('confermato')

  // ── Io, con l'app: nessun riquadro di risposta personale, si aggiorna come gli altri inviti
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Chi', { exact: true }).selectOption({ label: io.utente.nome })
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByTestId('mio-invito')).toHaveCount(0)
  await page.getByLabel(`Presenza di ${io.utente.nome}`).selectOption('confermato')
  const totali = page.getByTestId('conteggio-partecipanti')
  await expect(totali.getByRole('listitem').first()).toContainText('5Confermati1 bambino')
  await senzaScorrimentoOrizzontale(page)
  await foto(page, '00-elenco-in-modifica')
  await page.getByRole('button', { name: 'Fine' }).click()
  // Coperti manuali indipendenti dall'elenco: si dice soltanto quanti sarebbero con i confermati.
  await expect(page.getByTestId('coperti-confermati')).toContainText('Con i confermati sarebbero 4,5')

  // ── Coperti calcolati: confronto e conferma
  await page.getByRole('button', { name: 'Cambia' }).click()
  dialogo = page.getByRole('dialog')
  await dialogo.getByText('Calcolati dai partecipanti').click()
  await expect(dialogo.getByRole('note')).toContainText('passano da 11 a 4,5')
  await dialogo.getByRole('button', { name: 'Conferma: 4,5 coperti' }).click()
  await expect(page.getByText('Automatici', { exact: true })).toBeVisible()
  await expect(page.getByTestId('coperti-usati')).toHaveText('4,5 coperti per porzioni e spesa')
  await foto(page, '01-partecipanti')

  // ── «Chi porta»: il vino a Zio Marco, che poi non viene
  await apiScrivi(request, 'post', '/eventi/ev-part/cose', { id: 'c-vino-part', nome: 'Vino', quantitaNumero: 4, unita: 'bottiglie' })
  await schedaEvento(page, 'Persone', 'Chi porta')
  const vino = page.getByTestId('incarico').filter({ hasText: 'Vino' })
  await vino.getByRole('button', { name: 'Affida' }).click()
  await page.getByRole('dialog').getByLabel('Persona').selectOption({ label: 'Zio Marco' })
  await page.getByRole('dialog').getByRole('button', { name: 'Affida', exact: true }).click()
  await expect(vino).toContainText('Zio Marco')
  await schedaEvento(page, 'Persone', 'Presenze')
  await page.getByRole('button', { name: 'Modifica elenco' }).click()
  await page.getByLabel('Presenza di Zio Marco').selectOption('assente')
  await expect(marco.getByRole('note')).toContainText('Non partecipa ma ha un incarico: Vino')
  await schedaEvento(page, 'Persone', 'Chi porta')
  await expect(vino.getByRole('note')).toContainText('non partecipa')
  await expect(vino).toContainText('4 bottiglie')

  // Panoramica: coperti dai confermati (Marco non c'è più): 3 adulti + 1 bambino × 0,5.
  await schedaEvento(page, 'Riepilogo')
  await expect(page.getByLabel('Informazioni dell\'evento')).toContainText('3,5')
  await expect(page.getByLabel('Informazioni dell\'evento')).toContainText('dai partecipanti')
})
