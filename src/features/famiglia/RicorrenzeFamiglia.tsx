// Ricorrenze della Famiglia (SPEC §28): un elenco di nomi per raggruppare gli eventi.
import { Repeat } from 'lucide-react'
import { useState } from 'react'
import { api, nuovoId } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Input } from '@/components/ui/campi'
import { Conferma, Finestra } from '@/components/ui/dialog'
import { MenuAzioni } from '@/components/ui/menu'
import { useStatoConnessione } from '@/connessione/stato'
import type { Ricorrenza } from '@/contratto/edizioni.ts'
import type { Gruppo } from '@/contratto/famiglia.ts'
import { useRicorrenze } from '@/features/eventi/Edizioni'
import { plurale } from '@/lib/formato'

export function RicorrenzeFamiglia({ famiglia }: { famiglia: Gruppo }) {
  const connesso = useStatoConnessione() === 'connesso'
  const elenco = useRicorrenze(famiglia.id)
  const [nome, setNome] = useState('')
  const [modifica, setModifica] = useState<Ricorrenza | null>(null)
  const [elimina, setElimina] = useState<Ricorrenza | null>(null)
  const admin = famiglia.ruolo === 'amministratore'
  const aggiungi = useScrittura(() => api.crea<Ricorrenza>(`/famiglie/${famiglia.id}/ricorrenze`, { id: nuovoId(), nome: nome.trim() }), {
    successo: (r) => `Ricorrenza «${r.nome}» aggiunta`,
    dopo: () => setNome(''),
  })
  const togli = useScrittura((r: Ricorrenza) => api.elimina(`/ricorrenze/${r.id}`), { successo: 'Ricorrenza eliminata' })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="size-4 text-primario" /> Ricorrenze
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-testo-tenue">Natale, Pasqua, un compleanno: raggruppano gli eventi per ritrovarli, duplicarli e confrontarli. Nessuna data fissa.</p>
        {elenco.data?.length ? (
          <ul className="flex flex-col divide-y divide-bordo/60" aria-label="Ricorrenze della Famiglia">
            {elenco.data.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.nome}</span>
                  <span className="text-sm text-testo-tenue"> · {plurale(r.eventi, 'evento', 'eventi')}</span>
                  {r.descrizione ? <span className="block text-xs text-testo-tenue">{r.descrizione}</span> : null}
                </span>
                <MenuAzioni
                  etichetta={`Azioni per ${r.nome}`}
                  voci={[
                    { etichetta: 'Rinomina', onSelect: () => setModifica(r), disabilitata: !connesso },
                    { etichetta: 'Elimina', onSelect: () => setElimina(r), pericolosa: true, nascosta: !admin, disabilitata: !connesso },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (nome.trim()) void aggiungi.esegui(undefined)
          }}
        >
          <Campo etichetta="Nuova ricorrenza" htmlFor="ricorrenza-nome" className="min-w-36 flex-1">
            <Input id="ricorrenza-nome" value={nome} maxLength={80} placeholder="Es. Natale" onChange={(ev) => setNome(ev.target.value)} />
          </Campo>
          <Button type="submit" variante="contorno" disabled={!nome.trim() || !connesso || aggiungi.inCorso}>
            Aggiungi
          </Button>
        </form>
      </CardContent>
      {modifica ? <ModificaRicorrenza r={modifica} onChiudi={() => setModifica(null)} /> : null}
      <Conferma
        aperta={elimina !== null}
        onCambia={(a) => !a && setElimina(null)}
        pericolosa
        titolo={`Eliminare la ricorrenza «${elimina?.nome ?? ''}»?`}
        descrizione="Gli eventi restano com'erano, con menù, partecipanti e archivi: perdono solo l'indicazione della ricorrenza."
        etichettaConferma="Elimina ricorrenza"
        onConferma={() => elimina && void togli.esegui(elimina)}
      />
    </Card>
  )
}

function ModificaRicorrenza({ r, onChiudi }: { r: Ricorrenza; onChiudi: () => void }) {
  const [nome, setNome] = useState(r.nome)
  const [descrizione, setDescrizione] = useState(r.descrizione)
  const salva = useScrittura(() => api.modifica<Ricorrenza>(`/ricorrenze/${r.id}`, { nome: nome.trim(), descrizione, versione: r.versione }), { oggetto: r.nome, successo: 'Salvato', dopo: onChiudi })
  return (
    <Finestra
      aperta
      onCambia={(a) => !a && onChiudi()}
      titolo={`Rinomina «${r.nome}»`}
      piede={
        <Button disabled={!nome.trim() || salva.inCorso} onClick={() => void salva.esegui(undefined)}>
          Salva
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etichetta="Nome" htmlFor="mod-ricorrenza-nome">
          <Input id="mod-ricorrenza-nome" value={nome} maxLength={80} onChange={(ev) => setNome(ev.target.value)} />
        </Campo>
        <Campo etichetta="Descrizione (facoltativa)" htmlFor="mod-ricorrenza-descrizione">
          <Input id="mod-ricorrenza-descrizione" value={descrizione} maxLength={200} onChange={(ev) => setDescrizione(ev.target.value)} />
        </Campo>
      </div>
    </Finestra>
  )
}
