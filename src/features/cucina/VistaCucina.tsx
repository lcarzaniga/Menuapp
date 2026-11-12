// Vista cucina: ricetta leggibile alle porzioni scelte (SPEC F7).
import { AlertTriangle, Check, Minus, Plus, SunMedium } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMenu, usePiatto, useSnapshot } from '@/api/query'
import { Caricamento, Pagina, Vuoto } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { fattoreAnomalo, fattoreScalatura, formattaCoperti, scala } from '@/domain/porzioni.ts'
import type { IngredientePiatto, Piatto } from '@/domain/tipi.ts'
import { formattaQuantita } from '@/domain/unita.ts'
import { cn } from '@/lib/utils'

function useSpunte(chiave: string) {
  const [spunte, setSpunte] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(chiave) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(chiave, JSON.stringify([...spunte]))
    } catch {
      // archiviazione di sessione non disponibile: le spunte valgono solo finché la pagina è aperta
    }
  }, [chiave, spunte])
  const cambia = (id: string) => setSpunte((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  return [spunte, cambia] as const
}

/** Tiene lo schermo acceso finché la vista è aperta (Screen Wake Lock, dove supportato). */
function useSchermoAcceso(): boolean {
  const [attivo, setAttivo] = useState(false)
  useEffect(() => {
    let blocco: WakeLockSentinel | null = null
    let chiuso = false
    const richiedi = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
      try {
        blocco = await navigator.wakeLock.request('screen')
        if (chiuso) await blocco.release()
        else {
          setAttivo(true)
          blocco.addEventListener('release', () => setAttivo(false))
        }
      } catch {
        setAttivo(false)
      }
    }
    void richiedi()
    const visibile = () => void richiedi()
    document.addEventListener('visibilitychange', visibile)
    return () => {
      chiuso = true
      document.removeEventListener('visibilitychange', visibile)
      void blocco?.release()
    }
  }, [])
  return attivo
}

/** Foto collegate a un passaggio (solo per i piatti del ricettario, non per gli snapshot). */
function fotoDelPasso(piatto: Piatto, passo: number): string[] {
  const foto = (piatto as Piatto & { foto?: { id: string; passo: number | null }[] }).foto
  return foto?.filter((f) => f.passo === passo).map((f) => f.id) ?? []
}

export function quantitaCucina(i: IngredientePiatto, fattore: number | null): string {
  if (i.unita === 'qb') return 'q.b.'
  if (i.quantita === null) return ''
  const f = fattore ?? 1
  const a = formattaQuantita(scala(i.quantita, f, i.scalatura), i.unita, 'cucina')
  if (i.quantitaMax === null) return a.testo
  return `${a.numero}–${formattaQuantita(scala(i.quantitaMax, f, i.scalatura), i.unita, 'cucina').testo}`
}

