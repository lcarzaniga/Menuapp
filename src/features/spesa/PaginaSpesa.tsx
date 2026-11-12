// Evento — Spesa: sezioni, stati, correzioni, manuali, condivisione (SPEC F5, §10.5).
import { AlertTriangle, ArrowRightLeft, Check, CircleDot, Eye, EyeOff, Info, ListPlus, Package, Pencil, Plus, Share2, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { useReparti, useSpesa } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Input, Select } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import { usePuoScrivere } from '@/connessione/stato'
import { testoCondivisione, testoQuantitaSpesa } from '@/domain/spesa/condivisione.ts'
import { ORDINE_SEZIONI, type Sezione, type VoceLista, type VoceManuale } from '@/domain/spesa/riconciliazione.ts'
import type { Reparto, StatoSpesa } from '@/domain/tipi.ts'
import { formattaQuantita } from '@/domain/unita.ts'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { cn } from '@/lib/utils'

const TITOLI: Record<Sezione, string> = {
  da_verificare: 'Da verificare',
  da_comprare: 'Da comprare',
  facoltativi: 'Facoltativi (non inclusi)',
  ce_lho: 'Ce l\'ho',
  comprato: 'Comprato',
  non_piu_necessari: 'Non più necessari',
  nascosti: 'Nascosti',
}

const maiuscola = (s: string) => s.charAt(0).toLocaleUpperCase('it') + s.slice(1)
const q = (n: number | null, v: Pick<VoceLista, 'unita'>) => (n === null ? '' : formattaQuantita(n, v.unita, 'spesa').testo)

interface Corpo {
  stato: StatoSpesa
  quantitaUtente: number | null
  repartoId: string | null
  nascosto: boolean
  inclusa: boolean
  nota: string
  aggiornaCopertura?: boolean
}

function corpoDa(v: VoceLista, cambi: Partial<Corpo>): Corpo & { versione: number } {
  return {
    stato: v.stato,
    quantitaUtente: v.quantitaUtente,
    repartoId: v.repartoScelto,
    nascosto: v.nascosto,
    inclusa: v.inclusa,
    nota: v.nota,
    ...cambi,
    versione: v.versione,
  }
}

