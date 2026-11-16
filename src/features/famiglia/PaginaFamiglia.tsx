// Famiglia: bacheca del gruppo e piatti più apprezzati (SPEC §20.1, §20.7).
import { Medal, Star, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useImpostazioni } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Select } from '@/components/ui/campi'
import { cn } from '@/lib/utils'
import { Bacheca } from './Bacheca'
import { useClassifica, useGruppi } from './api'

export function PaginaFamiglia() {
  const gruppi = useGruppi()
  const [parametri, setParametri] = useSearchParams()
  const scheda = parametri.get('scheda') === 'apprezzati' ? 'apprezzati' : 'bacheca'
  if (gruppi.isPending) return <Caricamento />
  const g = gruppi.data?.[0]
  if (!g) {
    return (
      <Pagina titolo="Famiglia">
        <Vuoto illustrazione="tavola" titolo="Non fai ancora parte di una famiglia" testo="Chiedi a chi gestisce l'app di aggiungerti al gruppo familiare: vedrai la bacheca e le ricette di famiglia." />
      </Pagina>
    )
  }
  return (
    <Pagina titolo={g.nome} sottotitolo={g.membri.map((m) => m.nome).join(' · ')}>
      <nav aria-label="Sezioni della famiglia" className="-mx-1 mb-4 flex gap-1 border-b border-bordo/70">
        {(
          [
            ['bacheca', 'Bacheca'],
            ['apprezzati', 'I più apprezzati'],
          ] as const
        ).map(([k, nome]) => (
          <button
            key={k}
            type="button"
            aria-current={scheda === k ? 'page' : undefined}
            onClick={() => setParametri(k === 'bacheca' ? {} : { scheda: k }, { replace: true })}
            className={cn('border-b-2 border-transparent px-3 pb-2.5 pt-1.5 text-sm font-medium text-testo-tenue', scheda === k && 'border-primario text-primario')}
          >
            {nome}
          </button>
        ))}
      </nav>
      {scheda === 'bacheca' ? <Bacheca ambito={{ tipo: 'gruppo', id: g.id }} segnaposto="Un'idea per il prossimo pranzo, una ricetta da provare, una comunicazione…" /> : <Classifica />}
    </Pagina>
  )
}

export function Stelle({ valore, dimensione = 'size-4' }: { valore: number; dimensione?: string }) {
  return (
    <span className="inline-flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(dimensione, i <= Math.round(valore) ? 'fill-oro text-oro' : 'text-bordo')} />
      ))}
    </span>
  )
}

function Classifica() {
  const imp = useImpostazioni()
  const [portata, setPortata] = useState('')
  const [anno, setAnno] = useState('')
  const c = useClassifica(portata, anno)
  const [anni] = useState(() => Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Portata" className="h-10 w-auto" value={portata} onChange={(e) => setPortata(e.target.value)}>
          <option value="">Tutte le portate</option>
          {(imp.data?.portatePredefinite ?? []).map((p) => (
            <option key={p.id} value={p.nome}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select aria-label="Periodo" className="h-10 w-auto" value={anno} onChange={(e) => setAnno(e.target.value)}>
          <option value="">Sempre</option>
          {anni.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-testo-tenue">
        Ordinati con una media prudente: con pochi voti un piatto parte da 3 stelle, così un solo 5 non supera molti voti alti. Accanto vedi la media vera e quanti hanno votato.
      </p>
      {c.isPending ? (
        <Caricamento />
      ) : !c.data?.length ? (
        <Vuoto illustrazione="taccuino" titolo="Ancora nessuna valutazione" testo="Dopo un pranzo, nel Menù dell'evento ognuno può dare da 1 a 5 stelle ai piatti serviti." />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Classifica dei piatti">
          {c.data.map((v, i) => (
            <li key={v.chiave} className="flex items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta">
              <span className="flex size-9 shrink-0 items-center justify-center">
                {i === 0 ? <Trophy className="size-6 text-oro" /> : i < 3 ? <Medal className="size-6 text-testo-tenue" /> : <span className="titolo text-lg text-testo-tenue">{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                {v.ricettaId ? (
                  <Link to={`/ricettario/${v.ricettaId}`} className="titolo block truncate text-lg font-semibold hover:text-primario">
                    {v.nome}
                  </Link>
                ) : (
                  <p className="titolo truncate text-lg font-semibold">{v.nome}</p>
                )}
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-testo-tenue">
                  <Stelle valore={v.media} dimensione="size-3.5" />
                  <span className="font-semibold text-testo">{v.media.toLocaleString('it-IT')}</span>
                  <span>
                    {v.numero} {v.numero === 1 ? 'voto' : 'voti'}
                    {v.eventi > 1 ? ` in ${v.eventi} occasioni` : ''}
                  </span>
                  {v.portata ? <span>· {v.portata}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
