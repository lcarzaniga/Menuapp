// Testo della spesa da condividere (SPEC §10.5).
import { dataBreve } from '../tempo.ts'
import type { Id } from '../tipi.ts'
import { formattaQuantita } from '../unita.ts'
import type { ListaSpesa, VoceLista } from './riconciliazione.ts'

const maiuscola = (s: string) => s.charAt(0).toLocaleUpperCase('it') + s.slice(1)

export function testoQuantitaSpesa(v: Pick<VoceLista, 'quantita' | 'unita' | 'natura'>): string {
  if (v.unita === 'qb') return 'q.b.'
  if (v.quantita === null) return ''
  return formattaQuantita(v.quantita, v.unita, 'spesa').testo
}

export function testoCondivisione(
  evento: { nome: string; data: string },
  lista: ListaSpesa,
  reparti: { id: Id; nome: string }[],
): string {
  const nomeReparto = new Map(reparti.map((r) => [r.id, r.nome]))
  const righe: string[] = [`Spesa — ${evento.nome} (${dataBreve(evento.data)})`]
  const perReparto = new Map<string, string[]>()
  const aggiungi = (reparto: Id | null, testo: string) => {
    const nome = (nomeReparto.get(reparto ?? 'rep-altro') ?? 'Altro').toUpperCase()
    perReparto.set(nome, [...(perReparto.get(nome) ?? []), testo])
  }
  for (const v of lista.voci) {
    if (v.sezione !== 'da_comprare') continue
    const nota = v.nota ? ` (nota: ${v.nota})` : ''
    if (v.caso === 'R3' && v.aumento !== null) {
      aggiungi(v.repartoId, `☐ ${maiuscola(v.nome)} +${formattaQuantita(v.aumento, v.unita, 'spesa').testo} (aumento rispetto a quanto già segnato)${nota}`)
    } else {
      const q = testoQuantitaSpesa(v)
      aggiungi(v.repartoId, `☐ ${maiuscola(v.nome)}${q ? ` ${q}` : ''}${nota}`)
    }
  }
  for (const m of lista.manuali) {
    if (m.sezione !== 'da_comprare') continue
    aggiungi(m.repartoId, `☐ ${maiuscola(m.nome)}${m.quantitaTesto ? ` ${m.quantitaTesto}` : ''}${m.nota ? ` (nota: ${m.nota})` : ''}`)
  }
  for (const [reparto, voci] of perReparto) righe.push('', reparto, ...voci)
  const daVerificare = lista.voci.filter((v) => v.sezione === 'da_verificare')
  if (daVerificare.length) {
    righe.push('', 'DA VERIFICARE')
    for (const v of daVerificare) {
      const p = v.provenienze[0]
      righe.push(`☐ ${p?.nomeVoce ?? v.nome}: "${p?.testoOriginale ?? v.nome}" (${v.motivi.join(', ')})`)
    }
  }
  if (righe.length === 1) righe.push('', 'Niente da comprare.')
  return righe.join('\n')
}
