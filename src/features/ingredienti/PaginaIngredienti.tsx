// Catalogo ingredienti: ricerca, reparto, sinonimi, unità preferita (SPEC §5, §7.5).
import { Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useIngredienti, useReparti } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Conferma, Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import { norm } from '@/domain/testo.ts'
import { type Ingrediente, REPARTO_ALTRO } from '@/domain/tipi.ts'
import { CODICI_UNITA, type CodiceUnita, UNITA } from '@/domain/unita.ts'

export function PaginaIngredienti() {
  const ingredienti = useIngredienti()
  const reparti = useReparti()
  const [cerca, setCerca] = useState('')
  const [aperto, setAperto] = useState<Ingrediente | 'nuovo' | null>(null)
  const puoScrivere = usePuoScrivere()
  const q = norm(cerca)
  const filtrati = (ingredienti.data ?? []).filter((i) => !q || [i.nome, ...i.sinonimi].some((n) => norm(n).includes(q)))
  return (
    <Pagina
      titolo="Ingredienti"
      sottotitolo={ingredienti.data ? `${ingredienti.data.length} nel catalogo` : undefined}
      azioni={
        <Button disabled={!puoScrivere} onClick={() => setAperto('nuovo')}>
          <Plus /> Nuovo
        </Button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3.5 size-4 text-testo-tenue" />
        <Input className="pl-9" placeholder="Cerca per nome o sinonimo" aria-label="Cerca ingrediente" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      </div>
      {ingredienti.isPending || reparti.isPending ? (
        <Caricamento />
      ) : (
        <div className="flex flex-col gap-5">
          {(reparti.data ?? []).map((r) => {
            const elenco = filtrati.filter((i) => i.repartoId === r.id)
            if (elenco.length === 0) return null
            return (
              <section key={r.id}>
                <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-testo-tenue">
                  {r.nome} <span className="font-normal">({elenco.length})</span>
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {elenco.map((i) => (
                    <li key={i.id}>
                      <button type="button" className="rounded-full border border-bordo bg-carta px-3 py-1.5 text-sm hover:bg-tenue" onClick={() => setAperto(i)}>
                        {i.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {filtrati.length === 0 ? <p className="py-6 text-center text-sm text-testo-tenue">Nessun ingrediente trovato.</p> : null}
        </div>
      )}
      {aperto ? <ModuloIngrediente ingrediente={aperto === 'nuovo' ? null : aperto} nomeIniziale={cerca} onChiudi={() => setAperto(null)} /> : null}
    </Pagina>
  )
}

export function ModuloIngrediente({ ingrediente, nomeIniziale = '', onChiudi }: { ingrediente: Ingrediente | null; nomeIniziale?: string; onChiudi: (creato?: Ingrediente) => void }) {
  const reparti = useReparti()
  const puoScrivere = usePuoScrivere()
  const [id] = useState(nuovoId)
  const [d, setD] = useState({
    nome: ingrediente?.nome ?? nomeIniziale,
    sinonimi: ingrediente?.sinonimi.join(', ') ?? '',
    repartoId: ingrediente?.repartoId ?? REPARTO_ALTRO,
    unitaPreferita: ingrediente?.unitaPreferita ?? null,
    fissa: ingrediente?.scalaturaAbituale === 'fissa',
  })
  const [elimina, setElimina] = useState(false)
  const corpo = () => ({
    nome: d.nome.trim(),
    sinonimi: d.sinonimi.split(',').map((s) => s.trim()).filter(Boolean),
    repartoId: d.repartoId,
    unitaPreferita: d.unitaPreferita,
    scalaturaAbituale: d.fissa ? 'fissa' : 'proporzionale',
  })
  const salva = useScrittura(
    () => (ingrediente ? api.modifica<Ingrediente>(`/ingredienti/${ingrediente.id}`, { ...corpo(), versione: ingrediente.versione }) : api.crea<Ingrediente>('/ingredienti', { id, ...corpo() })),
    { oggetto: `«${d.nome}»`, dopo: (r) => onChiudi(r) },
  )
  const cancella = useScrittura(() => api.elimina(`/ingredienti/${ingrediente!.id}`, ingrediente!.versione), {
    oggetto: `«${ingrediente?.nome}»`,
    successo: 'Ingrediente eliminato',
    dopo: () => onChiudi(),
  })
  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={ingrediente ? ingrediente.nome : 'Nuovo ingrediente'}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (d.nome.trim()) void salva.esegui(undefined)
        }}
      >
        <Campo etichetta="Nome" htmlFor="ci-nome">
          <Input id="ci-nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} required />
        </Campo>
        <Campo etichetta="Sinonimi" htmlFor="ci-sin" aiuto="Separati da virgola: aiutano a riconoscere l'ingrediente nelle ricette">
          <Input id="ci-sin" value={d.sinonimi} onChange={(e) => setD({ ...d, sinonimi: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Reparto" htmlFor="ci-rep">
            <Select id="ci-rep" value={d.repartoId} onChange={(e) => setD({ ...d, repartoId: e.target.value })}>
              {(reparti.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etichetta="Unità preferita" htmlFor="ci-u">
            <Select id="ci-u" value={d.unitaPreferita ?? ''} onChange={(e) => setD({ ...d, unitaPreferita: (e.target.value || null) as CodiceUnita | null })}>
              <option value="">—</option>
              {CODICI_UNITA.map((u) => (
                <option key={u} value={u}>
                  {UNITA[u].plurale}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Casella checked={d.fissa} onChange={(e) => setD({ ...d, fissa: e.target.checked })} /> Di solito a quantità fissa (alloro, chiodi di garofano…)
        </label>
        {ingrediente?.sinonimi.length ? (
          <p className="flex flex-wrap gap-1">
            {ingrediente.sinonimi.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {ingrediente ? (
            <Button variante="fantasma" className="text-pericolo" disabled={!puoScrivere} onClick={() => setElimina(true)}>
              <Trash2 /> Elimina
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!d.nome.trim() || salva.inCorso || !puoScrivere}>
            Salva
          </Button>
        </div>
      </form>
      {ingrediente ? (
        <Conferma
          aperta={elimina}
          onCambia={setElimina}
          pericolosa
          titolo={`Eliminare «${ingrediente.nome}» dal catalogo?`}
          descrizione="Le ricette che lo usano lo conservano con il loro nome, scollegato dal catalogo."
          etichettaConferma="Elimina"
          onConferma={() => void cancella.esegui(undefined)}
        />
      ) : null}
    </Finestra>
  )
}
