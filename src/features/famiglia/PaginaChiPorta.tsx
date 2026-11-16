// Chi porta cosa (SPEC §20.5): piatti del menù e cose da portare, chi se ne occupa, stato.
// La responsabilità di un piatto è la stessa «A cura di» del menù.
import { CheckCircle2, Circle, HandHeart, Plus, ShoppingBasket, Undo2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Select } from '@/components/ui/campi'
import { Card, CardContent } from '@/components/ui/card'
import { Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import type { Incarichi, Incarico } from '@/contratto/famiglia.ts'
import { useStatoConnessione } from '@/connessione/stato'
import { useUtenteCorrente } from '@/features/accesso/sessione'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'
import { cn } from '@/lib/utils'
import { useIncarichi } from './api'

const percorso = (i: Incarico) => `/${i.tipo === 'voce' ? 'voci' : 'cose'}/${i.id}`

export function PaginaChiPorta() {
  const e = useEventoCorrente()
  const q = useIncarichi(e.id)
  const [nuova, setNuova] = useState(false)
  if (q.isPending) return <Caricamento />
  if (!q.data) return <CorpoScheda>Impossibile caricare gli incarichi.</CorpoScheda>
  const d = q.data
  const liberi = d.incarichi.filter((i) => i.stato === 'da_assegnare').length
  return (
    <CorpoScheda>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-testo-tenue">
          {liberi ? (
            <>
              <strong className="text-testo">{liberi}</strong> {liberi === 1 ? 'cosa' : 'cose'} ancora da assegnare
            </>
          ) : (
            'Tutto ha qualcuno che se ne occupa'
          )}
        </p>
        {d.puoPartecipare ? (
          <Button variante="contorno" misura="piccolo" onClick={() => setNuova(true)}>
            <Plus /> Cosa da portare
          </Button>
        ) : null}
      </div>
      {d.incarichi.length === 0 ? (
        <Vuoto illustrazione="taccuino" titolo="Niente da organizzare, per ora" testo="I piatti del menù compaiono qui; aggiungi anche vino, pane, bibite o altro da portare." />
      ) : (
        <div className="flex flex-col gap-4">
          <Sezione titolo="Dal menù" incarichi={d.incarichi.filter((i) => i.tipo === 'voce')} d={d} />
          <Sezione titolo="Da portare" incarichi={d.incarichi.filter((i) => i.tipo === 'cosa')} d={d} />
        </div>
      )}
      <NuovaCosa eventoId={e.id} aperta={nuova} onCambia={setNuova} />
    </CorpoScheda>
  )
}

function Sezione({ titolo, incarichi, d }: { titolo: string; incarichi: Incarico[]; d: Incarichi }) {
  if (!incarichi.length) return null
  return (
    <section aria-label={titolo}>
      <h2 className="mb-2 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-testo-tenue">
        {titolo} <span className="filetto flex-1" />
      </h2>
      <ul className="flex flex-col gap-2">
        {incarichi.map((i) => (
          <li key={`${i.tipo}-${i.id}`}>
            <Riga i={i} d={d} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Riga({ i, d }: { i: Incarico; d: Incarichi }) {
  const connesso = useStatoConnessione() === 'connesso'
  const { utente } = useUtenteCorrente()
  const [prendi, setPrendi] = useState(false)
  const [togli, setTogli] = useState(true)
  const opzioni = { oggetto: `«${i.nome}»`, successo: null }
  const azione = useScrittura((a: { verbo: 'prendi' | 'rinuncia' | 'completa' | 'assegna'; corpo: Record<string, unknown> }) => api.crea<Incarico>(`${percorso(i)}/${a.verbo}`, { versione: i.versione, ...a.corpo }), opzioni)
  const elimina = useScrittura(() => api.elimina(percorso(i), i.versione), { successo: 'Eliminata' })
  const mio = i.incaricatoId !== null && i.incaricatoId === utente?.id
  return (
    <Card className={cn(i.stato === 'completato' && 'opacity-75')} data-testid="incarico">
      <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
        {i.stato === 'completato' ? <CheckCircle2 className="size-5 shrink-0 text-successo" /> : <Circle className={cn('size-5 shrink-0', i.stato === 'assegnato' ? 'text-primario' : 'text-bordo')} />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {i.nome}
            {i.quantita ? <span className="text-testo-tenue"> · {i.quantita}</span> : null}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-testo-tenue">
            {i.portata ? <span>{i.portata}</span> : null}
            {i.incaricato ? (
              <Badge variante={mio ? 'primario' : 'neutro'}>
                <UserRound className="size-3" /> {mio ? 'tu' : i.incaricato}
              </Badge>
            ) : (
              <Badge variante="avviso">da assegnare</Badge>
            )}
            {i.stato === 'completato' ? <Badge variante="successo">fatto</Badge> : null}
            {i.tipo === 'voce' && i.inSpesa === false ? (
              <span className="flex items-center gap-1">
                <ShoppingBasket className="size-3" /> fuori dalla spesa
              </span>
            ) : null}
            {i.note ? <span>· {i.note}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {i.puoPrendere ? (
            <Button misura="piccolo" disabled={!connesso || azione.inCorso} onClick={() => (i.tipo === 'voce' && i.inSpesa ? setPrendi(true) : void azione.esegui({ verbo: 'prendi', corpo: {} }))}>
              <HandHeart /> Me ne occupo io
            </Button>
          ) : null}
          {i.puoCompletare && i.stato !== 'completato' ? (
            <Button misura="piccolo" variante="contorno" disabled={!connesso} onClick={() => void azione.esegui({ verbo: 'completa', corpo: { completato: true } })}>
              <CheckCircle2 /> Fatto
            </Button>
          ) : null}
          {d.puoAssegnare ? (
            <Select
              aria-label={`Assegna «${i.nome}»`}
              className="h-9 w-auto max-w-40"
              value={i.incaricatoId ?? ''}
              disabled={!connesso}
              onChange={(ev) => void azione.esegui({ verbo: 'assegna', corpo: { utenteId: ev.target.value || null } })}
            >
              <option value="">{i.incaricato && !i.incaricatoId ? i.incaricato : 'Assegna a…'}</option>
              {d.persone.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          ) : null}
          <MenuAzioni
            etichetta={`Altre azioni su «${i.nome}»`}
            voci={[
              { etichetta: 'Rinuncio', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || !mio },
              { etichetta: 'Libera l\'incarico', icona: <Undo2 />, onSelect: () => void azione.esegui({ verbo: 'rinuncia', corpo: {} }), nascosta: !i.puoRinunciare || mio },
              { etichetta: 'Non ancora fatto', onSelect: () => void azione.esegui({ verbo: 'completa', corpo: { completato: false } }), nascosta: !i.puoCompletare || i.stato !== 'completato' },
              { etichetta: 'Elimina', onSelect: () => void elimina.esegui(undefined), pericolosa: true, nascosta: i.tipo !== 'cosa' || !i.puoGestire },
            ]}
          />
        </div>
      </CardContent>
      <Finestra
        aperta={prendi}
        onCambia={setPrendi}
        titolo={`Ti occupi di «${i.nome}»`}
        descrizione="Se lo porti già pronto, gli ingredienti escono dalla spesa dell'evento. Se poi rinunci, tornano nella spesa."
        piede={
          <Button
            onClick={() => {
              setPrendi(false)
              void azione.esegui({ verbo: 'prendi', corpo: { togliDallaSpesa: togli } })
            }}
          >
            <HandHeart /> Me ne occupo io
          </Button>
        }
      >
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={togli} onChange={(ev) => setTogli(ev.target.checked)} /> Porto tutto io: togli gli ingredienti dalla spesa
        </label>
      </Finestra>
    </Card>
  )
}

function NuovaCosa({ eventoId, aperta, onCambia }: { eventoId: string; aperta: boolean; onCambia: (a: boolean) => void }) {
  const [nome, setNome] = useState('')
  const [quantita, setQuantita] = useState('')
  const [note, setNote] = useState('')
  const [prendo, setPrendo] = useState(true)
  const crea = useScrittura(() => api.crea<Incarico>(`/eventi/${eventoId}/cose`, { id: nuovoId(), nome: nome.trim(), quantita, note, prendo }), {
    successo: 'Aggiunta',
    dopo: () => {
      setNome('')
      setQuantita('')
      setNote('')
      onCambia(false)
    },
  })
  return (
    <Finestra
      aperta={aperta}
      onCambia={onCambia}
      titolo="Cosa da portare"
      descrizione="Vino, pane, bibite, ghiaccio, un dolce comprato… Non entra nella spesa del menù."
      piede={
        <Button disabled={!nome.trim() || crea.inCorso} onClick={() => void crea.esegui(undefined)}>
          Aggiungi
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Cosa" htmlFor="cosa-nome">
          <Input id="cosa-nome" value={nome} maxLength={200} placeholder="Es. Vino rosso" onChange={(e) => setNome(e.target.value)} autoFocus />
        </Campo>
        <Campo etichetta="Quantità (facoltativa)" htmlFor="cosa-quantita">
          <Input id="cosa-quantita" value={quantita} maxLength={200} placeholder="Es. 3 bottiglie" onChange={(e) => setQuantita(e.target.value)} />
        </Campo>
        <Campo etichetta="Note (facoltative)" htmlFor="cosa-note">
          <Input id="cosa-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Campo>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Casella checked={prendo} onChange={(e) => setPrendo(e.target.checked)} /> Me ne occupo io
        </label>
      </div>
    </Finestra>
  )
}
