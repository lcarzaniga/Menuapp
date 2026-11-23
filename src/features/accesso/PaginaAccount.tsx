// Il mio account: dispositivi autorizzati, nuovo dispositivo, esportazione, uscita (SPEC §19).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Download, LogOut, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Conferma } from '@/components/ui/dialog'
import type { InvitoCreato, Richiesta, Sessione } from '@/contratto/accesso.ts'
import { usePuoScrivere } from '@/connessione/stato'
import { ElencoDispositivi, LinkInvito, RichiesteInAttesa } from './componenti'
import { chiaviAccesso, useUtenteCorrente } from './sessione'

export function PaginaAccount() {
  const { utente, amministratore, ingressoPrivato } = useUtenteCorrente()
  const client = useQueryClient()
  const puoScrivere = usePuoScrivere()
  const sessioni = useQuery({ queryKey: ['account', 'sessioni'], queryFn: () => api.leggi<Sessione[]>('/account/sessioni') })
  const richieste = useQuery({ queryKey: ['account', 'richieste'], queryFn: () => api.leggi<Richiesta[]>('/account/richieste'), refetchInterval: 5000 })
  const [invito, setInvito] = useState<InvitoCreato | null>(null)
  const [esci, setEsci] = useState(false)
  const nuovoInvito = useScrittura(() => api.crea<InvitoCreato>('/account/inviti', {}), { successo: null, dopo: setInvito })
  const esciOra = useScrittura(() => api.crea('/sessione/esci', {}), {
    successo: 'Sei uscito da questo dispositivo',
    dopo: () => {
      client.clear()
      client.setQueryData(chiaviAccesso.sessione, null)
    },
  })
  if (!utente) return <Caricamento />
  return (
    <Pagina titolo="Il mio account" sottotitolo={<span className="inline-flex items-center gap-2">{utente.nome} {amministratore ? <Badge variante="primario">amministratore</Badge> : null}</span>}>
      <div className="flex flex-col gap-4">
        {amministratore && ingressoPrivato ? (
          <Link to="/impostazioni/utenti" className="flex items-center gap-3 rounded-2xl border border-primario/15 bg-superficie p-4 hover:bg-tenue/60">
            <Users className="size-5 text-primario" />
            <span className="flex-1">
              <span className="block font-medium">Utenti e dispositivi</span>
              <span className="text-sm text-testo-tenue">Inviti, approvazioni, dispositivi di tutti</span>
            </span>
            <ChevronRight className="size-5 text-testo-tenue" />
          </Link>
        ) : null}

        {richieste.data?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Dispositivi in attesa</CardTitle>
            </CardHeader>
            <CardContent>
              <RichiesteInAttesa richieste={richieste.data} mostraUtente={false} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>I miei dispositivi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sessioni.data ? <ElencoDispositivi sessioni={sessioni.data} percorsoRevoca={(id) => `/account/sessioni/${id}`} /> : <Caricamento />}
            {invito ? (
              <LinkInvito invito={invito} onChiudi={() => setInvito(null)} />
            ) : (
              <div>
                <Button variante="contorno" disabled={!puoScrivere || nuovoInvito.inCorso} onClick={() => void nuovoInvito.esegui(undefined)}>
                  <Plus /> Collega un nuovo dispositivo
                </Button>
                <p className="mt-1.5 text-xs text-testo-tenue">Crea un link da aprire sul telefono o sul browser nuovo; poi approvi la richiesta da qui.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>I miei dati</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-testo-tenue">Un file ZIP con i tuoi eventi (menù, spesa, piano, stile di stampa) e le tue ricette con le foto.</p>
            <Button variante="contorno" asChild className="self-start">
              <a href="/api/v1/account/esportazione" download>
                <Download /> Esporta i miei dati
              </a>
            </Button>
          </CardContent>
        </Card>

        <Button variante="contorno" className="self-start" onClick={() => setEsci(true)} disabled={!puoScrivere}>
          <LogOut /> Esci da questo dispositivo
        </Button>
      </div>
      <Conferma
        aperta={esci}
        onCambia={setEsci}
        titolo="Uscire da questo dispositivo?"
        descrizione="Per rientrare servirà un nuovo invito approvato."
        etichettaConferma="Esci"
        pericolosa
        onConferma={() => {
          setEsci(false)
          void esciOra.esegui(undefined)
        }}
      />
    </Pagina>
  )
}
