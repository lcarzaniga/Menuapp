// Impostazioni → Dati: stato del server, backup, esportazione, ripristino (SPEC §11, F10).
import { AlertTriangle, CheckCircle2, Database, Download, HardDriveDownload, RotateCcw, Upload } from 'lucide-react'
import { strFromU8, unzipSync } from 'fflate'
import { useRef, useState } from 'react'
import { tipoDaNome } from '@/lib/immagini'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useSalute, useStatoBackup } from '@/api/query'
import { useUtenteCorrente } from '@/features/accesso/sessione'
import { messaggioErrore, useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Input } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere, useStatoConnessione } from '@/connessione/stato'
import { dataOra } from '@/lib/formato'
import { FRASE_CONFERMA_RIPRISTINO, type InfoBackupApi, type RiepilogoRipristino } from '@/contratto/backup.ts'

const NOMI_TIPO: Record<InfoBackupApi['tipo'], string> = {
  giornaliero: 'Giornaliero',
  settimanale: 'Settimanale',
  'pre-migrazione': 'Prima di un aggiornamento',
  'pre-ripristino': 'Prima di un ripristino',
  manuale: 'Manuale',
}

const NOMI_TABELLE: Record<string, string> = {
  eventi: 'eventi',
  voci_menu: 'voci di menù',
  piatti: 'piatti',
  ingredienti: 'ingredienti di catalogo',
  articoli_spesa: 'righe di spesa',
  attivita: 'attività',
  snapshot_eventi: 'versioni archiviate',
}

function dimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} kB`
  return `${(byte / 1024 / 1024).toFixed(1)} MB`
}

function riassuntoConteggi(c: Record<string, number>): string {
  return Object.entries(NOMI_TABELLE)
    .map(([t, nome]) => `${c[t] ?? 0} ${nome}`)
    .join(' · ')
}

/** Backup, esportazione completa e ripristino: amministratore dall'indirizzo privato. */
export function PaginaDati() {
  const { amministratore, ingressoPrivato } = useUtenteCorrente()
  if (!amministratore || !ingressoPrivato) {
    return (
      <Pagina titolo="Dati e backup" indietro="/impostazioni">
        <Vuoto titolo="Non disponibile" testo={amministratore ? 'Backup e ripristino si aprono solo dall\'indirizzo privato (Tailscale).' : 'Funzione riservata all\'amministratore. I tuoi dati li esporti da «Il mio account».'} />
      </Pagina>
    )
  }
  return <Dati />
}

function Dati() {
  // Su Cloudflare i backup stanno in R2 e il ripristino passa solo dallo script amministrativo.
  const { cloudflare } = useUtenteCorrente()
  const salute = useSalute()
  const stato = useStatoBackup()
  const puoScrivere = usePuoScrivere()
  const connessione = useStatoConnessione()
  const [riepilogo, setRiepilogo] = useState<RiepilogoRipristino | null>(null)
  const [conferma, setConferma] = useState('')
  const [verifica, setVerifica] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // Foto di un'esportazione ZIP, da rimettere sul server dopo il ripristino.
  const fotoZip = useRef<Record<string, Uint8Array>>({})

  const backupOra = useScrittura(() => api.crea<InfoBackupApi>('/backup', {}), {
    successo: (b) => `Backup creato e verificato (${dimensione(b.byte)})`,
  })
  const esegui = useScrittura(
    async (r: RiepilogoRipristino) => {
      const esito = await api.crea<{ backupPrecedente: string; fotoMancanti: string[] }>('/ripristino/esegui', { token: r.token, conferma: FRASE_CONFERMA_RIPRISTINO })
      let assenti = 0
      for (const id of esito.fotoMancanti) {
        const nome = Object.keys(fotoZip.current).find((k) => k.startsWith(`foto/${id}.`))
        if (!nome) {
          assenti++
          continue
        }
        await api.file('PUT', `/foto/${id}/file`, new Blob([fotoZip.current[nome]! as Uint8Array<ArrayBuffer>], { type: tipoDaNome(nome) }))
      }
      fotoZip.current = {}
      if (assenti) toast.warning(`${assenti} foto non disponibili: le ricette restano, senza quelle immagini`)
      return esito
    },
    {
      successo: 'Ripristino completato',
      dopo: () => {
        setRiepilogo(null)
        setConferma('')
      },
      dopoErrore: () => setRiepilogo(null),
    },
  )

  async function verificaSorgente(corpo: unknown) {
    if (!puoScrivere) {
      toast.error('Server non raggiungibile')
      return
    }
    setVerifica(true)
    try {
      setRiepilogo(await api.crea<RiepilogoRipristino>('/ripristino/verifica', corpo))
      setConferma('')
    } catch (e) {
      toast.error(messaggioErrore(e))
    } finally {
      setVerifica(false)
    }
  }

  async function daFile(file: File | undefined) {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File troppo grande (massimo 50 MB)')
      return
    }
    let contenuto: unknown
    fotoZip.current = {}
    try {
      const byte = new Uint8Array(await file.arrayBuffer())
      if (byte[0] === 0x50 && byte[1] === 0x4b) {
        const zip = unzipSync(byte)
        if (!zip['esportazione.json']) throw new Error('Nel file ZIP manca esportazione.json')
        contenuto = JSON.parse(strFromU8(zip['esportazione.json']))
        fotoZip.current = Object.fromEntries(Object.entries(zip).filter(([k]) => k.startsWith('foto/')))
      } else {
        contenuto = JSON.parse(strFromU8(byte))
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('esportazione.json') ? e.message : 'Il file non è un\'esportazione valida (JSON o ZIP)')
      return
    }
    await verificaSorgente({ origine: 'file', contenuto })
    if (fileRef.current) fileRef.current.value = ''
  }

  const s = salute.data
  const st = stato.data

  return (
    <Pagina titolo="Dati e backup" indietro="/impostazioni">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-primario" /> Server
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {s ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-testo-tenue">Stato</dt>
                <dd>{connessione === 'connesso' ? <Badge variante="successo">Raggiungibile</Badge> : <Badge variante="avviso">Non raggiungibile</Badge>}</dd>
                <dt className="text-testo-tenue">App</dt>
                <dd>
                  {__VERSIONE_APP__} <span className="text-testo-tenue">(server {s.versioneApp}, rilascio {s.rilascio})</span>
                </dd>
                <dt className="text-testo-tenue">Schema dati</dt>
                <dd>versione {s.versioneSchema}</dd>
                <dt className="text-testo-tenue">Ultimo backup</dt>
                <dd>
                  {s.ultimoBackup ? (
                    s.ultimoBackup.esito === 'ok' ? (
                      `${dataOra(s.ultimoBackup.creatoIl)} (${NOMI_TIPO[s.ultimoBackup.tipo as InfoBackupApi['tipo']] ?? s.ultimoBackup.tipo})`
                    ) : (
                      <span className="text-pericolo">non riuscito il {dataOra(s.ultimoBackup.creatoIl)}</span>
                    )
                  ) : (
                    'nessuno'
                  )}
                </dd>
              </dl>
            ) : salute.isError ? (
              <p className="text-pericolo">Impossibile leggere lo stato del server.</p>
            ) : (
              <Caricamento />
            )}
          </CardContent>
        </Card>

        {st?.avvisi.length ? (
          <div className="flex flex-col gap-2">
            {st.avvisi.map((a) => (
              <p key={a} className="flex items-start gap-2 rounded-xl bg-avviso-tenue px-3 py-2.5 text-sm text-avviso">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {a}
              </p>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Backup sul server</CardTitle>
            <p className="text-sm text-testo-tenue">
              {cloudflare
                ? 'Ogni notte una copia completa dei dati va nello spazio privato dell\'app. Il ripristino si fa con lo script amministrativo.'
                : 'Il server salva una copia verificata ogni notte e prima di ogni aggiornamento o ripristino.'}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void backupOra.esegui(undefined)} disabled={!puoScrivere || backupOra.inCorso}>
                <HardDriveDownload /> {backupOra.inCorso ? 'Backup in corso…' : 'Backup ora'}
              </Button>
            </div>
            {st ? (
              st.backup.length === 0 ? (
                <p className="text-sm text-testo-tenue">Nessun backup presente.</p>
              ) : (
                <ul className="divide-y divide-bordo rounded-xl border border-bordo">
                  {st.backup.map((b) => (
                    <li key={b.nome} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {dataOra(b.creatoIl)} {b.verificato ? <CheckCircle2 className="inline size-4 text-successo" aria-label="verificato" /> : null}
                        </div>
                        <div className="text-[0.8125rem] text-testo-tenue">
                          {NOMI_TIPO[b.tipo]} · {dimensione(b.byte)} · {b.conteggi.eventi ?? 0} eventi
                        </div>
                      </div>
                      <Button asChild variante="fantasma" misura="iconaPiccola" aria-label="Scarica">
                        <a href={`/api/v1/backup/${encodeURIComponent(b.nome)}`} download>
                          <Download />
                        </a>
                      </Button>
                      {cloudflare ? null : (
                        <Button
                          variante="fantasma"
                          misura="piccolo"
                          disabled={!puoScrivere || verifica}
                          onClick={() => void verificaSorgente({ origine: 'backup', nome: b.nome })}
                        >
                          <RotateCcw /> Ripristina
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <Caricamento />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{cloudflare ? 'Esportazione' : 'Esportazione e ripristino da file'}</CardTitle>
            <p className="text-sm text-testo-tenue">
              Scarica regolarmente un'esportazione su un altro dispositivo: protegge i dati anche se il disco del server si guasta.
              {st?.ultimaEsportazione ? ` Ultima: ${dataOra(st.ultimaEsportazione)}.` : ''}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variante="contorno">
              <a href="/api/v1/esportazione?foto=1" download onClick={() => setTimeout(() => void stato.refetch(), 1500)}>
                <Download /> Esporta con le foto (ZIP)
              </a>
            </Button>
            <Button asChild variante="fantasma">
              <a href="/api/v1/esportazione" download onClick={() => setTimeout(() => void stato.refetch(), 1500)}>
                <Download /> Solo dati (JSON)
              </a>
            </Button>
            {cloudflare ? null : (
              <>
                <Button variante="contorno" disabled={!puoScrivere || verifica} onClick={() => fileRef.current?.click()}>
                  <Upload /> {verifica ? 'Verifica in corso…' : 'Ripristina da file…'}
                </Button>
                <input ref={fileRef} type="file" accept="application/json,.json,application/zip,.zip" className="hidden" onChange={(e) => void daFile(e.target.files?.[0])} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Finestra
        aperta={riepilogo !== null}
        onCambia={(a) => !a && setRiepilogo(null)}
        titolo="Ripristinare questi dati?"
        descrizione="Tutti i dati attuali (su ogni dispositivo) saranno sostituiti. Prima il server ne salva una copia di sicurezza."
        piede={
          <>
            <Button variante="contorno" onClick={() => setRiepilogo(null)}>
              Annulla
            </Button>
            <Button
              variante="pericolo"
              disabled={conferma !== FRASE_CONFERMA_RIPRISTINO || esegui.inCorso || !puoScrivere}
              onClick={() => riepilogo && void esegui.esegui(riepilogo)}
            >
              {esegui.inCorso ? 'Ripristino in corso…' : 'Ripristina'}
            </Button>
          </>
        }
      >
        {riepilogo ? (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-tenue p-3">
              <dt className="text-testo-tenue">Origine</dt>
              <dd>{riepilogo.origine}</dd>
              <dt className="text-testo-tenue">Dati del</dt>
              <dd>{dataOra(riepilogo.dataDati)}</dd>
              <dt className="text-testo-tenue">Contenuto</dt>
              <dd>{riassuntoConteggi(riepilogo.conteggi)}</dd>
            </dl>
            {riepilogo.avvisi.map((a) => (
              <p key={a} className="flex items-start gap-2 rounded-xl bg-avviso-tenue px-3 py-2 text-avviso">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {a}
              </p>
            ))}
            <Campo etichetta={`Per confermare scrivi ${FRASE_CONFERMA_RIPRISTINO}`} htmlFor="conferma-ripristino">
              <Input
                id="conferma-ripristino"
                value={conferma}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setConferma(e.target.value.toUpperCase())}
              />
            </Campo>
          </div>
        ) : null}
      </Finestra>
    </Pagina>
  )
}
