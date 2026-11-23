// Bacheca (della famiglia o di un evento): un piccolo blog familiare con messaggi, foto,
// ricette segnalate, sondaggi e proposte di piatti, reazioni e commenti (SPEC §20.1–20.4).
import { BarChart3, BookOpen, Camera, Check, ChefHat, ImagePlus, MessageCircle, Pin, Send, UtensilsCrossed, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { usePiatti } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select, Textarea } from '@/components/ui/campi'
import { Conferma } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import type { Messaggio, Reazione } from '@/contratto/famiglia.ts'
import { MASSIMO_ALLEGATI, REAZIONI, SIMBOLI_REAZIONE } from '@/contratto/famiglia.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { riduciFoto } from '@/lib/immagini'
import { useEvidenzia } from '@/lib/evidenzia'
import { cn } from '@/lib/utils'
import { urlFoto } from '@/features/ricettario/FotoPiatto'
import { type AmbitoBacheca, percorsoBacheca, quando, useBacheca } from './api'

type Modo = 'messaggio' | 'sondaggio' | 'proposta'

export function Bacheca({ ambito, portate = [], segnaposto }: { ambito: AmbitoBacheca; portate?: { id: string; nome: string }[]; segnaposto?: string }) {
  const b = useBacheca(ambito)
  const { id: evidenziato, mancante } = useEvidenzia('messaggio', 'messaggio-', Boolean(b.data))
  if (b.isPending) return <Caricamento />
  if (!b.data) return <p className="py-6 text-center text-sm text-testo-tenue">Bacheca non disponibile.</p>
  return (
    <div className="flex flex-col gap-4">
      {b.data.puoScrivere ? (
        <Composizione ambito={ambito} portate={portate} segnaposto={segnaposto} />
      ) : (
        <p className="rounded-xl bg-info-tenue px-3 py-2 text-sm text-info">Puoi leggere la bacheca, ma chi organizza non ti ha abilitato a scrivere.</p>
      )}
      {mancante ? (
        <p role="status" className="rounded-xl bg-tenue px-3 py-2 text-sm text-testo-tenue">
          Il messaggio della notifica non è più disponibile: forse è stato eliminato.
        </p>
      ) : null}
      {b.data.messaggi.length === 0 ? (
        <p className="py-8 text-center text-sm text-testo-tenue">Ancora nessun messaggio. Scrivi il primo!</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Messaggi">
          {b.data.messaggi.map((m) => (
            <li key={m.id} id={`messaggio-${m.id}`}>
              <SchedaMessaggio m={m} portate={portate} evidenziato={m.id === evidenziato} puoScrivere={b.data.puoScrivere} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Composizione ────────────────────────────────────────────

function Composizione({ ambito, portate, segnaposto }: { ambito: AmbitoBacheca; portate: { id: string; nome: string }[]; segnaposto?: string }) {
  const connesso = useStatoConnessione() === 'connesso'
  const piatti = usePiatti()
  const [modo, setModo] = useState<Modo>('messaggio')
  const [testo, setTesto] = useState('')
  const [foto, setFoto] = useState<File[]>([])
  const [piattoId, setPiattoId] = useState('')
  const [conRicetta, setConRicetta] = useState(false)
  const [opzioni, setOpzioni] = useState(['', ''])
  const [multipla, setMultipla] = useState(false)
  const [risultati, setRisultati] = useState<'sempre' | 'dopo_voto' | 'alla_chiusura'>('dopo_voto')
  const [scadenza, setScadenza] = useState('')
  const [proposta, setProposta] = useState('')
  const [portataNome, setPortataNome] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const azzera = () => {
    setModo('messaggio')
    setTesto('')
    setFoto([])
    setPiattoId('')
    setConRicetta(false)
    setOpzioni(['', ''])
    setMultipla(false)
    setScadenza('')
    setProposta('')
    setPortataNome('')
  }
  const pubblica = useScrittura(
    async () => {
      const id = nuovoId()
      const corpo = {
        id,
        testo: testo.trim(),
        piattoId: modo === 'messaggio' && conRicetta && piattoId ? piattoId : null,
        ...(modo === 'sondaggio'
          ? { sondaggio: { opzioni: opzioni.map((o) => o.trim()).filter(Boolean), multipla, risultati, scadeIl: scadenza ? new Date(scadenza).getTime() : null } }
          : {}),
        ...(modo === 'proposta' ? { proposta: { nome: proposta.trim(), piattoId: piattoId || null, portataNome } } : {}),
      }
      const m = await api.crea<Messaggio>(`${percorsoBacheca(ambito)}/messaggi`, corpo)
      for (const f of foto) await api.file('POST', `/messaggi/${id}/allegati?id=${nuovoId()}`, await riduciFoto(f))
      return m
    },
    { successo: 'Pubblicato', dopo: azzera },
  )
  const pronto =
    modo === 'sondaggio' ? testo.trim() !== '' && opzioni.filter((o) => o.trim()).length >= 2 : modo === 'proposta' ? proposta.trim() !== '' : testo.trim() !== '' || foto.length > 0 || (conRicetta && piattoId !== '')
  const invia = async () => {
    setInCorso(true)
    try {
      await pubblica.esegui(undefined)
    } finally {
      setInCorso(false)
    }
  }
  const tipi: [Modo, string, typeof BarChart3][] = [
    ['messaggio', 'Messaggio', MessageCircle],
    ['sondaggio', 'Sondaggio', BarChart3],
    ...(ambito.tipo === 'evento' ? ([['proposta', 'Proponi un piatto', UtensilsCrossed]] as [Modo, string, typeof BarChart3][]) : []),
  ]
  return (
    <section aria-label="Nuovo messaggio" className="rounded-2xl border border-bordo/70 bg-carta p-3 shadow-carta">
      <div role="group" aria-label="Tipo di messaggio" className="mb-2 flex flex-wrap gap-1.5">
        {tipi.map(([m, nome, Icona]) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => setModo(m)}
            className={cn('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium', modo === m ? 'border-primario bg-primario-tenue text-primario-forte' : 'border-bordo hover:bg-tenue')}
          >
            <Icona className="size-3.5" /> {nome}
          </button>
        ))}
      </div>
      {modo === 'proposta' ? (
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <Campo etichetta="Piatto proposto" htmlFor="proposta-nome">
            <Input id="proposta-nome" value={proposta} maxLength={200} placeholder="Es. Tiramisù" onChange={(e) => setProposta(e.target.value)} />
          </Campo>
          <Campo etichetta="Portata" htmlFor="proposta-portata">
            <Select id="proposta-portata" value={portataNome} onChange={(e) => setPortataNome(e.target.value)}>
              <option value="">Qualsiasi</option>
              {portate.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etichetta="Ricetta (facoltativa)" htmlFor="proposta-ricetta" className="sm:col-span-2">
            <Select id="proposta-ricetta" value={piattoId} onChange={(e) => setPiattoId(e.target.value)}>
              <option value="">Nessuna, solo il nome</option>
              {(piatti.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.mio ? '' : ` (di ${p.proprietario.nome})`}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      ) : null}
      <label htmlFor={`testo-${ambito.id}`} className="sr-only">
        {modo === 'sondaggio' ? 'Domanda' : 'Messaggio'}
      </label>
      <Textarea
        id={`testo-${ambito.id}`}
        rows={modo === 'messaggio' ? 3 : 2}
        value={testo}
        maxLength={5000}
        placeholder={modo === 'sondaggio' ? 'La domanda, es. «Carne o pesce?»' : modo === 'proposta' ? 'Perché lo proponi? (facoltativo)' : (segnaposto ?? 'Scrivi alla famiglia…')}
        onChange={(e) => setTesto(e.target.value)}
      />
      {modo === 'sondaggio' ? (
        <div className="mt-2 flex flex-col gap-2">
          {opzioni.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Opzione ${i + 1}`} value={o} maxLength={200} placeholder={`Opzione ${i + 1}`} onChange={(e) => setOpzioni(opzioni.map((x, j) => (j === i ? e.target.value : x)))} />
              {opzioni.length > 2 ? (
                <Button variante="fantasma" misura="icona" aria-label={`Togli l'opzione ${i + 1}`} onClick={() => setOpzioni(opzioni.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
          {opzioni.length < 12 ? (
            <Button variante="fantasma" misura="piccolo" className="self-start" onClick={() => setOpzioni([...opzioni, ''])}>
              + Aggiungi un'opzione
            </Button>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Casella checked={multipla} onChange={(e) => setMultipla(e.target.checked)} /> Più risposte
            </label>
            <Select aria-label="Risultati visibili" value={risultati} onChange={(e) => setRisultati(e.target.value as typeof risultati)}>
              <option value="dopo_voto">Risultati dopo aver votato</option>
              <option value="sempre">Risultati sempre visibili</option>
              <option value="alla_chiusura">Risultati alla chiusura</option>
            </Select>
            <Input type="datetime-local" aria-label="Scadenza (facoltativa)" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
          </div>
        </div>
      ) : null}
      {modo === 'messaggio' && conRicetta ? (
        <Select aria-label="Ricetta da segnalare" className="mt-2" value={piattoId} onChange={(e) => setPiattoId(e.target.value)}>
          <option value="">Scegli una ricetta…</option>
          {(piatti.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.mio ? '' : ` (di ${p.proprietario.nome})`}
            </option>
          ))}
        </Select>
      ) : null}
      {foto.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {foto.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded-lg bg-tenue px-2 py-1 text-xs">
              <Camera className="size-3" /> {f.name.slice(0, 24)}
              <button type="button" aria-label={`Togli ${f.name}`} onClick={() => setFoto(foto.filter((_, j) => j !== i))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1">
        {modo !== 'sondaggio' ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Foto da allegare"
              onChange={(e) => {
                const nuove = [...foto, ...Array.from(e.target.files ?? [])].slice(0, MASSIMO_ALLEGATI)
                setFoto(nuove)
                e.target.value = ''
              }}
            />
            <Button variante="fantasma" misura="icona" aria-label="Aggiungi foto" disabled={foto.length >= MASSIMO_ALLEGATI} onClick={() => fileRef.current?.click()}>
              <ImagePlus />
            </Button>
          </>
        ) : null}
        {modo === 'messaggio' ? (
          <Button variante="fantasma" misura="icona" aria-label="Segnala una ricetta" aria-pressed={conRicetta} className={cn(conRicetta && 'text-primario')} onClick={() => setConRicetta(!conRicetta)}>
            <BookOpen />
          </Button>
        ) : null}
        <Button className="ml-auto" disabled={!pronto || !connesso || inCorso} onClick={() => void invia()}>
          <Send /> Pubblica
        </Button>
      </div>
    </section>
  )
}

// ── Messaggio ───────────────────────────────────────────────

function Iniziale({ nome }: { nome: string }) {
  return (
    <span aria-hidden className="titolo flex size-9 shrink-0 items-center justify-center rounded-full bg-primario-tenue text-base font-semibold text-primario-forte">
      {nome.slice(0, 1).toUpperCase()}
    </span>
  )
}

function SchedaRicetta({ p }: { p: { id: string; nome: string; fotoPrincipale: string | null; proprietario: string } }) {
  return (
    <Link to={`/ricettario/${p.id}`} className="mt-2 flex items-center gap-3 rounded-xl border border-bordo/70 bg-sfondo/60 p-2 hover:bg-tenue/60">
      {p.fotoPrincipale ? (
        <img src={urlFoto(p.fotoPrincipale)} alt="" className="size-12 rounded-lg object-cover" />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-lg bg-tenue">
          <ChefHat className="size-5 text-testo-tenue" />
        </span>
      )}
      <span className="min-w-0">
        <span className="titolo block truncate font-bold">{p.nome}</span>
        <span className="text-xs text-testo-tenue">ricetta di {p.proprietario}</span>
      </span>
    </Link>
  )
}

function SchedaMessaggio({ m, portate, evidenziato, puoScrivere }: { m: Messaggio; portate: { id: string; nome: string }[]; evidenziato: boolean; puoScrivere: boolean }) {
  const connesso = useStatoConnessione() === 'connesso'
  const [modifica, setModifica] = useState(false)
  const [testo, setTesto] = useState(m.testo)
  const [elimina, setElimina] = useState(false)
  const [foto, setFoto] = useState<string | null>(null)
  const salva = useScrittura(() => api.modifica<Messaggio>(`/messaggi/${m.id}`, { testo, versione: m.versione }), { oggetto: 'Il messaggio', successo: 'Salvato', dopo: () => setModifica(false) })
  const cancella = useScrittura(() => api.elimina(`/messaggi/${m.id}`), { successo: 'Messaggio eliminato' })
  const fissa = useScrittura((f: boolean) => api.modifica<Messaggio>(`/messaggi/${m.id}/fissato`, { fissato: f }), { successo: (x) => (x.fissato ? 'Messaggio fissato in alto' : 'Non più fissato') })
  const azioni = [
    ...(m.puoModificare && m.tipo !== 'proposta' ? [{ etichetta: 'Modifica', onSelect: () => setModifica(true) }] : []),
    ...(m.puoFissare ? [{ etichetta: m.fissato ? 'Non fissare più' : 'Fissa in alto', onSelect: () => void fissa.esegui(!m.fissato) }] : []),
    ...(m.puoEliminare ? [{ etichetta: 'Elimina', onSelect: () => setElimina(true), pericolosa: true }] : []),
  ]
  return (
    <article
      aria-label={`Messaggio di ${m.autore.nome}`}
      className={cn('rounded-2xl border bg-carta p-3 shadow-carta sm:p-4', m.fissato ? 'border-oro/70' : 'border-bordo/70', evidenziato && 'ring-2 ring-primario/50')}
    >
      <header className="flex items-start gap-2.5">
        <Iniziale nome={m.autore.nome} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-semibold">{m.autore.nome}</span>
            {m.fissato ? (
              <Badge variante="avviso">
                <Pin className="size-3" /> fissato
              </Badge>
            ) : null}
            {m.tipo === 'sondaggio' ? <Badge variante="info">sondaggio</Badge> : m.tipo === 'proposta' ? <Badge variante="primario">proposta</Badge> : null}
          </p>
          <p className="text-xs text-testo-tenue">
            {quando(m.creatoIl)}
            {m.modificatoIl ? ' · modificato' : ''}
          </p>
        </div>
        {azioni.length && connesso ? <MenuAzioni voci={azioni} etichetta={`Azioni sul messaggio di ${m.autore.nome}`} /> : null}
      </header>

      {modifica ? (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea aria-label="Testo del messaggio" value={testo} rows={3} maxLength={5000} onChange={(e) => setTesto(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variante="fantasma" misura="piccolo" onClick={() => setModifica(false)}>
              Annulla
            </Button>
            <Button misura="piccolo" disabled={salva.inCorso} onClick={() => void salva.esegui(undefined)}>
              Salva
            </Button>
          </div>
        </div>
      ) : m.testo ? (
        <p className={cn('mt-2 whitespace-pre-line break-words', m.tipo === 'sondaggio' && 'titolo text-lg font-semibold')}>{m.testo}</p>
      ) : null}

      {m.proposta ? <Proposta m={m} portate={portate} /> : null}
      {m.sondaggio ? <Sondaggio key={m.sondaggio.mieScelte.join(',')} m={m} /> : null}
      {m.piatto ? <SchedaRicetta p={m.piatto} /> : m.piattoNascosto ? <p className="mt-2 text-xs text-testo-tenue">Ricetta non disponibile per te.</p> : null}

      {m.allegati.length ? (
        <div className={cn('mt-2 grid gap-1.5', m.allegati.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {m.allegati.map((a) => (
            <button key={a} type="button" onClick={() => setFoto(a)} className="overflow-hidden rounded-xl" aria-label="Apri la foto">
              <img src={`/api/v1/allegati/${a}`} alt="" loading="lazy" className={cn('w-full object-cover', m.allegati.length === 1 ? 'max-h-96' : 'aspect-square')} />
            </button>
          ))}
        </div>
      ) : null}

      <Reazioni m={m} puoScrivere={puoScrivere} />
      <Commenti m={m} puoScrivere={puoScrivere} />

      <Conferma
        aperta={elimina}
        onCambia={setElimina}
        titolo="Eliminare il messaggio?"
        descrizione="Spariscono anche commenti, foto e voti."
        etichettaConferma="Elimina"
        pericolosa
        onConferma={() => {
          setElimina(false)
          void cancella.esegui(undefined)
        }}
      />
      {foto ? (
        <button type="button" aria-label="Chiudi la foto" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setFoto(null)}>
          <img src={`/api/v1/allegati/${foto}`} alt="" className="max-h-full max-w-full rounded-lg" />
        </button>
      ) : null}
    </article>
  )
}

function Reazioni({ m, puoScrivere }: { m: Messaggio; puoScrivere: boolean }) {
  const connesso = useStatoConnessione() === 'connesso' && puoScrivere
  const [aperte, setAperte] = useState(false)
  const reagisci = useScrittura(
    (d: { r: Reazione; attiva: boolean }) =>
      d.attiva ? api.modifica<Messaggio>(`/messaggi/${m.id}/reazioni/${d.r}`, {}) : api.elimina<Messaggio>(`/messaggi/${m.id}/reazioni/${d.r}`),
    { successo: null },
  )
  const presenti = new Map(m.reazioni.map((r) => [r.reazione, r]))
  const mostrate = aperte ? REAZIONI : REAZIONI.filter((r) => presenti.has(r))
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Reazioni">
      {mostrate.map((r) => {
        const x = presenti.get(r)
        return (
          <button
            key={r}
            type="button"
            title={x?.nomi.join(', ')}
            aria-pressed={x?.mia ?? false}
            aria-label={`${SIMBOLI_REAZIONE[r]} ${x?.numero ?? 0}${x?.nomi.length ? `: ${x.nomi.join(', ')}` : ''}`}
            disabled={!connesso || reagisci.inCorso}
            onClick={() => {
              void reagisci.esegui({ r, attiva: !x?.mia })
              setAperte(false)
            }}
            className={cn('flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm', x?.mia ? 'border-primario bg-primario-tenue' : 'border-bordo bg-carta hover:bg-tenue')}
          >
            <span>{SIMBOLI_REAZIONE[r]}</span>
            {x ? <span className="tabular-nums text-xs">{x.numero}</span> : null}
          </button>
        )
      })}
      {!aperte && connesso ? (
        <button type="button" aria-label="Aggiungi una reazione" disabled={!connesso} onClick={() => setAperte(true)} className="flex h-8 items-center rounded-full border border-dashed border-bordo px-2.5 text-sm text-testo-tenue hover:bg-tenue">
          ☺︎+
        </button>
      ) : null}
    </div>
  )
}

function Commenti({ m, puoScrivere }: { m: Messaggio; puoScrivere: boolean }) {
  const connesso = useStatoConnessione() === 'connesso'
  const [testo, setTesto] = useState('')
  const [aperti, setAperti] = useState(m.commenti.length <= 3)
  const commenta = useScrittura(() => api.crea<Messaggio>(`/messaggi/${m.id}/commenti`, { id: nuovoId(), testo }), { successo: null, dopo: () => setTesto('') })
  const togli = useScrittura((id: string) => api.elimina(`/commenti/${id}`), { successo: 'Commento eliminato' })
  const visibili = aperti ? m.commenti : m.commenti.slice(-2)
  return (
    <div className="mt-3 border-t border-bordo/60 pt-2">
      {!aperti ? (
        <button type="button" className="mb-1 text-xs text-primario" onClick={() => setAperti(true)}>
          Mostra tutti i {m.commenti.length} commenti
        </button>
      ) : null}
      {visibili.length ? (
        <ul className="flex flex-col gap-1.5" aria-label="Commenti">
          {visibili.map((c) => (
            <li key={c.id} className="group flex gap-2 text-sm">
              <span className="font-semibold">{c.autore.nome}</span>
              <span className="min-w-0 flex-1 whitespace-pre-line break-words">{c.testo}</span>
              <span className="shrink-0 text-xs text-testo-tenue">{quando(c.creatoIl)}</span>
              {(c.puoModificare || m.puoFissare) && connesso ? (
                <button type="button" aria-label={`Elimina il commento di ${c.autore.nome}`} className="shrink-0 text-testo-tenue hover:text-pericolo" onClick={() => void togli.esegui(c.id)}>
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {puoScrivere ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (testo.trim()) void commenta.esegui(undefined)
          }}
        >
          <Input aria-label="Rispondi" placeholder="Rispondi…" value={testo} maxLength={2000} className="h-9" onChange={(e) => setTesto(e.target.value)} />
          <Button type="submit" misura="iconaPiccola" aria-label="Invia il commento" disabled={!testo.trim() || !connesso || commenta.inCorso}>
            <Send />
          </Button>
        </form>
      ) : null}
    </div>
  )
}

// ── Sondaggio ───────────────────────────────────────────────

function Sondaggio({ m }: { m: Messaggio }) {
  const s = m.sondaggio!
  const connesso = useStatoConnessione() === 'connesso'
  // Selezione locale (scelta multipla) ripartendo dal voto salvato: la chiave del componente la azzera.
  const [scelte, setScelte] = useState<string[]>(s.mieScelte)
  const vota = useScrittura((opzioni: string[]) => api.modifica<Messaggio>(`/messaggi/${m.id}/voto`, { opzioni }), { successo: (x) => (x.sondaggio?.mieScelte.length ? 'Voto registrato' : 'Voto ritirato') })
  const chiudi = useScrittura(() => api.crea<Messaggio>(`/messaggi/${m.id}/chiudi`, {}), { successo: 'Sondaggio chiuso' })
  const totale = useMemo(() => s.opzioni.reduce((a, o) => a + (o.voti ?? 0), 0), [s.opzioni])
  const cambiato = JSON.stringify([...scelte].sort()) !== JSON.stringify([...s.mieScelte].sort())
  const scegli = (id: string) => {
    if (!s.puoVotare) return
    if (s.multipla) setScelte(scelte.includes(id) ? scelte.filter((x) => x !== id) : [...scelte, id])
    else void vota.esegui([id])
  }
  return (
    <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label={`Sondaggio: ${m.testo}`}>
      {s.opzioni.map((o) => {
        const mia = scelte.includes(o.id)
        const percentuale = s.risultatiVisibili && totale ? Math.round(((o.voti ?? 0) / totale) * 100) : 0
        return (
          <button
            key={o.id}
            type="button"
            role={s.multipla ? 'checkbox' : 'radio'}
            aria-checked={mia}
            disabled={!s.puoVotare || !connesso || vota.inCorso}
            onClick={() => scegli(o.id)}
            className={cn('relative overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm', mia ? 'border-primario' : 'border-bordo', s.puoVotare && 'hover:bg-tenue/60')}
          >
            {s.risultatiVisibili ? <span aria-hidden className="absolute inset-y-0 left-0 bg-primario-tenue/70" style={{ width: `${percentuale}%` }} /> : null}
            <span className="relative flex items-center gap-2">
              {mia ? <Check className="size-4 text-primario" /> : <span className={cn('size-4 border border-bordo', s.multipla ? 'rounded' : 'rounded-full')} />}
              <span className="flex-1">{o.testo}</span>
              {s.risultatiVisibili ? (
                <span className="tabular-nums text-xs text-testo-tenue" title={o.nomi.join(', ')}>
                  {o.voti} · {percentuale}%
                </span>
              ) : null}
            </span>
            {s.risultatiVisibili && o.nomi.length ? <span className="relative mt-0.5 block pl-6 text-xs text-testo-tenue">{o.nomi.join(', ')}</span> : null}
          </button>
        )
      })}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-testo-tenue">
        <span>
          {s.chiuso
            ? 'Sondaggio chiuso'
            : s.multipla
              ? 'Puoi scegliere più risposte'
              : 'Una risposta'}
          {s.votanti !== null ? ` · ${s.votanti} ${s.votanti === 1 ? 'votante' : 'votanti'}` : ''}
          {!s.risultatiVisibili ? (s.risultati === 'alla_chiusura' ? ' · risultati alla chiusura' : ' · risultati dopo il voto') : ''}
          {s.scadeIl && !s.chiuso ? ` · scade ${new Date(s.scadeIl).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        {s.multipla && s.puoVotare && cambiato ? (
          <Button misura="piccolo" disabled={vota.inCorso} onClick={() => void vota.esegui(scelte)}>
            Vota
          </Button>
        ) : null}
        {s.puoVotare && s.mieScelte.length ? (
          <button type="button" className="underline" onClick={() => void vota.esegui([])}>
            Ritira il voto
          </button>
        ) : null}
        {s.puoChiudere ? (
          <button type="button" className="underline" onClick={() => void chiudi.esegui(undefined)}>
            Chiudi il sondaggio
          </button>
        ) : null}
      </p>
    </div>
  )
}

// ── Proposta di piatto ──────────────────────────────────────

const NOMI_STATO = { in_valutazione: 'In valutazione', accettata: 'Accettata', rifiutata: 'Non accettata' } as const

function Proposta({ m, portate }: { m: Messaggio; portate: { id: string; nome: string }[] }) {
  const p = m.proposta!
  const connesso = useStatoConnessione() === 'connesso'
  const suggerita = portate.find((x) => x.nome === p.portataNome)?.id ?? portate[0]?.id ?? ''
  const [portataId, setPortataId] = useState(suggerita)
  const decidi = useScrittura((stato: 'in_valutazione' | 'accettata' | 'rifiutata') => api.modifica<Messaggio>(`/messaggi/${m.id}/decisione`, { stato }), {
    successo: (x) => NOMI_STATO[x.proposta!.stato],
  })
  const inserisci = useScrittura(() => api.crea<Messaggio>(`/messaggi/${m.id}/inserisci`, { portataId }), {
    successo: 'Aggiunto al menù',
    dopoErrore: (e) => toast.error(e.message),
  })
  return (
    <div className="mt-2 rounded-xl border border-primario/30 bg-primario-tenue/30 p-3">
      <p className="flex flex-wrap items-center gap-2">
        <UtensilsCrossed className="size-4 text-primario" />
        <span className="titolo text-lg font-bold">{p.nome}</span>
        {p.portataNome ? <span className="text-xs text-testo-tenue">per {p.portataNome}</span> : null}
        <Badge variante={p.stato === 'accettata' ? 'successo' : p.stato === 'rifiutata' ? 'pericolo' : 'neutro'} className="ml-auto">
          {NOMI_STATO[p.stato]}
          {p.decisoDa && p.stato !== 'in_valutazione' ? ` da ${p.decisoDa}` : ''}
        </Badge>
      </p>
      {p.piatto ? <SchedaRicetta p={p.piatto} /> : null}
      {p.voceId ? <p className="mt-2 text-sm text-successo">✓ Nel menù</p> : null}
      {p.puoDecidere && connesso ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!p.voceId ? (
            <>
              <Select aria-label="Portata in cui inserirlo" className="h-9 w-auto" value={portataId} onChange={(e) => setPortataId(e.target.value)}>
                {portate.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </Select>
              <Button misura="piccolo" disabled={!portataId || inserisci.inCorso} onClick={() => void inserisci.esegui(undefined)}>
                Accetta e metti nel menù
              </Button>
            </>
          ) : null}
          {p.stato !== 'rifiutata' && !p.voceId ? (
            <Button misura="piccolo" variante="contorno" onClick={() => void decidi.esegui('rifiutata')}>
              Non accettare
            </Button>
          ) : null}
          {p.stato !== 'in_valutazione' && !p.voceId ? (
            <Button misura="piccolo" variante="fantasma" onClick={() => void decidi.esegui('in_valutazione')}>
              Rimetti in valutazione
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
