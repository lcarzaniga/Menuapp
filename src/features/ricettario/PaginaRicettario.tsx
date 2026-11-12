// Ricettario: ricerca ed elenco dei piatti (SPEC §5).
import { ChevronRight, FileUp, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { usePiatti } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/campi'
import { norm } from '@/domain/testo.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { cn } from '@/lib/utils'
import { Pentola } from '@/components/Illustrazioni'
import { urlFoto } from './FotoPiatto'
import { ImportaRicetta } from './ImportaRicetta'

export function PaginaRicettario() {
  const piatti = usePiatti()
  const [cerca, setCerca] = useState('')
  const [soloVuoti, setSoloVuoti] = useState(false)
  const [importa, setImporta] = useState(false)
  const q = norm(cerca)
  const elenco = (piatti.data ?? []).filter((p) => (!q || norm(p.nome).includes(q)) && (!soloVuoti || p.numeroIngredienti === 0))
  const vuoti = (piatti.data ?? []).filter((p) => p.numeroIngredienti === 0).length
  return (
    <Pagina
      titolo="Ricettario"
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
      {vuoti > 0 ? (
        <button
          type="button"
          onClick={() => setSoloVuoti(!soloVuoti)}
          className={cn('mb-3 rounded-full border border-bordo px-3 py-1 text-sm', soloVuoti && 'border-primario bg-primario-tenue text-primario')}
        >
          Senza ingredienti ({vuoti})
        </button>
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
        <ul className="flex flex-col gap-2">
          {elenco.map((p) => (
            <li key={p.id}>
              <Link to={`/ricettario/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-bordo/70 bg-carta p-2 pr-4 shadow-carta hover:bg-tenue/60">
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
                    {p.portataSuggerita ? <span>{p.portataSuggerita}</span> : null}
                    {p.porzioniBase ? <span>per {formattaCoperti(p.porzioniBase)}</span> : <span>porzioni da indicare</span>}
                    <span>· {p.numeroIngredienti} ingredienti</span>
                    {p.daVerificare ? <Badge variante="avviso">{p.daVerificare} da verificare</Badge> : null}
                  </p>
                </div>
                <ChevronRight className="size-5 text-testo-tenue" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ImportaRicetta aperta={importa} onCambia={setImporta} />
    </Pagina>
  )
}
