// Ricettario: ricerca ed elenco dei piatti (SPEC §5).
import { ChevronRight, FileUp, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useImpostazioni, usePiatti } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/campi'
import { norm } from '@/domain/testo.ts'
import { portataDelPiatto, portateDelRicettario, rubrica } from '@/domain/ricettario.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { cn } from '@/lib/utils'
import { Pentola } from '@/components/Illustrazioni'
import { urlFoto } from './FotoPiatto'
import type { RiepilogoPiatto } from '@/contratto/ricettario.ts'
import { ImportaRicetta } from './ImportaRicetta'
import { idLettera, Rubrica } from './Rubrica'

/** Sotto questo numero di piatti l'elenco sta in poche schermate e la rubrica non serve. */
const MINIMO_RUBRICA = 10

const classeFiltro = (attivo: boolean) =>
  cn(
    'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors',
    attivo ? 'border-primario bg-primario text-primario-testo' : 'border-bordo bg-carta hover:bg-tenue',
  )

export function PaginaRicettario() {
  const piatti = usePiatti()
  const imp = useImpostazioni()
  const [parametri, setParametri] = useSearchParams()
  const [cerca, setCerca] = useState('')
  const [soloVuoti, setSoloVuoti] = useState(false)
  const [soloMie, setSoloMie] = useState(false)
  const [importa, setImporta] = useState(false)
  const tutti = useMemo(() => piatti.data ?? [], [piatti.data])
  const predefinite = useMemo(() => (imp.data?.portatePredefinite ?? []).map((p) => p.nome), [imp.data])
  const portate = useMemo(() => portateDelRicettario(tutti, predefinite), [tutti, predefinite])
  // La portata scelta resta nell'indirizzo: tornando da un piatto il filtro è ancora lì.
  const scelta = parametri.get('portata')
  const portata = portate.some((p) => p.nome === scelta) ? scelta : null
  const scegli = (nome: string | null) => setParametri(nome ? { portata: nome } : {}, { replace: true })
  const q = norm(cerca)
  const elenco = useMemo(
    () =>
      tutti.filter(
        (p) => (!q || norm(p.nome).includes(q)) && (!soloVuoti || p.numeroIngredienti === 0) && (!soloMie || p.mio) && (!portata || portataDelPiatto(p.portataSuggerita, predefinite) === portata),
      ),
    [tutti, q, soloVuoti, soloMie, portata, predefinite],
  )
  const gruppi = useMemo(() => rubrica(elenco), [elenco])
  const lettere = useMemo(() => gruppi.map((g) => g.lettera), [gruppi])
  const vuoti = tutti.filter((p) => p.numeroIngredienti === 0).length
  return (
    <Pagina
      titolo="Ricettario"
      sottotitolo={tutti.length ? `${tutti.length} ${tutti.length === 1 ? 'piatto' : 'piatti'}` : undefined}
      azioni={
        <>
          <Button variante="contorno" onClick={() => setImporta(true)}>
            <FileUp /> Importa
          </Button>
          <Button asChild>
            <Link to="/ricettario/nuovo">
              <Plus /> Nuovo
            </Link>
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-3.5 size-4 text-testo-tenue" />
        <Input className="pl-9" placeholder="Cerca un piatto" aria-label="Cerca un piatto" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      </div>
      {portate.length > 1 || vuoti > 0 || tutti.some((p) => !p.mio) ? (
        <div role="group" aria-label="Filtra per portata" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {portate.length > 1 ? (
            <>
              <button type="button" aria-pressed={!portata} onClick={() => scegli(null)} className={classeFiltro(!portata)}>
                Tutte
              </button>
              {portate.map((p) => (
                <button key={p.nome} type="button" aria-pressed={portata === p.nome} onClick={() => scegli(portata === p.nome ? null : p.nome)} className={classeFiltro(portata === p.nome)}>
                  {p.nome} <span className="tabular-nums opacity-70">{p.numero}</span>
                </button>
              ))}
            </>
          ) : null}
          {tutti.some((p) => !p.mio) ? (
            <button type="button" aria-pressed={soloMie} onClick={() => setSoloMie(!soloMie)} className={cn(classeFiltro(soloMie), 'border-dashed', soloMie && 'border-solid')}>
              Solo le mie
            </button>
          ) : null}
          {vuoti > 0 ? (
            <button
              type="button"
              aria-pressed={soloVuoti}
              onClick={() => setSoloVuoti(!soloVuoti)}
              className={cn(classeFiltro(false), 'border-dashed', soloVuoti && 'border-solid border-avviso bg-avviso-tenue text-avviso')}
            >
              Senza ingredienti <span className="tabular-nums opacity-70">{vuoti}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {piatti.isPending ? (
        <Caricamento />
      ) : !piatti.data?.length ? (
        <Vuoto
          illustrazione="ricettario"
          titolo="Il ricettario è vuoto"
          testo="Aggiungi un piatto da qui, oppure da una voce del menù con «Crea nel ricettario»."
        />
      ) : elenco.length === 0 ? (
        <p className="py-6 text-center text-sm text-testo-tenue">Nessun piatto trovato.</p>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {gruppi.map((g) => (
              <section key={g.lettera} id={idLettera(g.lettera)} aria-label={`Lettera ${g.lettera}`} className="mb-3">
                <h2 className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-sfondo/90 px-1 pb-1.5 pt-1 backdrop-blur">
                  <span className="titolo w-7 text-2xl font-semibold leading-none text-primario">{g.lettera}</span>
                  <span className="filetto flex-1" />
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.piatti.map((p) => (
                    <li key={p.id}>
                      <RigaPiatto piatto={p} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {elenco.length >= MINIMO_RUBRICA && gruppi.length > 1 ? <Rubrica lettere={lettere} /> : null}
        </div>
      )}
      <ImportaRicetta aperta={importa} onCambia={setImporta} />
    </Pagina>
  )
}

function RigaPiatto({ piatto: p }: { piatto: RiepilogoPiatto }) {
  return (
    <Link to={`/ricettario/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-2 pr-3 shadow-carta hover:bg-tenue/60">
      {p.fotoPrincipale ? (
        <img src={urlFoto(p.fotoPrincipale)} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-tenue/70">
          <Pentola className="h-12 w-auto opacity-80" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="titolo truncate text-lg font-semibold">{p.nome}</p>
        <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-testo-tenue">
          {!p.mio ? <Badge variante="info">di {p.proprietario.nome}</Badge> : p.visibilita === 'privata' ? <Badge>{p.condiviso ? 'privata, condivisa' : 'privata'}</Badge> : null}
          {p.portataSuggerita ? <span>{p.portataSuggerita}</span> : null}
          {p.porzioniBase ? <span>per {formattaCoperti(p.porzioniBase)}</span> : <span>porzioni da indicare</span>}
          <span>· {p.numeroIngredienti} ingredienti</span>
          {p.daVerificare ? <Badge variante="avviso">{p.daVerificare} da verificare</Badge> : null}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-testo-tenue" />
    </Link>
  )
}
