// Memoria di famiglia della ricetta (SPEC §40): la storia (del proprietario, pubblicabile con la
// ricetta), i ricordi dei familiari e le esperienze di preparazione, con autore, data e foto.
import { useQuery } from '@tanstack/react-query'
import { BookHeart, CalendarDays, ImagePlus, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Select, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { useStatoConnessione } from '@/connessione/stato'
import type { Memoria, MemoriaRicetta as DatiMemoria } from '@/contratto/memoria.ts'
import type { DettaglioPiatto } from '@/contratto/ricettario.ts'
import { riduciFoto } from '@/lib/immagini'
import { urlFoto } from './FotoPiatto'

/**
 * La scheda di una ricetta altrui è in sola lettura, ma ricordi ed esperienze li scrivono anche i
 * familiari: qui conta solo la connessione; i permessi li applica il server (e li dice `puoContribuire`).
 */
const usePuoScrivere = () => useStatoConnessione() === 'connesso'

const quando = (ms: number) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(ms)

export function MemoriaRicetta({ piatto }: { piatto: DettaglioPiatto }) {
  const q = useQuery({ queryKey: ['memoria', piatto.id], queryFn: () => api.leggi<DatiMemoria>(`/piatti/${piatto.id}/memoria`) })
  const [storia, setStoria] = useState(false)
  const [nuova, setNuova] = useState<'ricordo' | 'esperienza' | null>(null)
  const puoScrivere = usePuoScrivere()
  const d = q.data
  if (!d) return null
  // Chi legge solo la ricetta pubblica vede al più la storia pubblicata.
  if (d.soloPubblica && !d.storia) return null
  return (
    <section aria-label="Memoria di famiglia" className="flex flex-col gap-4 rounded-2xl border border-bordo/70 bg-carta p-4 shadow-carta" data-testid="memoria-ricetta">
      <h2 className="flex items-center gap-2 font-medium">
        <BookHeart className="size-4 text-primario" /> Memoria di famiglia
      </h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold uppercase tracking-wide text-testo-tenue">Storia della ricetta</h3>
          {d.puoScrivereStoria ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => setStoria(true)}>
              <Pencil /> {d.storia ? 'Modifica' : 'Scrivi'}
            </Button>
          ) : null}
        </div>
        {d.storia?.testo || d.storia?.foto.length ? (
          <div data-testid="storia-ricetta">
            <p className="whitespace-pre-line text-sm leading-relaxed">{d.storia.testo}</p>
            <Foto m={d.storia} />
            {d.storia.pubblica && !d.soloPubblica ? <p className="mt-1 text-xs text-testo-tenue">Pubblicata con la ricetta</p> : null}
          </div>
        ) : (
          <p className="text-sm text-testo-tenue">{d.puoScrivereStoria ? 'Le origini, le tradizioni, le persone legate a questa ricetta.' : 'Nessuna storia, per ora.'}</p>
        )}
      </div>

      {d.soloPubblica ? null : (
        <>
          <Elenco
            titolo="Ricordi"
            vuoto="Un pranzo, una persona, un profumo: i ricordi dei familiari legati a questa ricetta."
            memorie={d.ricordi}
            azione={d.puoContribuire ? () => setNuova('ricordo') : null}
            etichettaAzione="Aggiungi un ricordo"
          />
          <Elenco
            titolo="Esperienze di preparazione"
            vuoto="Com'è venuta, quanta ne serviva, cosa cambiare la prossima volta. Non modifica la ricetta."
            memorie={d.esperienze}
            azione={d.puoContribuire ? () => setNuova('esperienza') : null}
            etichettaAzione="Aggiungi un'esperienza"
          />
        </>
      )}
      {storia ? <ScriviStoria piatto={piatto} d={d} onChiudi={() => setStoria(false)} /> : null}
      {nuova ? <NuovaMemoria piatto={piatto} tipo={nuova} onChiudi={() => setNuova(null)} /> : null}
    </section>
  )
}

