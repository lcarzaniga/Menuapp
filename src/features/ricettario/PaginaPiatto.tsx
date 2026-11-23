// Piatto: scheda, modifica, eliminazione; nuovo piatto (SPEC §5, F3–F4).
import { AlertTriangle, CalendarDays, ChefHat, Clock, Download, ImagePlus, Pencil, Settings2, Share2, Trash2, Users, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, ErroreRichiesta, nuovoId } from '@/api/client'
import { usePiatto } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { MemoriaRicetta } from './MemoriaRicetta'
import { BarraCollaborazione, GestioneProprieta, useCollaborazione } from './Collaborazione'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select, Textarea } from '@/components/ui/campi'
import { Conferma } from '@/components/ui/dialog'
import { SolaLettura, usePuoScrivere } from '@/connessione/stato'
import { CopiaInFamiglia, CopiaRicetta, FamigliaOrigineRicetta, ProvenienzaRicetta, VisibilitaRicetta } from '@/features/accesso/CondivisioneRicetta'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import type { DettaglioPiatto } from '@/contratto/ricettario.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { dataBreve } from '@/domain/tempo.ts'
import type { IngredientePiatto } from '@/domain/tipi.ts'
import { useImpostazioni } from '@/api/query'
import { EditorIngredienti, testoQuantita } from './EditorIngredienti'
import { FotoPasso, GalleriaFoto, urlFoto } from './FotoPiatto'
import { riduciFoto } from '@/lib/immagini'
import { cn } from '@/lib/utils'
import { aTesto, daPiatto } from '@/domain/ricetta/formato.ts'
import { toast } from 'sonner'

