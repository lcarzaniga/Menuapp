// Ingredienti del piatto: incolla e analizza, anteprima, correzione riga per riga (SPEC F4, §8).
import { AlertTriangle, ArrowDown, ArrowUp, Check, ClipboardPaste, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { nuovoId } from '@/api/client'
import { useIngredienti } from '@/api/query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { analizzaTesto, indicizzaCatalogo, type RigaAnalizzata } from '@/domain/parser/analizza.ts'
import { norm } from '@/domain/testo.ts'
import type { Ingrediente, IngredientePiatto, Scalatura } from '@/domain/tipi.ts'
import { CODICI_UNITA, type CodiceUnita, formattaQuantita, UNITA } from '@/domain/unita.ts'

export function daAnalisi(r: RigaAnalizzata, ordine: number): IngredientePiatto {
  return {
    id: nuovoId(),
    ordine,
    testoOriginale: r.testoOriginale,
    nome: r.nome || r.testoOriginale,
    ingredienteId: r.ingredienteId,
    quantita: r.quantita,
    quantitaMax: r.quantitaMax,
    unita: r.unita,
    scalatura: r.scalatura,
    facoltativo: r.facoltativo,
    nota: r.nota,
    statoParsing: r.statoParsing,
    problemiParsing: r.problemi,
  }
}

export function testoQuantita(i: Pick<IngredientePiatto, 'quantita' | 'quantitaMax' | 'unita'>): string {
  if (i.unita === 'qb') return 'q.b.'
  if (i.quantita === null) return ''
  const a = formattaQuantita(i.quantita, i.unita, 'cucina')
  if (i.quantitaMax === null) return a.testo
  const b = formattaQuantita(i.quantitaMax, i.unita, 'cucina')
  return `${a.numero}–${b.testo}`
}

function useIndice(catalogo: Ingrediente[] | undefined) {
  return useMemo(
    () => indicizzaCatalogo((catalogo ?? []).map((c) => ({ id: c.id, nome: c.nome, sinonimi: c.sinonimi, scalaturaAbituale: c.scalaturaAbituale }))),
    [catalogo],
  )
}

export function EditorIngredienti({ righe, onCambia }: { righe: IngredientePiatto[]; onCambia: (r: IngredientePiatto[]) => void }) {
  const catalogo = useIngredienti()
  const indice = useIndice(catalogo.data)
  const [incolla, setIncolla] = useState(false)
  const [modifica, setModifica] = useState<IngredientePiatto | null>(null)
  const nomiCatalogo = new Map((catalogo.data ?? []).map((c) => [c.id, c.nome]))

  function sposta(i: number, delta: number) {
    const r = [...righe]
    const [x] = r.splice(i, 1)
    r.splice(i + delta, 0, x!)
    onCambia(r.map((y, k) => ({ ...y, ordine: k })))
  }

  const daVerificare = righe.filter((r) => r.statoParsing === 'da_verificare').length
  return (
    <div className="flex flex-col gap-2">
      {daVerificare > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">
          <AlertTriangle className="size-4 shrink-0" /> {daVerificare} {daVerificare === 1 ? 'riga da verificare' : 'righe da verificare'}: tocca per correggere o confermare.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {righe.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1 rounded-xl border border-bordo bg-carta pl-3">
            <button type="button" className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center py-1.5 text-left" onClick={() => setModifica(r)}>
              <span className="text-sm">
                <strong className="font-semibold tabular-nums">{testoQuantita(r)}</strong> {r.nome}
                {r.nota ? <span className="text-testo-tenue">, {r.nota}</span> : null}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                {r.statoParsing === 'da_verificare' ? <Badge variante="avviso">Da verificare</Badge> : null}
                {r.facoltativo ? <Badge>Facoltativo</Badge> : null}
                {r.scalatura === 'fissa' ? <Badge variante="info">Quantità fissa</Badge> : null}
                {r.ingredienteId ? (
                  <span className="text-testo-tenue">→ {nomiCatalogo.get(r.ingredienteId) ?? 'catalogo'}</span>
                ) : (
                  <span className="text-testo-tenue">non collegato al catalogo</span>
                )}
              </span>
            </button>
            <Button variante="fantasma" misura="iconaPiccola" aria-label="Su" disabled={i === 0} onClick={() => sposta(i, -1)}>
              <ArrowUp />
            </Button>
            <Button variante="fantasma" misura="iconaPiccola" aria-label="Giù" disabled={i === righe.length - 1} onClick={() => sposta(i, 1)}>
              <ArrowDown />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variante="contorno" misura="piccolo" onClick={() => setIncolla(true)}>
          <ClipboardPaste /> Incolla ingredienti
        </Button>
        <Button
          variante="fantasma"
          misura="piccolo"
          onClick={() =>
            setModifica({
              id: nuovoId(),
              ordine: righe.length,
              testoOriginale: '',
              nome: '',
              ingredienteId: null,
              quantita: null,
              quantitaMax: null,
              unita: null,
              scalatura: 'proporzionale',
              facoltativo: false,
              nota: '',
              statoParsing: 'confermato',
              problemiParsing: [],
            })
          }
        >
          <Plus /> Aggiungi a mano
        </Button>
      </div>
      <IncollaIngredienti
        aperta={incolla}
        onCambia={setIncolla}
        indice={indice}
        onAggiungi={(nuove) => onCambia([...righe, ...nuove.map((n, k) => daAnalisi(n, righe.length + k))])}
      />
      {modifica ? (
        <ModificaRiga
          riga={modifica}
          catalogo={catalogo.data ?? []}
          indice={indice}
          nuova={!righe.some((r) => r.id === modifica.id)}
          onChiudi={() => setModifica(null)}
          onSalva={(x) => {
            const esiste = righe.some((r) => r.id === x.id)
            onCambia(esiste ? righe.map((r) => (r.id === x.id ? x : r)) : [...righe, x])
            setModifica(null)
          }}
          onElimina={() => {
            onCambia(righe.filter((r) => r.id !== modifica.id).map((y, k) => ({ ...y, ordine: k })))
            setModifica(null)
          }}
        />
      ) : null}
    </div>
  )
}

function IncollaIngredienti({
  aperta,
  onCambia,
  indice,
  onAggiungi,
}: {
  aperta: boolean
  onCambia: (a: boolean) => void
  indice: ReturnType<typeof indicizzaCatalogo>
  onAggiungi: (r: RigaAnalizzata[]) => void
}) {
  const [testo, setTesto] = useState('')
  const anteprima = useMemo(() => analizzaTesto(testo, indice), [testo, indice])
  const incerte = anteprima.filter((r) => r.statoParsing === 'da_verificare').length
  return (
    <Finestra
      aperta={aperta}
      onCambia={onCambia}
      titolo="Incolla gli ingredienti"
      descrizione="Uno per riga, con la quantità prima o dopo il nome. Le righe incerte restano segnate da verificare."
      piede={
        <Button
          disabled={anteprima.length === 0}
          onClick={() => {
            onAggiungi(anteprima)
            setTesto('')
            onCambia(false)
          }}
        >
          Aggiungi {anteprima.length || ''} {anteprima.length === 1 ? 'riga' : 'righe'}
        </Button>
      }
    >
      <Textarea
        aria-label="Ingredienti da analizzare"
        className="min-h-36 font-mono text-[15px]"
        placeholder={'500 g di farina 00\n3 uova\nsale q.b.\nburro 50 g (morbido)'}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
      />
      {anteprima.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-sm text-testo-tenue">
            Anteprima: {anteprima.length - incerte} certe{incerte ? `, ${incerte} da verificare` : ''}
          </p>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {anteprima.map((r, i) => (
              <li key={i} className="rounded-lg bg-tenue px-2.5 py-1.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <strong className="tabular-nums">{testoQuantita(r)}</strong> {r.nome || <em className="text-testo-tenue">nome mancante</em>}
                    {r.nota ? <span className="text-testo-tenue">, {r.nota}</span> : null}
                  </span>
                  {r.statoParsing === 'certo' ? <Badge variante="successo">Certo</Badge> : <Badge variante="avviso">Da verificare</Badge>}
                </div>
                <div className="text-xs text-testo-tenue">
                  «{r.testoOriginale}»{r.ingredienteId ? ' · collegato al catalogo' : r.suggerimento ? ` · forse: ${r.suggerimento.nome}` : ''}
                  {r.problemi.length ? ` · ${r.problemi.join('; ')}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Finestra>
  )
}

const NOMI_UNITA: Record<CodiceUnita, string> = Object.fromEntries(CODICI_UNITA.map((u) => [u, UNITA[u].plurale])) as Record<CodiceUnita, string>

function numero(testo: string): number | null {
  const t = testo.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
}

function ModificaRiga({
  riga,
  catalogo,
  indice,
  nuova,
  onChiudi,
  onSalva,
  onElimina,
}: {
  riga: IngredientePiatto
  catalogo: Ingrediente[]
  indice: ReturnType<typeof indicizzaCatalogo>
  nuova: boolean
  onChiudi: () => void
  onSalva: (r: IngredientePiatto) => void
  onElimina: () => void
}) {
  const [r, setR] = useState(riga)
  const [q, setQ] = useState(riga.quantita === null ? '' : String(riga.quantita).replace('.', ','))
  const [qMax, setQMax] = useState(riga.quantitaMax === null ? '' : String(riga.quantitaMax).replace('.', ','))
  const [cercaCatalogo, setCercaCatalogo] = useState('')
  const collegato = catalogo.find((c) => c.id === r.ingredienteId)
  const suggerimento = !r.ingredienteId && r.nome ? (indice.esatto.get(norm(r.nome)) ?? null) : null
  const trovati = cercaCatalogo.trim().length >= 2
    ? catalogo.filter((c) => [c.nome, ...c.sinonimi].some((n) => norm(n).includes(norm(cercaCatalogo)))).slice(0, 6)
    : []
  const qn = numero(q)
  const qm = numero(qMax)
  const valida = r.nome.trim() !== '' && !Number.isNaN(qn) && !Number.isNaN(qm) && (qm === null || (qn !== null && qm >= qn))

  function salva(conferma: boolean) {
    const unita = r.unita
    onSalva({
      ...r,
      nome: r.nome.trim(),
      quantita: unita === 'qb' ? null : qn,
      quantitaMax: unita === 'qb' ? null : qm,
      testoOriginale: r.testoOriginale || `${q} ${unita ? UNITA[unita].plurale : ''} ${r.nome}`.replace(/\s+/g, ' ').trim(),
      statoParsing: conferma || r.statoParsing === 'confermato' || nuova ? 'confermato' : r.statoParsing,
      problemiParsing: conferma || nuova ? [] : r.problemiParsing,
    })
  }

  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={nuova ? 'Nuovo ingrediente' : 'Ingrediente'}>
      <div className="flex flex-col gap-3">
        {r.testoOriginale ? (
          <p className="rounded-lg bg-tenue px-3 py-2 text-sm">
            <span className="text-testo-tenue">Testo originale:</span> «{r.testoOriginale}»
          </p>
        ) : null}
        {r.statoParsing === 'da_verificare' && r.problemiParsing.length ? (
          <p className="flex items-start gap-2 rounded-lg bg-avviso-tenue px-3 py-2 text-sm text-avviso">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {r.problemiParsing.join('; ')}
          </p>
        ) : null}
        <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
          <Campo etichetta="Quantità" htmlFor="ing-q">
            <Input id="ing-q" inputMode="decimal" value={q} disabled={r.unita === 'qb'} onChange={(e) => setQ(e.target.value)} aria-invalid={Number.isNaN(qn)} />
          </Campo>
          <Campo etichetta="Fino a" htmlFor="ing-max">
            <Input id="ing-max" inputMode="decimal" value={qMax} disabled={r.unita === 'qb'} placeholder="—" onChange={(e) => setQMax(e.target.value)} />
          </Campo>
          <Campo etichetta="Unità" htmlFor="ing-u">
            <Select id="ing-u" value={r.unita ?? ''} onChange={(e) => setR({ ...r, unita: (e.target.value || null) as CodiceUnita | null, scalatura: ['foglia', 'rametto', 'pizzico', 'qb'].includes(e.target.value) ? 'fissa' : r.scalatura })}>
              <option value="">(numero)</option>
              {CODICI_UNITA.map((u) => (
                <option key={u} value={u}>
                  {NOMI_UNITA[u]}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo etichetta="Ingrediente" htmlFor="ing-nome">
          <Input id="ing-nome" value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} />
        </Campo>
        <Campo etichetta="Nota" htmlFor="ing-nota">
          <Input id="ing-nota" value={r.nota} placeholder="tritato, a temperatura ambiente…" onChange={(e) => setR({ ...r, nota: e.target.value })} />
        </Campo>
        <div className="rounded-xl border border-bordo p-3">
          <p className="mb-1.5 text-sm font-medium">Catalogo (per la spesa)</p>
          {collegato ? (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="size-4 text-successo" /> {collegato.nome}
              <Button variante="collegamento" misura="piccolo" className="ml-auto" onClick={() => setR({ ...r, ingredienteId: null })}>
                Scollega
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {suggerimento ? (
                <Button variante="contorno" misura="piccolo" className="self-start" onClick={() => setR({ ...r, ingredienteId: suggerimento.id })}>
                  <Link2 /> Collega a «{suggerimento.nome}»
                </Button>
              ) : null}
              <Input aria-label="Cerca nel catalogo" placeholder="Cerca nel catalogo…" value={cercaCatalogo} onChange={(e) => setCercaCatalogo(e.target.value)} />
              {trovati.map((c) => (
                <button key={c.id} type="button" className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-tenue" onClick={() => setR({ ...r, ingredienteId: c.id, scalatura: c.scalaturaAbituale })}>
                  {c.nome}
                  {c.sinonimi.length ? <span className="text-xs text-testo-tenue"> · {c.sinonimi.slice(0, 3).join(', ')}</span> : null}
                </button>
              ))}
              <p className="text-xs text-testo-tenue">Senza collegamento l'ingrediente va comunque nella spesa, con il suo nome.</p>
            </div>
          )}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Casella checked={r.facoltativo} onChange={(e) => setR({ ...r, facoltativo: e.target.checked })} /> Facoltativo (non entra da solo nella spesa)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <Casella checked={r.scalatura === 'fissa'} onChange={(e) => setR({ ...r, scalatura: (e.target.checked ? 'fissa' : 'proporzionale') as Scalatura })} />
          Quantità fissa (non cambia con le porzioni)
        </label>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {!nuova ? (
            <Button variante="fantasma" className="text-pericolo" onClick={onElimina}>
              <Trash2 /> Elimina
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {r.statoParsing === 'da_verificare' ? (
              <Button variante="contorno" disabled={!valida} onClick={() => salva(false)}>
                <Pencil /> Salva, resta da verificare
              </Button>
            ) : null}
            <Button disabled={!valida} onClick={() => salva(true)}>
              <Check /> {r.statoParsing === 'da_verificare' ? 'Conferma' : 'Fatto'}
            </Button>
          </div>
        </div>
      </div>
    </Finestra>
  )
}