export function PaginaSpesa() {
  const e = useEventoCorrente()
  const spesa = useSpesa(e.id)
  const reparti = useReparti()
  const puoScrivere = usePuoScrivere()
  const [dettaglio, setDettaglio] = useState<VoceLista | null>(null)
  const [manuale, setManuale] = useState<VoceManuale | 'nuovo' | null>(null)
  const [mostraTutto, setMostraTutto] = useState(false)

  const aggiorna = useScrittura(
    (x: { v: VoceLista; corpo: Corpo & { versione: number } }) => api.modifica(`/eventi/${e.id}/spesa/righe/${encodeURIComponent(x.v.chiave)}`, x.corpo),
    { successo: null, oggetto: 'Questa riga della spesa' },
  )
  const ripulisci = useScrittura(() => api.crea<{ eliminati: number }>(`/eventi/${e.id}/spesa/ripulisci`, {}), {
    successo: (r) => (r.eliminati ? `${r.eliminati} righe vuote eliminate` : 'Niente da ripulire'),
  })

  if (spesa.isPending) return <Caricamento />
  if (!spesa.data) return <CorpoScheda><Vuoto titolo="Impossibile caricare la spesa" /></CorpoScheda>
  const s = spesa.data
  const solaLettura = s.solaLettura || e.stato === 'archiviato'
  const nomiReparto = new Map((reparti.data ?? []).map((r) => [r.id, r.nome]))

  function cambiaStato(v: VoceLista, stato: StatoSpesa) {
    void aggiorna.esegui({ v, corpo: corpoDa(v, { stato }) })
  }

  async function condividi() {
    const testo = testoCondivisione(e, s, reparti.data ?? [])
    try {
      if (navigator.share) {
        await navigator.share({ title: `Spesa — ${e.nome}`, text: testo })
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(testo)
      toast.success('Lista copiata negli appunti')
    } catch {
      toast.error('Impossibile condividere: copia non disponibile')
    }
  }

  const sezioni = ORDINE_SEZIONI.filter((sez) => mostraTutto || !['nascosti'].includes(sez))
  const vuota = s.voci.length === 0 && s.manuali.length === 0
  return (
    <CorpoScheda>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-testo-tenue">
          <strong className="text-testo">{s.contatori.da_comprare} da comprare</strong>
          {s.contatori.da_verificare ? ` · ${s.contatori.da_verificare} da verificare` : ''} · {s.contatori.comprato} comprati · {s.contatori.ce_lho} ce l'ho
        </p>
        <Button variante="contorno" misura="piccolo" onClick={() => void condividi()}>
          <Share2 /> Condividi
        </Button>
        {!solaLettura ? (
          <Button variante="contorno" misura="piccolo" disabled={!puoScrivere} onClick={() => setManuale('nuovo')}>
            <ListPlus /> Articolo
          </Button>
        ) : null}
      </div>
      {solaLettura ? <p className="mb-3 rounded-xl bg-info-tenue px-3 py-2 text-sm text-info">Evento archiviato: spesa come era al momento dell'archiviazione.</p> : null}

      {s.avvisi.length ? (
        <div className="mb-4 flex flex-col gap-1.5">
          {s.avvisi.map((a) => (
            <p key={a.voceId} className="flex items-start gap-2 rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {a.messaggio}
            </p>
          ))}
        </div>
      ) : null}

      {vuota ? (
        <Vuoto icona={<Package />} titolo="La lista è vuota" testo="Collega i piatti del menù a ricette con ingredienti, oppure aggiungi articoli a mano." />
      ) : (
        <div className="flex flex-col gap-5">
          {sezioni.map((sez) => {
            const voci = s.voci.filter((v) => v.sezione === sez)
            const manuali = s.manuali.filter((m) => m.sezione === sez)
            if (voci.length + manuali.length === 0) return null
            const perReparto = sez === 'da_comprare'
            return (
              <section key={sez} aria-label={TITOLI[sez]}>
                <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-testo-tenue">
                  {TITOLI[sez]} <span className="font-normal">({voci.length + manuali.length})</span>
                  {sez === 'non_piu_necessari' && !solaLettura ? null : null}
                </h2>
                {sez === 'da_verificare' ? (
                  <p className="mb-2 text-xs text-testo-tenue">Contributi non sommati: quantità mancanti, ricette senza porzioni base o righe da verificare. Correggi la ricetta o segnali qui.</p>
                ) : null}
                {sez === 'non_piu_necessari' ? (
                  <p className="mb-2 text-xs text-testo-tenue">Righe segnate che il menù non richiede più: restano finché non le togli tu.</p>
                ) : null}
                <ul className="flex flex-col gap-1.5">
                  {[...raggruppa(voci, manuali, perReparto, nomiReparto)].map(([reparto, elementi]) => (
                    <li key={reparto ?? 'tutti'}>
                      {reparto ? <p className="mb-1 mt-1 text-xs font-medium text-primario">{reparto}</p> : null}
                      <ul className="flex flex-col gap-1.5">
                        {elementi.map((x) =>
                          'chiave' in x ? (
                            <RigaVoce key={x.chiave} v={x} solaLettura={solaLettura} onStato={cambiaStato} onApri={() => setDettaglio(x)} eventoId={e.id} />
                          ) : (
                            <RigaManuale key={x.id} m={x} solaLettura={solaLettura} eventoId={e.id} onApri={() => setManuale(x)} />
                          ),
                        )}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {s.voci.some((v) => v.sezione === 'nascosti') ? (
          <Button variante="fantasma" misura="piccolo" onClick={() => setMostraTutto(!mostraTutto)}>
            {mostraTutto ? <EyeOff /> : <Eye />} {mostraTutto ? 'Nascondi le righe nascoste' : 'Mostra le righe nascoste'}
          </Button>
        ) : null}
        {!solaLettura ? (
          <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => void ripulisci.esegui(undefined)}>
            <Sparkles /> Ripulisci righe vuote
          </Button>
        ) : null}
      </div>
      {dettaglio ? (
        <DettaglioRiga v={dettaglio} reparti={reparti.data ?? []} solaLettura={solaLettura} eventoId={e.id} onChiudi={() => setDettaglio(null)} />
      ) : null}
      {manuale ? <ModuloManuale m={manuale === 'nuovo' ? null : manuale} eventoId={e.id} reparti={reparti.data ?? []} onChiudi={() => setManuale(null)} /> : null}
    </CorpoScheda>
  )
}

function raggruppa(voci: VoceLista[], manuali: VoceManuale[], perReparto: boolean, nomi: Map<string, string>) {
  const gruppi = new Map<string | null, (VoceLista | VoceManuale)[]>()
  const tutti = [...voci, ...manuali]
  for (const x of tutti) {
    const k = perReparto ? (nomi.get(x.repartoId ?? 'rep-altro') ?? 'Altro') : null
    gruppi.set(k, [...(gruppi.get(k) ?? []), x])
  }
  return gruppi
}

function RigaVoce({
  v,
  solaLettura,
  onStato,
  onApri,
  eventoId,
}: {
  v: VoceLista
  solaLettura: boolean
  onStato: (v: VoceLista, s: StatoSpesa) => void
  onApri: () => void
  eventoId: string
}) {
  const puoScrivere = usePuoScrivere()
  const rimuovi = useScrittura(() => api.elimina(`/eventi/${eventoId}/spesa/righe/${encodeURIComponent(v.chiave)}`, v.versione), { successo: 'Riga rimossa' })
  const trasferisci = useScrittura((a: string) => api.crea(`/eventi/${eventoId}/spesa/trasferisci`, { da: v.chiave, a, versione: v.versione }), {
    successo: 'Stato trasferito',
  })
  const coperta = useScrittura(
    () =>
      api.modifica(`/eventi/${eventoId}/spesa/righe/${encodeURIComponent(v.chiave)}`, {
        ...corpoDa(v, { aggiornaCopertura: true }),
      }),
    { successo: 'Segnato coperto anche l\'aumento' },
  )
  const fatto = v.stato === 'comprato' || v.stato === 'ce_lho'
  const spunta = v.caso !== 'R3' && fatto
  const quantita = v.caso === 'R3' ? q(v.aumento, v) : testoQuantitaSpesa(v)
  const disab = solaLettura || !puoScrivere
  return (
    <li className={cn('rounded-xl border bg-carta', v.caso === 'R3' ? 'border-avviso/50' : 'border-bordo')}>
      <div className="flex items-center gap-1 pl-1">
        <button
          type="button"
          disabled={disab || v.natura === 'orfana'}
          aria-label={spunta ? `${v.nome}: segna da comprare` : `${v.nome}: segna comprato`}
          aria-pressed={spunta}
          onClick={() => onStato(v, spunta ? 'da_comprare' : 'comprato')}
          className="flex size-12 shrink-0 items-center justify-center disabled:opacity-50"
        >
          <span className={cn('flex size-7 items-center justify-center rounded-full border-2', spunta ? 'border-successo bg-successo text-white' : 'border-bordo')}>
            {spunta ? <Check className="size-4" /> : null}
          </span>
        </button>
        <button type="button" className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-1.5 pr-2 text-left" onClick={onApri}>
          <span className={cn('leading-snug', spunta && 'text-testo-tenue line-through')}>
            {quantita ? <strong className="font-semibold tabular-nums">{v.caso === 'R3' ? `+${quantita}` : quantita}</strong> : null} {maiuscola(v.nome)}
          </span>
          <span className="flex flex-wrap items-center gap-1 text-xs text-testo-tenue">
            {v.stato === 'ce_lho' ? <Badge variante="info">ce l'ho</Badge> : null}
            {v.caso === 'R3' ? <span className="text-avviso">da integrare: segnato per {q(v.fabbisognoCoperto, v)}, ora servono {q(v.quantita, v)}</span> : null}
            {v.caso === 'R4' ? <span>il fabbisogno è sceso a {q(v.quantita, v)} (era {q(v.fabbisognoCoperto, v)} quando l'hai segnato)</span> : null}
            {v.correzione ? <span className="text-avviso">la ricetta è cambiata: calcolati ora {q(v.correzione.calcolataOra, v)}</span> : null}
            {v.quantitaUtente !== null && !v.correzione ? <span>quantità corretta a mano</span> : null}
            {v.natura === 'da_verificare' ? (
              <span>
                {v.provenienze[0]?.nomeVoce}: «{v.provenienze[0]?.testoOriginale}» — {v.motivi.join(', ')}
              </span>
            ) : null}
            {v.natura === 'orfana' ? (
              <span>
                segnato {v.stato === 'comprato' ? 'comprato' : 'ce l\'ho'}
                {v.descrizioneOrfana ? ` quando ne servivano ${v.descrizioneOrfana}` : ''}
              </span>
            ) : null}
            {v.contributiDaVerificare ? <Badge variante="avviso">+ {v.contributiDaVerificare} da verificare</Badge> : null}
            {v.nota ? <span>· {v.nota}</span> : null}
          </span>
        </button>
        {!disab && v.natura !== 'orfana' ? (
          <MenuAzioni
            etichetta={`Azioni per ${v.nome}`}
            voci={[
              { etichetta: 'Ce l\'ho', icona: <CircleDot />, onSelect: () => onStato(v, 'ce_lho'), nascosta: v.stato === 'ce_lho' },
              { etichetta: 'Da comprare', icona: <Undo2 />, onSelect: () => onStato(v, 'da_comprare'), nascosta: v.stato === 'da_comprare' },
              { etichetta: 'Dettagli e correzioni', icona: <Pencil />, onSelect: onApri },
            ]}
          />
        ) : null}
      </div>
      {v.caso === 'R3' && !disab ? (
        <div className="flex flex-wrap gap-2 border-t border-bordo px-3 py-2">
          <Button misura="piccolo" variante="contorno" onClick={() => void coperta.esegui(undefined)}>
            <Check /> Coperto anche l'aumento
          </Button>
          <Button misura="piccolo" variante="fantasma" onClick={() => onStato(v, 'da_comprare')}>
            Torna a da comprare
          </Button>
        </div>
      ) : null}
      {v.natura === 'orfana' && !disab ? (
        <div className="flex flex-wrap gap-2 border-t border-bordo px-3 py-2">
          {v.trasferibileA ? (
            <Button misura="piccolo" variante="contorno" onClick={() => void trasferisci.esegui(v.trasferibileA!.chiave)}>
              <ArrowRightLeft /> Forse corrisponde a «{maiuscola(v.trasferibileA.nome)}»: trasferisci
            </Button>
          ) : null}
          <Button misura="piccolo" variante="fantasma" onClick={() => void rimuovi.esegui(undefined)}>
            <Trash2 /> Rimuovi
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function DettaglioRiga({ v, reparti, solaLettura, eventoId, onChiudi }: { v: VoceLista; reparti: Reparto[]; solaLettura: boolean; eventoId: string; onChiudi: () => void }) {
  const confrontabile = v.natura === 'sommata' || v.natura === 'facoltativa'
  const [quantita, setQuantita] = useState(v.quantitaUtente === null ? '' : String(v.quantitaUtente).replace('.', ','))
  const [nota, setNota] = useState(v.nota)
  const [reparto, setReparto] = useState(v.repartoId)
  const puoScrivere = usePuoScrivere()
  const salva = useScrittura((c: Corpo & { versione: number }) => api.modifica(`/eventi/${eventoId}/spesa/righe/${encodeURIComponent(v.chiave)}`, c), {
    oggetto: 'Questa riga della spesa',
    dopo: onChiudi,
  })
  const n = quantita.trim() === '' ? null : Number(quantita.replace(',', '.'))
  const valida = n === null || (Number.isFinite(n) && n >= 0)
  const unitaTesto = v.unita ? formattaQuantita(2, v.unita, 'spesa').unita : 'pezzi'
  const salvaCon = (cambi: Partial<Corpo>) =>
    void salva.esegui({
      stato: v.stato,
      quantitaUtente: confrontabile ? n : null,
      repartoId: reparto === v.repartoId ? v.repartoScelto : reparto,
      nascosto: v.nascosto,
      inclusa: v.inclusa,
      nota,
      versione: v.versione,
      ...cambi,
    })
  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={maiuscola(v.nome)} descrizione={testoQuantitaSpesa(v) || undefined}>
      <div className="flex flex-col gap-3 text-sm">
        {v.provenienze.length ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <Info className="size-4" /> Da dove arriva
            </p>
            <ul className="flex flex-col gap-0.5 text-testo-tenue">
              {v.provenienze.map((p) => (
                <li key={`${p.voceId}-${p.ingredientePiattoId}`}>
                  {p.nomeVoce}: «{p.testoOriginale}»{p.quantita !== null ? ` → ${q(p.quantita, v)}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {v.stato !== 'da_comprare' && v.fabbisognoCoperto !== null ? (
          <p className="rounded-lg bg-tenue px-3 py-2">
            Segnato {v.stato === 'comprato' ? 'come comprato' : 'come «ce l\'ho»'} quando ne servivano {q(v.fabbisognoCoperto, v)}.
          </p>
        ) : null}
        {!solaLettura ? (
          <>
            {confrontabile ? (
              <Campo etichetta={`Quantità da comprare (${unitaTesto})`} htmlFor="sp-q" aiuto={`Vuoto = quantità calcolata (${q(v.quantitaCalcolata, v)})`} errore={valida ? undefined : 'Numero non valido'}>
                <Input id="sp-q" inputMode="decimal" value={quantita} placeholder={v.quantitaCalcolata === null ? '' : String(Math.round(v.quantitaCalcolata * 100) / 100).replace('.', ',')} onChange={(e) => setQuantita(e.target.value)} />
              </Campo>
            ) : null}
            <Campo etichetta="Nota" htmlFor="sp-nota" aiuto="Anche per gli acquisti parziali: «presi 2 pacchi su 3»">
              <Input id="sp-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
            <Campo etichetta="Reparto" htmlFor="sp-rep">
              <Select id="sp-rep" value={reparto} onChange={(e) => setReparto(e.target.value)}>
                {reparti.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <div className="flex flex-wrap gap-2">
              {v.natura === 'facoltativa' ? (
                <Button variante="contorno" misura="piccolo" disabled={!puoScrivere} onClick={() => salvaCon({ inclusa: !v.inclusa })}>
                  <Plus /> {v.inclusa ? 'Togli dalla spesa' : 'Aggiungi alla spesa'}
                </Button>
              ) : null}
              <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => salvaCon({ nascosto: !v.nascosto })}>
                {v.nascosto ? <Eye /> : <EyeOff />} {v.nascosto ? 'Mostra di nuovo' : 'Nascondi'}
              </Button>
            </div>
            <Button disabled={!valida || salva.inCorso || !puoScrivere} onClick={() => salvaCon({})}>
              Salva
            </Button>
          </>
        ) : null}
      </div>
    </Finestra>
  )
}

function RigaManuale({ m, solaLettura, eventoId, onApri }: { m: VoceManuale; solaLettura: boolean; eventoId: string; onApri: () => void }) {
  const puoScrivere = usePuoScrivere()
  const fatto = m.stato !== 'da_comprare'
  const aggiorna = useScrittura(
    (stato: StatoSpesa) => api.modifica(`/spesa/manuali/${m.id}`, { nome: m.nome, quantitaTesto: m.quantitaTesto, repartoId: m.repartoId, nota: m.nota, stato, versione: m.versione }),
    { successo: null, oggetto: `«${m.nome}»` },
  )
  void eventoId
  return (
    <li className="flex items-center gap-1 rounded-xl border border-bordo bg-carta pl-1">
      <button
        type="button"
        disabled={solaLettura || !puoScrivere}
        aria-label={fatto ? `${m.nome}: segna da comprare` : `${m.nome}: segna comprato`}
        aria-pressed={fatto}
        onClick={() => void aggiorna.esegui(fatto ? 'da_comprare' : 'comprato')}
        className="flex size-12 shrink-0 items-center justify-center disabled:opacity-50"
      >
        <span className={cn('flex size-7 items-center justify-center rounded-full border-2', fatto ? 'border-successo bg-successo text-white' : 'border-bordo')}>{fatto ? <Check className="size-4" /> : null}</span>
      </button>
      <button type="button" className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-1.5 pr-3 text-left" onClick={onApri} disabled={solaLettura}>
        <span className={cn(fatto && 'text-testo-tenue line-through')}>
          {m.quantitaTesto ? <strong className="font-semibold">{m.quantitaTesto}</strong> : null} {maiuscola(m.nome)}
        </span>
        <span className="text-xs text-testo-tenue">
          articolo aggiunto a mano{m.stato === 'ce_lho' ? ' · ce l\'ho' : ''}
          {m.nota ? ` · ${m.nota}` : ''}
        </span>
      </button>
    </li>
  )
}

function ModuloManuale({ m, eventoId, reparti, onChiudi }: { m: VoceManuale | null; eventoId: string; reparti: Reparto[]; onChiudi: () => void }) {
  const [id] = useState(nuovoId)
  const [d, setD] = useState({ nome: m?.nome ?? '', quantitaTesto: m?.quantitaTesto ?? '', repartoId: m?.repartoId ?? 'rep-casa-tavola', nota: m?.nota ?? '', stato: m?.stato ?? ('da_comprare' as StatoSpesa) })
  const puoScrivere = usePuoScrivere()
  const salva = useScrittura(
    () => (m ? api.modifica(`/spesa/manuali/${m.id}`, { ...d, versione: m.versione }) : api.crea(`/eventi/${eventoId}/spesa/manuali`, { id, nome: d.nome, quantitaTesto: d.quantitaTesto, repartoId: d.repartoId, nota: d.nota })),
    { oggetto: 'L\'articolo', dopo: onChiudi },
  )
  const cancella = useScrittura(() => api.elimina(`/spesa/manuali/${m!.id}`, m!.versione), { successo: 'Articolo eliminato', dopo: onChiudi })
  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={m ? 'Articolo' : 'Nuovo articolo'} descrizione="Per ciò che non viene dalle ricette: tovaglioli, ghiaccio, vino…">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (d.nome.trim()) void salva.esegui(undefined)
        }}
      >
        <Campo etichetta="Cosa" htmlFor="m-nome">
          <Input id="m-nome" autoFocus value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Quanto" htmlFor="m-q">
            <Input id="m-q" value={d.quantitaTesto} placeholder="2 sacchetti" onChange={(e) => setD({ ...d, quantitaTesto: e.target.value })} />
          </Campo>
          <Campo etichetta="Reparto" htmlFor="m-rep">
            <Select id="m-rep" value={d.repartoId} onChange={(e) => setD({ ...d, repartoId: e.target.value })}>
              {reparti.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo etichetta="Nota" htmlFor="m-nota">
          <Input id="m-nota" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
        </Campo>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {m ? (
            <Button variante="fantasma" className="text-pericolo" disabled={!puoScrivere} onClick={() => void cancella.esegui(undefined)}>
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
    </Finestra>
  )
}

