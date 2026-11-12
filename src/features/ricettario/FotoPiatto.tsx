// Foto del piatto: galleria, aggiunta (anche dalla fotocamera), principale, didascalia, eliminazione.
import { Camera, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { api, nuovoId } from '@/api/client'
import { messaggioErrore, useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Input } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import { type Foto, MASSIMO_FOTO } from '@/contratto/foto.ts'
import { riduciFoto } from '@/lib/immagini'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

export const urlFoto = (id: string) => `/api/v1/foto/${id}`

export function GalleriaFoto({ piattoId, foto, nome }: { piattoId: string; foto: Foto[]; nome: string }) {
  const [aperta, setAperta] = useState<Foto | null>(null)
  const [carica, setCarica] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const puoScrivere = usePuoScrivere()
  const client = useQueryClient()
  const principale = foto.find((f) => f.principale) ?? foto[0]
  const altre = foto.filter((f) => f.id !== principale?.id)
  const posti = MASSIMO_FOTO - foto.length

  async function aggiungi(file: FileList | null) {
    if (!file?.length) return
    const elenco = [...file].slice(0, posti)
    if (file.length > posti) toast.warning(`Al massimo ${MASSIMO_FOTO} foto: aggiungo le prime ${posti}`)
    try {
      for (const [k, f] of elenco.entries()) {
        setCarica(`Foto ${k + 1} di ${elenco.length}…`)
        const ridotta = await riduciFoto(f)
        await api.file('POST', `/piatti/${piattoId}/foto?id=${nuovoId()}`, ridotta)
      }
      toast.success(elenco.length === 1 ? 'Foto aggiunta' : `${elenco.length} foto aggiunte`)
    } catch (e) {
      toast.error(e instanceof Error && !('codice' in e) ? e.message : messaggioErrore(e))
    } finally {
      setCarica(null)
      await client.invalidateQueries()
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section aria-label="Foto" className="flex flex-col gap-2">
      {principale ? (
        <button type="button" onClick={() => setAperta(principale)} className="overflow-hidden rounded-3xl border border-bordo/70 shadow-carta">
          <img src={urlFoto(principale.id)} alt={principale.didascalia || nome} className="aspect-[16/10] w-full object-cover" />
        </button>
      ) : null}
      {altre.length || puoScrivere ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {altre.map((f) => (
            <button key={f.id} type="button" onClick={() => setAperta(f)} className="shrink-0 overflow-hidden rounded-xl border border-bordo/70">
              <img src={urlFoto(f.id)} alt={f.didascalia || nome} className="size-20 object-cover" loading="lazy" />
            </button>
          ))}
          {posti > 0 ? (
            <button
              type="button"
              disabled={!puoScrivere || Boolean(carica)}
              onClick={() => fileRef.current?.click()}
              className={cn('flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-bordo text-xs text-testo-tenue hover:bg-tenue disabled:opacity-50', !foto.length && 'w-auto px-4')}
            >
              <Camera className="size-5" /> {carica ?? (foto.length ? 'Aggiungi' : 'Aggiungi foto')}
            </button>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void aggiungi(e.target.files)} />
        </div>
      ) : null}
      {aperta ? <DettaglioFoto foto={aperta} nome={nome} onChiudi={() => setAperta(null)} /> : null}
    </section>
  )
}

function DettaglioFoto({ foto: f, nome, onChiudi }: { foto: Foto; nome: string; onChiudi: () => void }) {
  const [didascalia, setDidascalia] = useState(f.didascalia)
  const puoScrivere = usePuoScrivere()
  const salva = useScrittura((principale: boolean) => api.modifica(`/foto/${f.id}`, { didascalia, principale, versione: f.versione }), {
    oggetto: 'La foto',
    dopo: onChiudi,
  })
  const elimina = useScrittura(() => api.elimina(`/foto/${f.id}`, f.versione), { oggetto: 'La foto', successo: 'Foto eliminata', dopo: onChiudi })
  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={f.didascalia || nome} className="sm:max-w-3xl">
      <img src={urlFoto(f.id)} alt={f.didascalia || nome} className="max-h-[60dvh] w-full rounded-2xl object-contain" />
      <div className="mt-3 flex flex-col gap-3">
        <Campo etichetta="Didascalia" htmlFor="foto-did">
          <Input id="foto-did" value={didascalia} onChange={(e) => setDidascalia(e.target.value)} />
        </Campo>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variante="fantasma" className="text-pericolo" disabled={!puoScrivere} onClick={() => void elimina.esegui(undefined)}>
            <Trash2 /> Elimina
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {!f.principale ? (
              <Button variante="contorno" disabled={!puoScrivere} onClick={() => void salva.esegui(true)}>
                <Star /> Usa come principale
              </Button>
            ) : null}
            <Button disabled={!puoScrivere} onClick={() => void salva.esegui(f.principale)}>
              Salva
            </Button>
          </div>
        </div>
      </div>
    </Finestra>
  )
}