function Elenco({ titolo, vuoto, memorie, azione, etichettaAzione }: { titolo: string; vuoto: string; memorie: Memoria[]; azione: (() => void) | null; etichettaAzione: string }) {
  const puoScrivere = usePuoScrivere()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold uppercase tracking-wide text-testo-tenue">{titolo}</h3>
        {azione ? (
          <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={azione}>
            <Plus /> {etichettaAzione}
          </Button>
        ) : null}
      </div>
      {memorie.length ? (
        <ul className="flex flex-col gap-3" aria-label={titolo}>
          {memorie.map((m) => (
            <Contributo key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-testo-tenue">{vuoto}</p>
      )}
    </div>
  )
}

function Contributo({ m }: { m: Memoria }) {
  const [modifica, setModifica] = useState(false)
  const puoScrivere = usePuoScrivere()
  const elimina = useScrittura(() => api.elimina(`/memorie/${m.id}`, m.versione), { successo: 'Eliminato' })
  return (
    <li className="rounded-xl bg-tenue/50 px-3 py-2.5" data-testid="contributo-memoria">
      <p className="whitespace-pre-line text-sm leading-relaxed">{m.testo}</p>
      <Foto m={m} />
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-testo-tenue">
        <span>
          {m.autore.nome} · {quando(m.creatoIl)}
        </span>
        {m.evento ? (
          <Link to={`/eventi/${m.evento.id}`} className="flex items-center gap-1 text-primario hover:underline">
            <CalendarDays className="size-3" /> {m.evento.nome}
          </Link>
        ) : null}
        <span className="ml-auto flex gap-1">
          {m.puoModificare ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere} onClick={() => setModifica(true)}>
              <Pencil /> Modifica
            </Button>
          ) : null}
          {m.puoEliminare ? (
            <Button variante="fantasma" misura="piccolo" disabled={!puoScrivere || elimina.inCorso} onClick={() => void elimina.esegui(undefined)}>
              <Trash2 /> Elimina
            </Button>
          ) : null}
        </span>
      </p>
      {modifica ? <ModificaMemoria m={m} onChiudi={() => setModifica(false)} /> : null}
    </li>
  )
}

function Foto({ m }: { m: Memoria }) {
  if (!m.foto.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {m.foto.map((f) => (
        <a key={f.id} href={urlFoto(f.id)} target="_blank" rel="noreferrer">
          <img src={urlFoto(f.id)} alt={f.didascalia || 'Foto'} loading="lazy" className="size-24 rounded-lg object-cover sm:size-28" />
        </a>
      ))}
    </div>
  )
}

/** Foto scelte nel modulo, caricate dopo aver salvato il contributo (ridotte come quelle delle ricette). */
function SceltaFoto({ file, onCambia }: { file: File[]; onCambia: (f: File[]) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-primario">
      <ImagePlus className="size-4" /> {file.length ? `${file.length} ${file.length === 1 ? 'foto scelta' : 'foto scelte'}` : 'Aggiungi foto'}
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onCambia([...(e.target.files ?? [])].slice(0, 10))} />
    </label>
  )
}

async function caricaFoto(memoriaId: string, file: File[]) {
  for (const f of file) await api.file('POST', `/memorie/${memoriaId}/foto?id=${nuovoId()}`, await riduciFoto(f))
}

