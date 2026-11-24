// Ingredienti di una voce del menù (SPEC §44): come nella ricetta, oppure adattati per questo evento
// (elenco completo, copiato nella voce) o ripresi da una versione usata in un altro evento. La ricetta
// non cambia mai; il procedimento resta il suo.
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, History, Pencil, RotateCcw, Scale, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { usePiatto } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Campo, Input, Textarea } from '@/components/ui/campi'
import { Conferma, Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { VariantePrecedente, VoceDelMenu } from '@/contratto/eventi.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { dataLunga } from '@/domain/tempo.ts'
import type { IngredientePiatto, VoceMenu } from '@/domain/tipi.ts'
import { EditorIngredienti } from '@/features/ricettario/EditorIngredienti'

type Variante = NonNullable<VoceDelMenu['variante']>
type Bozza = { descrizione: string; nota: string; porzioniBase: number | null; ingredienti: IngredientePiatto[] }

const nomiIngredienti = (v: Pick<Variante, 'ingredienti'>) => v.ingredienti.map((i) => i.nome).join(', ')

/**
 * Riga «Ingredienti» nella finestra della voce. `onSalvata` riceve la voce aggiornata: la finestra
 * della voce ne prende la versione, così il suo «Salva» non entra in conflitto con questa modifica.
 */
export function IngredientiVoce({ voce, solaLettura, onSalvata }: { voce: VoceDelMenu; solaLettura: boolean; onSalvata: (v: VoceMenu) => void }) {
  const puoScrivere = usePuoScrivere()
  const [modifica, setModifica] = useState(false)
  const [precedenti, setPrecedenti] = useState(false)
  const [torna, setTorna] = useState(false)
  // «Usa una versione precedente» compare solo se ce n'è almeno una accessibile.
  const elenco = useQuery({
    queryKey: ['varianti', voce.id],
    queryFn: () => api.leggi<VariantePrecedente[]>(`/voci/${voce.id}/varianti`),
    enabled: !solaLettura,
  })
  const imposta = useScrittura((variante: Bozza | null) => api.modifica<VoceMenu>(`/voci/${voce.id}/variante`, { variante, versione: voce.versione }), {
    oggetto: `«${voce.nome}»`,
    successo: (v) => (v.variante ? 'Ingredienti personalizzati salvati' : 'Di nuovo come nella ricetta'),
    dopo: onSalvata,
  })
  const v = voce.variante
  const ci = (elenco.data?.length ?? 0) > 0

  return (
    <div className="mt-3 border-t border-bordo/60 pt-3" data-testid="ingredienti-voce">
      <p className="text-sm">
        {v ? (
          <>
            <strong className="font-medium">Ingredienti personalizzati</strong>
            {v.descrizione ? ` · ${v.descrizione}` : ''} <span className="text-testo-tenue">({v.ingredienti.length})</span>
            <span className="mt-0.5 block truncate text-xs text-testo-tenue">{nomiIngredienti(v)}</span>
          </>
        ) : (
          <span className="text-testo-tenue">Ingredienti: come nella ricetta</span>
        )}
      </p>
      {!solaLettura ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variante="contorno" misura="piccolo" disabled={!puoScrivere} onClick={() => setModifica(true)}>
            {v ? <Pencil /> : <SlidersHorizontal />} {v ? 'Modifica ingredienti' : 'Adatta ingredienti'}
          </Button>
          {v ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere || imposta.inCorso} onClick={() => setTorna(true)}>
              <RotateCcw /> Torna alla ricetta
            </Button>
          ) : null}
          {ci ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => setPrecedenti(true)}>
              <History /> Usa una versione precedente
            </Button>
          ) : null}
        </div>
      ) : null}
      {modifica ? <FinestraVariante voce={voce} inCorso={imposta.inCorso} onChiudi={() => setModifica(false)} onSalva={async (b) => (await imposta.esegui(b)) && setModifica(false)} /> : null}
      {precedenti && elenco.data ? (
        <VersioniPrecedenti
          elenco={elenco.data}
          sostituisce={v !== null}
          inCorso={imposta.inCorso}
          onChiudi={() => setPrecedenti(false)}
          onScegli={async (x) => {
            // Una copia: da qui in poi indipendente da quella dell'altro evento.
            const r = await imposta.esegui({ descrizione: x.descrizione, nota: x.nota, porzioniBase: x.porzioniBase, ingredienti: x.ingredienti.map((i) => ({ ...i, id: nuovoId() })) })
            if (r) setPrecedenti(false)
          }}
        />
      ) : null}
      <Conferma
        aperta={torna}
        onCambia={setTorna}
        titolo="Tornare alla ricetta?"
        descrizione="Gli ingredienti personalizzati di questa voce (con descrizione e nota) vengono tolti; spesa e Cucina useranno di nuovo quelli della ricetta."
        etichettaConferma="Torna alla ricetta"
        onConferma={() => void imposta.esegui(null).then((r) => r && setTorna(false))}
      />
    </div>
  )
}

/** «Ingredienti per questo evento»: l'editor degli ingredienti del ricettario, più porzioni, descrizione e nota. */
function FinestraVariante({ voce, inCorso, onChiudi, onSalva }: { voce: VoceDelMenu; inCorso: boolean; onChiudi: () => void; onSalva: (b: Bozza) => void }) {
  const ricetta = usePiatto(voce.variante ? '' : (voce.piattoId ?? ''))
  if (!voce.variante && !ricetta.data) {
    return (
      <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo="Ingredienti per questo evento">
        <Caricamento />
      </Finestra>
    )
  }
  // Si parte dalla variante attuale, o da una copia degli ingredienti della ricetta (id nuovi).
  const iniziale: Bozza = voce.variante
    ? { descrizione: voce.variante.descrizione, nota: voce.variante.nota, porzioniBase: voce.variante.porzioniBase, ingredienti: voce.variante.ingredienti }
    : { descrizione: '', nota: '', porzioniBase: ricetta.data!.porzioniBase, ingredienti: ricetta.data!.ingredienti.map((i) => ({ ...i, id: nuovoId() })) }
  return <ModuloVariante voce={voce} iniziale={iniziale} inCorso={inCorso} onChiudi={onChiudi} onSalva={onSalva} />
}

