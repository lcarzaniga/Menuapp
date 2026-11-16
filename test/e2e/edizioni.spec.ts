// Duplica evento, ricorrenze (SPEC §25, §28), riepilogo e confronto, dal telefono.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/edizioni'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}

test('duplica Natale come nuova edizione, con i partecipanti da riconfermare', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ed-2026', nome: 'Natale dai nonni 2026', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 12, bambini: 3, coefficienteBambini: 0.5, note: '', gruppoId: famiglia.id })).corpo
  await apiScrivi(request, 'post', '/eventi/ed-2026/voci', {
    voci: [
      { id: 'ed-v1', portataId: ev.portate[1].id, nome: 'Tortellini in brodo', porzioni: 16 },
      { id: 'ed-v2', portataId: ev.portate[2].id, nome: 'Cappone ripieno' },
    ],
  })
  await apiScrivi(request, 'post', '/eventi/ed-2026/partecipanti', { id: 'ed-p1', nome: 'Zio Ugo', stato: 'confermato' })
  await apiScrivi(request, 'post', `/famiglie/${famiglia.id}/ricorrenze`, { id: 'ed-natale', nome: 'Natale dai nonni' })

  // La ricorrenza si sceglie dalla Panoramica.
  await page.goto('/#/eventi/ed-2026')
  await page.getByLabel('Ricorrenza dell\'evento').selectOption({ label: 'Natale dai nonni' })
  await expect(page.getByText('Ricorrenza: Natale dai nonni')).toBeVisible()
  await page.getByRole('button', { name: 'Duplica evento' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByLabel('Nome del nuovo evento')).toHaveValue('Natale dai nonni 2027')
  await expect(dialogo.getByLabel('Data')).toHaveValue('2027-12-25')
  await expect(dialogo.getByLabel('Ricorrenza')).toHaveValue('ed-natale')
  await dialogo.getByText('Copia anche i partecipanti').click()
  await foto(page, '01-duplica')
  await dialogo.getByRole('button', { name: 'Duplica' }).click()

  // Si apre la nuova edizione: stesso menù, porzioni personalizzate, partecipanti in attesa.
  await expect(page.getByRole('heading', { name: 'Natale dai nonni 2027' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Altri eventi della ricorrenza' })).toContainText('Natale dai nonni 2026')
  // Sul telefono i messaggi di conferma coprono le schede: si va direttamente agli indirizzi.
  const id = /eventi\/([^/]+)/.exec(page.url())![1]!
  await page.goto(`/#/eventi/${id}/menu`)
  await expect(page.getByRole('button', { name: 'Tortellini in brodo: apri dettagli' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cappone ripieno: apri dettagli' })).toBeVisible()
  await page.goto(`/#/eventi/${id}/partecipanti`)
  const ugo = page.getByTestId('invito').filter({ hasText: 'Zio Ugo' })
  await expect(ugo.getByRole('button', { name: 'In attesa' })).toHaveAttribute('aria-pressed', 'true')
  await foto(page, '02-nuova-edizione')

  // ── Confronta con l'anno scorso: un piatto nuovo, uno tolto, quelli rimasti
  const menu = await apiLeggi<{ portate: { id: string; nome: string; voci: { id: string; nome: string; versione: number }[] }[] }>(request, `/eventi/${id}/menu`)
  const cappone = menu.portate.flatMap((p) => p.voci).find((v) => v.nome === 'Cappone ripieno')!
  await apiScrivi(request, 'delete', `/voci/${cappone.id}?versione=${cappone.versione}`)
  await apiScrivi(request, 'post', `/eventi/${id}/voci`, { voci: [{ id: 'ed-v3', portataId: menu.portate[2]!.id, nome: 'Arrosto di tacchino' }] })
  await page.goto(`/#/eventi/${id}`)
  await page.getByRole('link', { name: 'Confronta con l\'anno scorso' }).click()
  await expect(page.getByLabel('Confronta con')).toHaveValue('ed-2026')
  await expect(page.getByRole('list', { name: 'In entrambe' })).toContainText('Tortellini in brodo')
  await expect(page.getByRole('list', { name: 'Nuovi' })).toContainText('Arrosto di tacchino')
  await expect(page.getByRole('list', { name: 'Non riproposti' })).toContainText('Cappone ripieno')
  await foto(page, '04-confronto')
})

test('a che punto siamo: indicatori aggiornati e collegamenti alle sezioni', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/eventi', { id: 'ed-riep', nome: 'Compleanno di Giulia', data: '2030-05-10', oraServizio: '16:00', tipo: 'aperitivo', occasione: '', adulti: 8, bambini: 6, coefficienteBambini: 0.5, note: '', gruppoId: famiglia.id })
  await page.goto('/#/eventi/ed-riep')
  const riepilogo = page.getByRole('list', { name: 'A che punto siamo' })
  // Evento semplice: solo i coperti.
  await expect(riepilogo.getByRole('listitem')).toHaveCount(1)
  await expect(riepilogo).toContainText('11 coperti')

  await apiScrivi(request, 'post', '/eventi/ed-riep/cose', { id: 'ed-c1', nome: 'Palloncini' })
  await apiScrivi(request, 'post', '/eventi/ed-riep/partecipanti', { id: 'ed-r1', nome: 'Nonna Lina', stato: 'confermato' })
  await apiScrivi(request, 'post', '/eventi/ed-riep/partecipanti', { id: 'ed-r2', nome: 'Zio Pino' })
  await page.reload()
  await expect(riepilogo).toContainText('1 confermato, 1 in attesa')
  await expect(riepilogo).toContainText('1 cosa da portare senza nessuno')
  await foto(page, '03-a-che-punto')
  await riepilogo.getByRole('link', { name: /1 cosa da portare senza nessuno/ }).click()
  await expect(page).toHaveURL(/\/eventi\/ed-riep\/chi-porta$/)
  await page.goBack()
  await riepilogo.getByRole('link', { name: /1 confermato/ }).click()
  await expect(page).toHaveURL(/\/eventi\/ed-riep\/partecipanti$/)
})
