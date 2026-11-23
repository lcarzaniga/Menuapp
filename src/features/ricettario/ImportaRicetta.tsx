// «Importa ricetta»: file (pacchetto, JSON, testo) o testo incollato, anteprima, importazione.
import { AlertTriangle, FileDown, FileUp, ImageIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { useIngredienti, usePiatti } from '@/api/query'
import { messaggioErrore } from '@/api/scrittura'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import { useFamigliaAttiva } from '@/features/famiglia/attiva'
import { indicizzaCatalogo } from '@/domain/parser/analizza.ts'
import { NOME_TEMPLATE_RICETTA, TEMPLATE_RICETTA } from '@/domain/ricetta/formato.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { riduciFoto } from '@/lib/immagini'
import { useQueryClient } from '@tanstack/react-query'
import { daTestoLibero, ingredientiDa, leggiFile, nomeLibero, nuovoPiatto, type RicettaDaImportare } from './importazione'

interface Voce extends RicettaDaImportare {
  chiave: string
  nome: string
  scelta: boolean
  anteprime: string[]
}

export function ImportaRicetta({ aperta, onCambia }: { aperta: boolean; onCambia: (a: boolean) => void }) {
  const catalogo = useIngredienti()
  const piatti = usePiatti()
  const client = useQueryClient()
  const naviga = useNavigate()
  const puoScrivere = usePuoScrivere()
  const { attiva } = useFamigliaAttiva()
  const fileRef = useRef<HTMLInputElement>(null)
  const [testo, setTesto] = useState('')
  const [voci, setVoci] = useState<Voce[]>([])
  const [inCorso, setInCorso] = useState<string | null>(null)
  const indice = useMemo(
    () => indicizzaCatalogo((catalogo.data ?? []).map((c) => ({ id: c.id, nome: c.nome, sinonimi: c.sinonimi, scalaturaAbituale: c.scalaturaAbituale }))),
    [catalogo.data],
  )
  const esistenti = (piatti.data ?? []).map((p) => p.nome)

  function prepara(lette: RicettaDaImportare[]) {
    voci.forEach((v) => v.anteprime.forEach((u) => URL.revokeObjectURL(u)))
    const nomi = [...esistenti]
    setVoci(
      lette.map((r, k) => {
        const nome = nomeLibero(r.ricetta.nome.trim(), nomi)
        nomi.push(nome)
        return { ...r, chiave: `${k}`, nome, scelta: true, anteprime: r.foto.map((f) => URL.createObjectURL(f.dati)) }
      }),
    )
  }

  async function daFile(f: File | undefined) {
    if (!f) return
    try {
      prepara(await leggiFile(f))
    } catch (e) {
      toast.error((e as Error).message)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function daIncollato() {
    try {
      prepara([daTestoLibero(testo)])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  function chiudi() {
    voci.forEach((v) => v.anteprime.forEach((u) => URL.revokeObjectURL(u)))
    setVoci([])
    setTesto('')
    onCambia(false)
  }

  async function importa() {
    const scelte = voci.filter((v) => v.scelta && v.nome.trim())
    let ultimo: string | null = null
    try {
      for (const v of scelte) {
        setInCorso(`Importo «${v.nome}»…`)
        const id = nuovoId()
        // Nasce nella Famiglia attiva (SPEC §35); la visibilità resta quella predefinita.
        await api.crea('/piatti', { ...nuovoPiatto(id, v.nome.trim(), v.ricetta, ingredientiDa(v.ricetta, indice)), ...(attiva ? { famigliaOrigine: attiva.id } : {}) })
        for (const [k, f] of v.foto.entries()) {
          setInCorso(`«${v.nome}»: foto ${k + 1} di ${v.foto.length}…`)
          const ridotta = await riduciFoto(f.dati)
          const q = new URLSearchParams({ id: nuovoId(), didascalia: f.didascalia, principale: f.principale ? '1' : '0', ...(f.passo === null ? {} : { passo: String(f.passo) }) })
          await api.file('POST', `/piatti/${id}/foto?${q}`, ridotta)
        }
        ultimo = id
      }
      await client.invalidateQueries()
      toast.success(scelte.length === 1 ? 'Ricetta importata: controlla gli ingredienti da verificare' : `${scelte.length} ricette importate`)
      chiudi()
      if (scelte.length === 1 && ultimo) naviga(`/ricettario/${ultimo}`)
    } catch (e) {
      await client.invalidateQueries()
      toast.error(`Importazione interrotta: ${messaggioErrore(e)}`)
    } finally {
      setInCorso(null)
    }
  }

  const scelte = voci.filter((v) => v.scelta).length
  return (
    <Finestra
      aperta={aperta}
      onCambia={(a) => (a ? onCambia(true) : chiudi())}
      titolo="Importa ricetta"
      descrizione="Pacchetto di Ricette di famiglia & Co. (con foto), file JSON o testo scritto a mano: il formato è nel modello qui sotto."
      piede={
        voci.length ? (
          <>
            <Button variante="contorno" onClick={() => prepara([])} disabled={Boolean(inCorso)}>
              Indietro
            </Button>
            <Button onClick={() => void importa()} disabled={!scelte || Boolean(inCorso) || !puoScrivere}>
              {inCorso ?? `Importa ${scelte === 1 ? 'la ricetta' : `${scelte} ricette`}`}
            </Button>
          </>
        ) : undefined
      }
    >
      {voci.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Button variante="contorno" misura="grande" onClick={() => fileRef.current?.click()}>
            <FileUp /> Scegli un file
          </Button>
          <ScaricaTemplate />
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".menuapp-ricetta,.zip,.json,.txt,.md,application/zip,application/json,text/plain,text/markdown"
            onChange={(e) => void daFile(e.target.files?.[0])}
          />
          <p className="text-center text-sm text-testo-tenue">oppure incolla il testo</p>
          <Textarea
            aria-label="Testo della ricetta"
            className="min-h-48 font-mono text-[0.875rem]"
            placeholder={'# Tiramisù\nPorzioni: 8\n\n## Ingredienti\n- 500 g mascarpone\n- 4 uova\n\n## Procedimento\n1. Montare i tuorli con lo zucchero.'}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <Button disabled={!testo.trim()} onClick={daIncollato}>
            Leggi il testo
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {voci.map((v) => {
            const ingredienti = ingredientiDa(v.ricetta, indice)
            const daVerificare = ingredienti.filter((i) => i.statoParsing === 'da_verificare').length
            const rinominata = v.nome !== v.ricetta.nome.trim()
            return (
              <li key={v.chiave} className="rounded-2xl border border-bordo p-3">
                <div className="flex items-center gap-2">
                  {voci.length > 1 ? (
                    <input type="checkbox" className="size-5 accent-primario" aria-label={`Importa ${v.nome}`} checked={v.scelta} onChange={(e) => setVoci(voci.map((x) => (x.chiave === v.chiave ? { ...x, scelta: e.target.checked } : x)))} />
                  ) : null}
                  <Input aria-label="Nome del piatto" value={v.nome} onChange={(e) => setVoci(voci.map((x) => (x.chiave === v.chiave ? { ...x, nome: e.target.value } : x)))} />
                </div>
                {rinominata ? <p className="mt-1 text-xs text-avviso">Esiste già un piatto «{v.ricetta.nome}»: verrà creato un piatto nuovo, quello esistente non cambia.</p> : null}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {v.ricetta.porzioniBase ? <Badge variante="primario">per {formattaCoperti(v.ricetta.porzioniBase)} porzioni</Badge> : <Badge variante="avviso">porzioni base da indicare</Badge>}
                  <Badge>{ingredienti.length} ingredienti</Badge>
                  {daVerificare ? <Badge variante="avviso">{daVerificare} da verificare</Badge> : null}
                  <Badge>{v.ricetta.procedimento?.length ?? 0} passaggi</Badge>
                  {v.foto.length ? (
                    <Badge variante="info">
                      <ImageIcon className="size-3" /> {v.foto.length} foto
                    </Badge>
                  ) : null}
                </div>
                {v.anteprime.length ? (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto">
                    {v.anteprime.map((u, k) => (
                      <figure key={u} className="shrink-0">
                        <img src={u} alt={v.foto[k]?.didascalia || `Foto ${k + 1}`} className="size-16 rounded-lg object-cover" />
                        {v.foto[k]?.passo != null ? <figcaption className="text-center text-[0.6875rem] text-testo-tenue">passo {v.foto[k]!.passo! + 1}</figcaption> : null}
                      </figure>
                    ))}
                  </div>
                ) : null}
                {ingredienti.length ? (
                  <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
                    {ingredienti.map((i) => (
                      <li key={i.id} className="flex items-center gap-2 py-0.5">
                        <span className="min-w-0 flex-1 truncate">{i.testoOriginale}</span>
                        {i.statoParsing === 'da_verificare' ? <Badge variante="avviso">da verificare</Badge> : <Badge variante="successo">certo</Badge>}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {v.avvisi.map((a) => (
                  <p key={a} className="mt-1 flex items-start gap-1.5 text-xs text-avviso">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {a}
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </Finestra>
  )
}

/**
 * Modello Markdown da compilare: un collegamento con «download» a un indirizzo data: in UTF-8, che
 * funziona anche sul telefono (nessun intermediario, nessun permesso).
 */
export const URL_TEMPLATE_RICETTA = `data:text/markdown;charset=utf-8,${encodeURIComponent(TEMPLATE_RICETTA)}`

export function ScaricaTemplate() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
      <Button asChild variante="fantasma" misura="piccolo">
        <a href={URL_TEMPLATE_RICETTA} download={NOME_TEMPLATE_RICETTA}>
          <FileDown /> Scarica template .md
        </a>
      </Button>
      <span className="text-testo-tenue">Compila il modello e importalo qui</span>
    </div>
  )
}