function ModuloVariante({ voce, iniziale, inCorso, onChiudi, onSalva }: { voce: VoceDelMenu; iniziale: Bozza; inCorso: boolean; onChiudi: () => void; onSalva: (b: Bozza) => void }) {
  const [b, setB] = useState(iniziale)
  const [porzioniTesto, setPorzioniTesto] = useState(b.porzioniBase === null ? '' : String(b.porzioniBase).replace('.', ','))
  const puoScrivere = usePuoScrivere()
  const porzioniValide = porzioniTesto.trim() === '' || Number(porzioniTesto.replace(',', '.')) > 0
  const valida = b.ingredienti.length > 0 && porzioniValide
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Ingredienti per questo evento"
      descrizione={`${voce.nome}: valgono solo qui. La ricetta resta com'è.`}
      piede={
        <>
          <Button variante="fantasma" onClick={onChiudi}>
            Annulla
          </Button>
          <Button disabled={!valida || inCorso || !puoScrivere} onClick={() => onSalva({ ...b, descrizione: b.descrizione.trim(), nota: b.nota.trim() })}>
            {inCorso ? 'Salvataggio…' : 'Salva'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Porzioni di riferimento delle quantità ≠ porzioni della voce nel menù: due numeri ben distinti. */}
        <div className="rounded-xl border border-primario/25 bg-superficie/60 p-3" data-testid="porzioni-variante">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Scale className="size-4 shrink-0 text-primario" /> Le quantità qui sotto sono per
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="variante-porzioni"
              aria-label="Porzioni a cui si riferiscono le quantità"
              inputMode="decimal"
              className="w-24"
              value={porzioniTesto}
              onChange={(e) => {
                setPorzioniTesto(e.target.value)
                const n = Number(e.target.value.replace(',', '.'))
                setB({ ...b, porzioniBase: e.target.value.trim() === '' || !(n > 0) ? null : n })
              }}
            />
            <span className="text-sm">porzioni</span>
          </div>
          <p className="mt-2 text-xs text-testo-tenue">
            {porzioniValide ? '' : 'Numero maggiore di zero. '}
            Nel menù questa voce è per <strong className="text-testo">{formattaCoperti(voce.porzioniEffettive)} porzioni</strong>: spesa e Cucina ricalcolano le quantità.
          </p>
        </div>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Ingredienti</h3>
          <EditorIngredienti righe={b.ingredienti} onCambia={(ingredienti) => setB({ ...b, ingredienti })} />
          {b.ingredienti.length === 0 ? <p className="mt-2 text-sm text-pericolo">Serve almeno un ingrediente; per tornare alla ricetta usa «Torna alla ricetta».</p> : null}
        </section>
        <Campo etichetta="Come la chiami? (facoltativo)" htmlFor="variante-descrizione" aiuto="Per riconoscerla quando la riprendi in un altro evento.">
          <Input id="variante-descrizione" maxLength={80} placeholder="es. ricotta e sesamo" value={b.descrizione} onChange={(e) => setB({ ...b, descrizione: e.target.value })} />
        </Campo>
        <Campo etichetta="Nota per questa versione (facoltativa)" htmlFor="variante-nota" aiuto="In Cucina, sopra il procedimento. Non compare nel menù stampato.">
          <Textarea id="variante-nota" maxLength={2000} className="min-h-16" value={b.nota} onChange={(e) => setB({ ...b, nota: e.target.value })} />
        </Campo>
      </div>
    </Finestra>
  )
}

/** Le ultime varianti della stessa ricetta negli eventi visibili: si riconoscono da evento, data e descrizione. */
function VersioniPrecedenti({
  elenco,
  sostituisce,
  inCorso,
  onChiudi,
  onScegli,
}: {
  elenco: VariantePrecedente[]
  sostituisce: boolean
  inCorso: boolean
  onChiudi: () => void
  onScegli: (v: Variante) => void
}) {
  const puoScrivere = usePuoScrivere()
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Usa una versione precedente"
      descrizione={sostituisce ? 'Sostituisce gli ingredienti personalizzati di questa voce. Viene copiata: l\'altro evento non cambia.' : 'Viene copiata in questa voce: l\'altro evento non cambia.'}
    >
      <ul className="flex flex-col gap-1.5">
        {elenco.map((x) => (
          <li key={x.voceId}>
            <button
              type="button"
              disabled={inCorso || !puoScrivere}
              className="flex min-h-12 w-full flex-col items-start rounded-xl border border-bordo bg-carta px-3 py-2 text-left hover:bg-tenue disabled:opacity-50"
              onClick={() => onScegli(x.variante)}
            >
              <span className="flex flex-wrap items-center gap-x-2 text-sm">
                <strong className="font-medium">{x.eventoNome}</strong>
                <span className="flex items-center gap-1 text-xs text-testo-tenue">
                  <CalendarDays className="size-3" /> {dataLunga(x.data)}
                </span>
              </span>
              {x.variante.descrizione ? <span className="text-sm text-primario-forte">{x.variante.descrizione}</span> : null}
              <span className="block w-full truncate text-xs text-testo-tenue">{nomiIngredienti(x.variante)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Finestra>
  )
}