function ScriviStoria({ piatto, d, onChiudi }: { piatto: DettaglioPiatto; d: DatiMemoria; onChiudi: () => void }) {
  const [testo, setTesto] = useState(d.storia?.testo ?? '')
  const [pubblica, setPubblica] = useState(d.storia?.pubblica ?? false)
  const [file, setFile] = useState<File[]>([])
  const ricettaPubblica = piatto.visibilita === 'pubblica'
  const salva = useScrittura(
    async () => {
      const r = await api.modifica<DatiMemoria>(`/piatti/${piatto.id}/storia`, { testo, pubblica: pubblica && ricettaPubblica, ...(d.storia ? { versione: d.storia.versione } : {}) })
      if (r.storia && file.length) await caricaFoto(r.storia.id, file)
    },
    { successo: 'Storia salvata', dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Storia della ricetta"
      descrizione="Le origini, le tradizioni, le persone legate a questa ricetta. Resta nella Famiglia; se la ricetta è pubblica puoi pubblicarla anche tu."
      piede={
        <Button disabled={salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Storia" htmlFor="storia-testo">
          <Textarea id="storia-testo" className="min-h-40" value={testo} maxLength={20000} onChange={(e) => setTesto(e.target.value)} />
        </Campo>
        <SceltaFoto file={file} onCambia={setFile} />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={pubblica && ricettaPubblica} disabled={!ricettaPubblica} onChange={(e) => setPubblica(e.target.checked)} />
          <span>
            Pubblica anche la storia e le sue foto
            <span className="block text-xs text-testo-tenue">
              {ricettaPubblica ? 'La vedrà chi legge la ricetta pubblica. Ricordi ed esperienze restano sempre nella Famiglia.' : 'Possibile solo se la ricetta è pubblica.'}
            </span>
          </span>
        </label>
      </div>
    </Finestra>
  )
}

function NuovaMemoria({ piatto, tipo, onChiudi }: { piatto: DettaglioPiatto; tipo: 'ricordo' | 'esperienza'; onChiudi: () => void }) {
  const [testo, setTesto] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [file, setFile] = useState<File[]>([])
  const eventi = [...new Map(piatto.usatoIn.map((u) => [u.eventoId, u])).values()]
  const salva = useScrittura(
    async () => {
      const m = await api.crea<Memoria>(`/piatti/${piatto.id}/memorie`, { id: nuovoId(), tipo, testo, eventoId: tipo === 'esperienza' && eventoId ? eventoId : null })
      if (file.length) await caricaFoto(m.id, file)
    },
    { successo: tipo === 'ricordo' ? 'Ricordo aggiunto' : 'Esperienza aggiunta', dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={tipo === 'ricordo' ? 'Un ricordo' : 'Un\'esperienza di preparazione'}
      descrizione={
        tipo === 'ricordo'
          ? 'Lo vedono i membri della Famiglia della ricetta, con il tuo nome e la data. Solo tu puoi modificarlo.'
          : 'Risultato, quantità, modifiche, consigli per la prossima volta. Non cambia ingredienti né procedimento.'
      }
      piede={
        <Button disabled={!testo.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          <NotebookPen /> Aggiungi
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta={tipo === 'ricordo' ? 'Ricordo' : 'Com\'è andata'} htmlFor="memoria-testo">
          <Textarea id="memoria-testo" className="min-h-32" value={testo} maxLength={20000} onChange={(e) => setTesto(e.target.value)} autoFocus />
        </Campo>
        {tipo === 'esperienza' && eventi.length ? (
          <Campo etichetta="In quale evento (facoltativo)" htmlFor="memoria-evento">
            <Select id="memoria-evento" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Nessuno</option>
              {eventi.map((u) => (
                <option key={u.eventoId} value={u.eventoId}>
                  {u.eventoNome}
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}
        <SceltaFoto file={file} onCambia={setFile} />
      </div>
    </Finestra>
  )
}

function ModificaMemoria({ m, onChiudi }: { m: Memoria; onChiudi: () => void }) {
  const [testo, setTesto] = useState(m.testo)
  const [file, setFile] = useState<File[]>([])
  const salva = useScrittura(
    async () => {
      await api.modifica(`/memorie/${m.id}`, { testo, versione: m.versione })
      if (file.length) await caricaFoto(m.id, file)
    },
    { successo: 'Salvato', dopo: onChiudi },
  )
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo="Modifica"
      piede={
        <Button disabled={!testo.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Textarea aria-label="Testo" className="min-h-32" value={testo} maxLength={20000} onChange={(e) => setTesto(e.target.value)} />
        <SceltaFoto file={file} onCambia={setFile} />
      </div>
    </Finestra>
  )
}
