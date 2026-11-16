// Duplica evento ed edizioni di una ricorrenza (SPEC §25), dal telefono.
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

  await page.goto('/#/eventi/ed-2026')
  await page.getByRole('button', { name: 'Duplica evento' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByLabel('Nome del nuovo evento')).toHaveValue('Natale dai nonni 2027')
  await expect(dialogo.getByLabel('Data')).toHaveValue('2027-12-25')
  await dialogo.getByText('Copia anche i partecipanti').click()
  await foto(page, '01-duplica')
  await dialogo.getByRole('button', { name: 'Duplica' }).click()

  // Si apre la nuova edizione: stesso menù, porzioni personalizzate, partecipanti in attesa.
  await expect(page.getByRole('heading', { name: 'Natale dai nonni 2027' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Altre edizioni' })).toContainText('Natale dai nonni 2026')
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Menù' }).click()
  await expect(page.getByRole('button', { name: 'Tortellini in brodo: apri dettagli' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cappone ripieno: apri dettagli' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Partecipanti' }).click()
  const ugo = page.getByTestId('invito').filter({ hasText: 'Zio Ugo' })
  await expect(ugo.getByRole('button', { name: 'In attesa' })).toHaveAttribute('aria-pressed', 'true')
  await foto(page, '02-nuova-edizione')
})