function minuti(n: number | null): string | null {
  if (n === null) return null
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function PaginaPiatto() {
  const { id = '' } = useParams()
  const [parametri, setParametri] = useSearchParams()
  const q = usePiatto(id)
  const collab = useCollaborazione(id)
  const inModifica = parametri.get('modifica') === '1'
  if (q.isPending) return <Caricamento />
  if (!q.data) {
    const assente = q.error instanceof ErroreRichiesta && q.error.stato === 404
    return (
      <Pagina titolo="Piatto" indietro="/ricettario">
        <Vuoto titolo={assente ? 'Questo piatto non esiste più' : 'Impossibile caricare il piatto'} />
      </Pagina>
    )
  }
  // Le ricette di altri si leggono e si copiano, non si modificano.
  const p = q.data
  // Il proprietario modifica; chi la ha condivisa con sé propone una modifica (SPEC §41).
  const proponi = !p.mio && collab.data?.puoProporre === true
  return inModifica && (p.mio || proponi) ? (
    <EditorPiatto piatto={p} proposta={proponi} onFine={() => setParametri({}, { replace: true })} />
  ) : (
    <SolaLettura motivo={p.mio ? null : `Ricetta di ${p.proprietario.nome}`}>
      <SchedaPiatto piatto={p} onModifica={() => setParametri({ modifica: '1' })} />
    </SolaLettura>
  )
}

function SchedaPiatto({ piatto: p, onModifica }: { piatto: DettaglioPiatto; onModifica: () => void }) {
  const naviga = useNavigate()
  const puoScrivere = usePuoScrivere()
  const [elimina, setElimina] = useState(false)
  const cancella = useScrittura(() => api.elimina(`/piatti/${p.id}`, p.versione), {
    oggetto: `«${p.nome}»`,
    successo: 'Piatto eliminato',
    dopo: () => naviga('/ricettario', { replace: true }),
  })
  const daVerificare = p.ingredienti.filter((i) => i.statoParsing === 'da_verificare').length
  const tempi = [
    ['Preparazione', minuti(p.tempoPreparazioneMin)],
    ['Cottura', minuti(p.tempoCotturaMin)],
    ['Riposo', minuti(p.tempoRiposoMin)],
  ].filter(([, v]) => v)
  return (
    <Pagina
      titolo={p.nome}
      sottotitolo={
        [
          p.portataSuggerita,
          p.soloPubblica ? `pubblica · ${p.famigliaOrigine?.nome ?? ''}` : null,
          !p.mio ? `ricetta di ${p.proprietario.nome}` : p.origineAutore ? `dalla ricetta di ${p.origineAutore}` : null,
        ]
          .filter(Boolean)
          .join(' · ') ||
        undefined
      }
      indietro="/ricettario"
      azioni={
        <>
          {p.mio ? (
            <Button variante="contorno" misura="piccolo" disabled={!puoScrivere} onClick={onModifica}>
              <Pencil /> Modifica
            </Button>
          ) : (
            <CopiaRicetta piatto={p} />
          )}
          <Button
            variante="fantasma"
            misura="iconaPiccola"
            aria-label="Gestione della ricetta"
            title="Gestione della ricetta"
            onClick={() => document.getElementById('gestione-ricetta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <Settings2 />
          </Button>
        </>
      }
    >
      {/* Ordine (restyling 2026): foto, dati essenziali, «Vista cucina»; poi collaborazione e contenuto,
          con le sezioni separate da filetti invece che chiuse in riquadri. */}
      <div className="flex flex-col gap-4">
        <GalleriaFoto piattoId={p.id} foto={p.foto} nome={p.nome} procedimento={p.procedimento} />
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variante={p.porzioniBase ? 'primario' : 'avviso'}>
            <Users className="size-3" /> {p.porzioniBase ? `per ${formattaCoperti(p.porzioniBase)} porzioni` : 'porzioni base da indicare'}
          </Badge>
          {tempi.map(([nome, v]) => (
            <Badge key={nome}>
              <Clock className="size-3" /> {nome} {v}
            </Badge>
          ))}
        </div>
        {!p.porzioniBase && p.ingredienti.length ? (
          <p className="flex items-start gap-2 rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Senza porzioni base le quantità non si possono scalare: nella spesa compariranno da verificare.
          </p>
        ) : null}
        <Button asChild misura="grande">
          <Link to={`/ricettario/${p.id}/cucina`}>
            <ChefHat /> Vista cucina
          </Link>
        </Button>
        <BarraCollaborazione piatto={p} onProponi={onModifica} />

        <section className="border-t border-bordo/70 pt-4">
          <h2 className="mb-2 titolo text-lg font-semibold text-primario">Ingredienti</h2>
          {p.ingredienti.length === 0 ? (
            <p className="text-sm text-testo-tenue">Nessun ingrediente. Tocca «Modifica» per incollarli.</p>
          ) : (
            <>
              {daVerificare ? <p className="mb-2 text-sm text-avviso">{daVerificare} da verificare</p> : null}
              <ul className="flex flex-col divide-y divide-bordo/70">
                {p.ingredienti.map((i: IngredientePiatto) => (
                  <li key={i.id} className="flex items-baseline gap-3 py-2 text-[0.9375rem]">
                    <span className="w-24 shrink-0 font-semibold tabular-nums">{testoQuantita(i)}</span>
                    <span className="flex-1">
                      {i.nome}
                      {i.nota ? <span className="text-testo-tenue">, {i.nota}</span> : null}
                      {i.facoltativo ? <span className="text-testo-tenue"> (facoltativo)</span> : null}
                    </span>
                    {i.statoParsing === 'da_verificare' ? <Badge variante="avviso">da verificare</Badge> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {p.procedimento.length ? (
          <section className="border-t border-bordo/70 pt-4">
            <h2 className="mb-2 titolo text-lg font-semibold text-primario">Procedimento</h2>
            <ol className="flex flex-col gap-3">
              {p.procedimento.map((passo, k) => (
                <li key={k} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primario-tenue text-sm font-semibold text-primario-forte">{k + 1}</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span className="whitespace-pre-line">{passo}</span>
                    <FotoPasso piattoId={p.id} foto={p.foto} passo={k} nome={p.nome} procedimento={p.procedimento} modificabile={puoScrivere} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {p.attrezzature.length ? (
          <section className="text-sm">
            <h2 className="mb-1 flex items-center gap-2 font-medium">
              <Wrench className="size-4" /> Attrezzature
            </h2>
            <p className="text-testo-tenue">{p.attrezzature.join(' · ')}</p>
          </section>
        ) : null}
        {p.note || p.fonte ? (
          <section className="border-t border-bordo/70 pt-4 text-[0.9375rem]">
            {p.note ? <p className="whitespace-pre-line">{p.note}</p> : null}
            {p.fonte ? <p className="mt-2 text-sm text-testo-tenue">Fonte: {p.fonte}</p> : null}
          </section>
        ) : null}

        {p.usatoIn.length ? (
          <section className="text-sm">
            <h2 className="mb-1 flex items-center gap-2 font-medium">
              <CalendarDays className="size-4" /> Usato in
            </h2>
            <ul className="flex flex-col gap-1">
              {p.usatoIn.map((u) => (
                <li key={u.voceId}>
                  <Link className="text-primario hover:underline" to={`/eventi/${u.eventoId}/menu`}>
                    {u.eventoNome}
                  </Link>{' '}
                  <span className="text-testo-tenue">({dataBreve(u.data)})</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Storia, ricordi ed esperienze: la memoria di famiglia della ricetta (SPEC §40). */}
        <MemoriaRicetta piatto={p} />

        {/* Gestione: ciò che si usa di rado, dopo il contenuto (SPEC §31.3). */}
        <section id="gestione-ricetta" aria-label="Gestione della ricetta" className="mt-2 flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-bordo/70 bg-tenue/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-testo-tenue">Gestione della ricetta</h2>
          <FamigliaOrigineRicetta piatto={p} />
          <GestioneProprieta piatto={p} />
          {p.provenienza ? <ProvenienzaRicetta provenienza={p.provenienza} /> : null}
          {p.mio ? <VisibilitaRicetta piatto={p} /> : null}
          <CopiaInFamiglia piatto={p} />
          <div className="flex flex-wrap gap-2">
            <Button asChild variante="contorno" misura="piccolo">
              <a href={`/api/v1/piatti/${p.id}/esporta`} download>
                <Download /> Esporta ricetta
              </a>
            </Button>
            <Button variante="contorno" misura="piccolo" onClick={() => void condividiTesto(p)}>
              <Share2 /> Condividi come testo
            </Button>
            {p.mio ? (
              <Button variante="fantasma" misura="piccolo" className="text-pericolo" disabled={!puoScrivere} onClick={() => setElimina(true)}>
                <Trash2 /> Elimina piatto
              </Button>
            ) : null}
          </div>
        </section>
      </div>
      <Conferma
        aperta={elimina}
        onCambia={setElimina}
        pericolosa
        titolo={`Eliminare «${p.nome}» dal ricettario?`}
        descrizione={
          p.usatoIn.length
            ? `È usato in ${p.usatoIn.length} voci di menù (${[...new Set(p.usatoIn.map((u) => u.eventoNome))].join(', ')}): resteranno nel menù con il loro nome, senza ricetta. Gli eventi archiviati conservano la loro copia.`
            : 'Il piatto non è usato in nessun menù.'
        }
        etichettaConferma="Elimina"
        onConferma={() => void cancella.esegui(undefined)}
      />
    </Pagina>
  )
}

async function condividiTesto(p: DettaglioPiatto) {
  const testo = aTesto(daPiatto(p))
  try {
    if (navigator.share) {
      await navigator.share({ title: p.nome, text: testo })
      return
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
  try {
    await navigator.clipboard.writeText(testo)
    toast.success('Ricetta copiata negli appunti')
  } catch {
    toast.error('Condivisione non disponibile su questo dispositivo')
  }
}

interface Bozza {
  nome: string
  portataSuggerita: string
  porzioniBase: string
  tempoPreparazioneMin: string
  tempoCotturaMin: string
  tempoRiposoMin: string
  attrezzature: string
  procedimento: string
  note: string
  fonte: string
  ingredienti: IngredientePiatto[]
}

const daNumero = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
const aNumero = (s: string) => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : Number.NaN
}
const aMinuti = (s: string) => {
  const n = aNumero(s)
  return n === null || Number.isNaN(n) ? n : Math.round(n)
}

function EditorPiatto({ piatto: p, proposta = false, onFine }: { piatto: DettaglioPiatto; proposta?: boolean; onFine: () => void }) {
  const imp = useImpostazioni()
  const puoScrivere = usePuoScrivere()
  const naviga = useNavigate()
  // Proposta (SPEC §41): stesso editor; si salva come proposta con motivazione e foto.
  const [motivazione, setMotivazione] = useState('')
  const [nuoveFoto, setNuoveFoto] = useState<{ file: File; passo: string }[]>([])
  const [togliFoto, setTogliFoto] = useState<string[]>([])
  const iniziale: Bozza = {
    nome: p.nome,
    portataSuggerita: p.portataSuggerita ?? '',
    porzioniBase: daNumero(p.porzioniBase),
    tempoPreparazioneMin: daNumero(p.tempoPreparazioneMin),
    tempoCotturaMin: daNumero(p.tempoCotturaMin),
    tempoRiposoMin: daNumero(p.tempoRiposoMin),
    attrezzature: p.attrezzature.join('\n'),
    procedimento: p.procedimento.join('\n\n'),
    note: p.note,
    fonte: p.fonte,
    ingredienti: p.ingredienti,
  }
  const [b, setB] = useState<Bozza>(iniziale)
  const modificato = JSON.stringify(b) !== JSON.stringify(iniziale)
  useEffect(() => {
    const avvisa = (e: BeforeUnloadEvent) => {
      if (modificato) e.preventDefault()
    }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [modificato])

  const contenutoBozza = () => ({
    nome: b.nome.trim(),
    portataSuggerita: b.portataSuggerita.trim() || null,
    porzioniBase: aNumero(b.porzioniBase),
    tempoPreparazioneMin: aMinuti(b.tempoPreparazioneMin),
    tempoCotturaMin: aMinuti(b.tempoCotturaMin),
    tempoRiposoMin: aMinuti(b.tempoRiposoMin),
    attrezzature: b.attrezzature.split('\n').map((s) => s.trim()).filter(Boolean),
    procedimento: b.procedimento.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
    note: b.note,
    fonte: b.fonte,
    ingredienti: b.ingredienti.map((i, k) => ({ ...i, ordine: k })),
  })
  const invia = useScrittura(
    async () => {
      const id = nuovoId()
      await api.crea(`/piatti/${p.id}/proposte`, { id, versioneBase: p.versione, contenuto: contenutoBozza(), motivazione, rimuoviFoto: togliFoto, conFoto: nuoveFoto.length > 0 })
      for (const f of nuoveFoto) {
        const q = new URLSearchParams({ id: nuovoId(), ...(f.passo ? { passo: String(Number(f.passo) - 1) } : {}) })
        await api.file('POST', `/proposte/${id}/foto?${q}`, await riduciFoto(f.file))
      }
      return id
    },
    { oggetto: `«${p.nome}»`, successo: 'Proposta inviata: il proprietario deciderà', dopo: (id) => naviga(`/ricettario/${p.id}/proposte?proposta=${id}`, { replace: true }) },
  )
  const salva = useScrittura(
    (versione: number) =>
      api.modifica<DettaglioPiatto>(`/piatti/${p.id}`, {
        nome: b.nome.trim(),
        portataSuggerita: b.portataSuggerita.trim() || null,
        porzioniBase: aNumero(b.porzioniBase),
        tempoPreparazioneMin: aMinuti(b.tempoPreparazioneMin),
        tempoCotturaMin: aMinuti(b.tempoCotturaMin),
        tempoRiposoMin: aMinuti(b.tempoRiposoMin),
        attrezzature: b.attrezzature.split('\n').map((s) => s.trim()).filter(Boolean),
        procedimento: b.procedimento.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
        note: b.note,
        fonte: b.fonte,
        ingredienti: b.ingredienti.map((i, k) => ({ ...i, ordine: k })),
        versione,
      }),
    { oggetto: `«${p.nome}»`, dopo: onFine, sovrascrivi: (_v, attuale) => (attuale as DettaglioPiatto).versione },
  )
  const porzioni = aNumero(b.porzioniBase)
  const numeriValidi = [porzioni, aMinuti(b.tempoPreparazioneMin), aMinuti(b.tempoCotturaMin), aMinuti(b.tempoRiposoMin)].every((n) => !Number.isNaN(n))
  const set = (k: keyof Bozza) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value })

  return (
    <Pagina titolo={b.nome || 'Piatto'} sottotitolo={proposta ? `Proponi una modifica a ${p.proprietario.nome}` : 'Modifica'} indietro={`/ricettario/${p.id}`}>
      <form
        data-modifiche-non-salvate={modificato}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!b.nome.trim() || !numeriValidi) return
          if (proposta) void invia.esegui(undefined)
          else void salva.esegui(p.versione)
        }}
      >
        {proposta ? (
          <p className="rounded-xl bg-tenue px-3 py-2 text-sm text-testo-tenue">
            Cambia solo ciò che vuoi proporre. La ricetta non cambia finché {p.proprietario.nome} non approva: può accettare o rifiutare ogni modifica.
          </p>
        ) : null}
        <Campo etichetta="Nome" htmlFor="p-nome">
          <Input id="p-nome" value={b.nome} onChange={set('nome')} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Porzioni base" htmlFor="p-porzioni" aiuto="Le quantità sotto valgono per queste porzioni" errore={Number.isNaN(porzioni) ? 'Numero maggiore di zero' : undefined}>
            <Input id="p-porzioni" inputMode="decimal" value={b.porzioniBase} onChange={set('porzioniBase')} placeholder="es. 6" />
          </Campo>
          <Campo etichetta="Portata" htmlFor="p-portata">
            <Select id="p-portata" value={b.portataSuggerita} onChange={set('portataSuggerita')}>
              <option value="">—</option>
              {(imp.data?.portatePredefinite ?? []).map((x) => (
                <option key={x.id} value={x.nome}>
                  {x.nome}
                </option>
              ))}
              {b.portataSuggerita && !imp.data?.portatePredefinite.some((x) => x.nome === b.portataSuggerita) ? <option value={b.portataSuggerita}>{b.portataSuggerita}</option> : null}
            </Select>
          </Campo>
        </div>

        <section>
          <h2 className="mb-2 titolo text-lg font-semibold text-primario">Ingredienti</h2>
          <EditorIngredienti righe={b.ingredienti} onCambia={(ingredienti) => setB({ ...b, ingredienti })} />
        </section>

        <Campo etichetta="Procedimento" htmlFor="p-proc" aiuto="Lascia una riga vuota fra un passaggio e l'altro">
          <Textarea id="p-proc" className="min-h-40" value={b.procedimento} onChange={set('procedimento')} />
        </Campo>
        <div className="grid grid-cols-3 gap-2">
          <Campo etichetta="Preparazione (min)" htmlFor="p-prep">
            <Input id="p-prep" inputMode="numeric" value={b.tempoPreparazioneMin} onChange={set('tempoPreparazioneMin')} />
          </Campo>
          <Campo etichetta="Cottura (min)" htmlFor="p-cott">
            <Input id="p-cott" inputMode="numeric" value={b.tempoCotturaMin} onChange={set('tempoCotturaMin')} />
          </Campo>
          <Campo etichetta="Riposo (min)" htmlFor="p-rip">
            <Input id="p-rip" inputMode="numeric" value={b.tempoRiposoMin} onChange={set('tempoRiposoMin')} />
          </Campo>
        </div>
        <Campo etichetta="Attrezzature" htmlFor="p-attr" aiuto="Una per riga">
          <Textarea id="p-attr" className="min-h-16" value={b.attrezzature} onChange={set('attrezzature')} />
        </Campo>
        <Campo etichetta="Note" htmlFor="p-note">
          <Textarea id="p-note" className="min-h-16" value={b.note} onChange={set('note')} />
        </Campo>
        <Campo etichetta="Fonte" htmlFor="p-fonte">
          <Input id="p-fonte" value={b.fonte} onChange={set('fonte')} placeholder="es. ricetta della nonna" />
        </Campo>
        {proposta ? (
          <FotoProposte piatto={p} nuove={nuoveFoto} onNuove={setNuoveFoto} togli={togliFoto} onTogli={setTogliFoto} />
        ) : null}
        {proposta ? (
          <Campo etichetta="Perché (facoltativo)" htmlFor="p-motivo" aiuto="Aiuta chi decide: cosa cambia e perché.">
            <Textarea id="p-motivo" className="min-h-16" value={motivazione} maxLength={2000} onChange={(e) => setMotivazione(e.target.value)} />
          </Campo>
        ) : null}
        <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl bg-sfondo/95 py-2 backdrop-blur md:bottom-2">
          <Button type="button" variante="contorno" onClick={onFine}>
            Annulla
          </Button>
          {proposta ? (
            <Button type="submit" className="flex-1" disabled={invia.inCorso || !b.nome.trim() || !numeriValidi || !puoScrivere || (!modificato && !nuoveFoto.length && !togliFoto.length)}>
              {invia.inCorso ? 'Invio…' : 'Invia la proposta'}
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={salva.inCorso || !b.nome.trim() || !numeriValidi || !puoScrivere}>
              {salva.inCorso ? 'Salvataggio…' : 'Salva piatto'}
            </Button>
          )}
        </div>
      </form>
    </Pagina>
  )
}

/** Foto nella proposta: nuove (anche di un passaggio) e quelle attuali da togliere. */
function FotoProposte({
  piatto: p,
  nuove,
  onNuove,
  togli,
  onTogli,
}: {
  piatto: DettaglioPiatto
  nuove: { file: File; passo: string }[]
  onNuove: (x: { file: File; passo: string }[]) => void
  togli: string[]
  onTogli: (x: string[]) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="titolo text-lg font-semibold text-primario">Foto</h2>
      {p.foto.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Foto attuali">
          {p.foto.map((f) => (
            <li key={f.id} className="flex flex-col items-center gap-1 text-xs">
              <img src={urlFoto(f.id)} alt={f.didascalia || 'Foto'} className={cn('size-20 rounded-lg object-cover', togli.includes(f.id) && 'opacity-40')} />
              <label className="flex items-center gap-1">
                <Casella checked={togli.includes(f.id)} onChange={(e) => onTogli(e.target.checked ? [...togli, f.id] : togli.filter((x) => x !== f.id))} /> Togli
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {nuove.map((f, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{f.file.name}</span>
          <Input
            aria-label={`Passaggio della foto ${f.file.name}`}
            inputMode="numeric"
            className="w-36"
            placeholder="Passaggio (facolt.)"
            value={f.passo}
            onChange={(e) => onNuove(nuove.map((x, j) => (j === i ? { ...x, passo: e.target.value.replace(/\D/g, '') } : x)))}
          />
          <Button type="button" variante="fantasma" misura="piccolo" onClick={() => onNuove(nuove.filter((_, j) => j !== i))}>
            Togli
          </Button>
        </div>
      ))}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-primario">
        <ImagePlus className="size-4" /> Proponi una foto
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onNuove([...nuove, ...[...(e.target.files ?? [])].map((file) => ({ file, passo: '' }))].slice(0, 10))} />
      </label>
    </section>
  )
}

export function PaginaNuovoPiatto() {
  const naviga = useNavigate()
  const [id] = useState(nuovoId)
  const [nome, setNome] = useState('')
  const puoScrivere = usePuoScrivere()
  // Una ricetta nuova si condivide con la Famiglia attiva (si può rendere privata dopo).
  const { attiva } = useFamigliaAttiva()
  const crea = useScrittura((n: string) => api.crea<DettaglioPiatto>('/piatti', { id, nome: n, famiglie: attiva ? [attiva.id] : [] }), {
    successo: null,
    dopo: (p) => naviga(`/ricettario/${p.id}?modifica=1`, { replace: true }),
  })
  return (
    <Pagina titolo="Nuovo piatto" indietro="/ricettario">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (nome.trim()) void crea.esegui(nome.trim())
        }}
      >
        <Campo etichetta="Nome del piatto" htmlFor="np-nome">
          <Input id="np-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Lasagne alla bolognese" />
        </Campo>
        <Button type="submit" misura="grande" disabled={!nome.trim() || crea.inCorso || !puoScrivere}>
          Continua con ingredienti e procedimento
        </Button>
      </form>
    </Pagina>
  )
}