export function VistaCucina({ piatto, porzioniIniziali, indietro, sottotitolo }: { piatto: Piatto; porzioniIniziali: number | null; indietro: string; sottotitolo?: string }) {
  const [porzioni, setPorzioni] = useState<number | null>(porzioniIniziali ?? piatto.porzioniBase)
  const [spunte, cambia] = useSpunte(`menuapp.cucina.${piatto.id}`)
  const schermo = useSchermoAcceso()
  const fattore = porzioni === null ? null : fattoreScalatura(porzioni, piatto.porzioniBase)
  const passo = porzioni !== null && porzioni < 4 ? 0.5 : 1

  return (
    <Pagina titolo={piatto.nome} sottotitolo={sottotitolo} indietro={indietro}>
      <div className="flex flex-col gap-5 text-[1.0625rem]">
        {'foto' in piatto && Array.isArray(piatto.foto) && piatto.foto[0] ? (
          <img src={`/api/v1/foto/${(piatto.foto.find((f: { principale: boolean }) => f.principale) ?? piatto.foto[0]).id}`} alt="" className="max-h-56 w-full rounded-3xl object-cover" />
        ) : null}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-carta p-3">
          <span className="text-sm text-testo-tenue">Porzioni</span>
          {piatto.porzioniBase ? (
            <div className="flex items-center gap-2">
              <Button variante="contorno" misura="icona" aria-label="Meno porzioni" disabled={(porzioni ?? 0) <= passo} onClick={() => setPorzioni(Math.max(passo, (porzioni ?? 1) - passo))}>
                <Minus />
              </Button>
              <span className="min-w-12 text-center text-2xl font-semibold tabular-nums">{formattaCoperti(porzioni ?? piatto.porzioniBase)}</span>
              <Button variante="contorno" misura="icona" aria-label="Più porzioni" onClick={() => setPorzioni((porzioni ?? 0) + passo)}>
                <Plus />
              </Button>
            </div>
          ) : (
            <span className="text-sm text-avviso">Il piatto non ha porzioni base: quantità della ricetta, non scalate.</span>
          )}
          <span className={cn('ml-auto flex items-center gap-1 text-xs', schermo ? 'text-successo' : 'text-testo-tenue')}>
            <SunMedium className="size-4" /> {schermo ? 'Schermo sempre acceso' : 'Schermo normale'}
          </span>
        </div>
        {fattoreAnomalo(fattore) ? (
          <p className="flex items-start gap-2 rounded-xl bg-avviso-tenue px-3 py-2 text-sm text-avviso">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Quantità moltiplicate per {formattaCoperti(fattore!)}: controlla le dosi.
          </p>
        ) : null}

        <section>
          <h2 className="mb-2 font-serif text-xl font-semibold text-primario">Ingredienti</h2>
          {piatto.ingredienti.length === 0 ? (
            <p className="text-testo-tenue">Nessun ingrediente nella ricetta.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {piatto.ingredienti.map((i) => {
                const fatto = spunte.has(i.id)
                return (
                  <li key={i.id}>
                    <button type="button" onClick={() => cambia(i.id)} className={cn('flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left', fatto ? 'bg-successo-tenue/60 text-testo-tenue line-through' : 'bg-carta')}>
                      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-2', fatto ? 'border-successo bg-successo text-white' : 'border-bordo')}>
                        {fatto ? <Check className="size-4" /> : null}
                      </span>
                      <span className="w-28 shrink-0 font-semibold tabular-nums">{quantitaCucina(i, fattore)}</span>
                      <span className="flex-1 leading-snug">
                        {i.nome}
                        {i.nota ? <span className="text-testo-tenue">, {i.nota}</span> : null}
                        {i.facoltativo ? <span className="text-testo-tenue"> (facoltativo)</span> : null}
                        {i.statoParsing === 'da_verificare' ? <span className="block text-xs text-avviso">da verificare: «{i.testoOriginale}»</span> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {piatto.procedimento.length ? (
          <section>
            <h2 className="mb-2 font-serif text-xl font-semibold text-primario">Procedimento</h2>
            <ol className="flex flex-col gap-2">
              {piatto.procedimento.map((p, k) => {
                const id = `passo-${k}`
                const fatto = spunte.has(id)
                return (
                  <li key={id}>
                    <button type="button" onClick={() => cambia(id)} className={cn('flex w-full gap-3 rounded-xl p-3 text-left leading-relaxed', fatto ? 'bg-successo-tenue/60 text-testo-tenue' : 'bg-carta')}>
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full font-semibold', fatto ? 'bg-successo text-white' : 'bg-primario-tenue text-primario')}>
                        {fatto ? <Check className="size-4" /> : k + 1}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="whitespace-pre-line">{p}</span>
                        {fotoDelPasso(piatto, k).map((id) => (
                          <img key={id} src={`/api/v1/foto/${id}`} alt={`Passaggio ${k + 1}`} loading="lazy" className="mt-2 max-h-60 w-full rounded-2xl object-cover" />
                        ))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : null}
        {piatto.note ? <p className="whitespace-pre-line rounded-xl bg-tenue p-3 text-[0.9375rem]">{piatto.note}</p> : null}
      </div>
    </Pagina>
  )
}

export function PaginaCucinaPiatto() {
  const { id = '' } = useParams()
  const q = usePiatto(id)
  if (q.isPending) return <Caricamento />
  if (!q.data) return <Pagina titolo="Vista cucina" indietro="/ricettario"><Vuoto titolo="Piatto non trovato" /></Pagina>
  return <VistaCucina piatto={q.data} porzioniIniziali={null} indietro={`/ricettario/${id}`} />
}

export function PaginaCucinaVoce() {
  const { id = '', voceId = '' } = useParams()
  const menu = useMenu(id)
  const naviga = useNavigate()
  const voce = menu.data?.portate.flatMap((p) => p.voci).find((v) => v.id === voceId)
  const archiviato = menu.data?.evento.stato === 'archiviato'
  // Evento archiviato: la ricetta viene dallo snapshot, non dal ricettario attuale.
  const snapshot = useSnapshot(id, archiviato)
  const daSnapshot = snapshot.data?.find((s) => s.stato === 'valido')?.contenuto.piatti.find((p) => p.id === voce?.piattoId)
  const piatto = usePiatto(archiviato ? '' : (voce?.piattoId ?? ''))
  const ricetta: Piatto | undefined = archiviato ? (daSnapshot ? { ...daSnapshot, versione: 0, creatoIl: 0, aggiornatoIl: 0 } : undefined) : piatto.data
  if (menu.isPending || (voce?.piattoId && (archiviato ? snapshot.isPending : piatto.isPending))) return <Caricamento />
  if (!voce?.piattoId || !ricetta) {
    return (
      <Pagina titolo="Vista cucina" indietro={`/eventi/${id}/menu`}>
        <Vuoto titolo="Nessuna ricetta collegata" azione={<Button onClick={() => naviga(`/eventi/${id}/menu`)}>Torna al menù</Button>} />
      </Pagina>
    )
  }
  return <VistaCucina piatto={ricetta} porzioniIniziali={voce.porzioniEffettive} indietro={`/eventi/${id}/menu`} sottotitolo={`${menu.data!.evento.nome} · ${voce.nome}`} />
}
