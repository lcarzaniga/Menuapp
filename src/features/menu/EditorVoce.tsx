// Dettagli di una voce di menù: porzioni, incaricato, spesa, note, piatto collegato.
import { BookOpen, ChefHat, Link2Off } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Textarea } from '@/components/ui/campi'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu, VoceDelMenu } from '@/contratto/eventi.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import type { Evento, VoceMenu } from '@/domain/tipi.ts'
import { CollegaPiatto } from '@/features/ricettario/CollegaPiatto'

interface Dati {
  nome: string
  piattoId: string | null
  porzioni: number | null
  incaricato: string
  inSpesa: boolean
  note: string
}

export function EditorVoce({ evento, menu, voce, onChiudi }: { evento: Evento; menu: Menu; voce: VoceDelMenu; onChiudi: () => void }) {
  const solaLettura = evento.stato === 'archiviato'
  const puoScrivere = usePuoScrivere()
  const [d, setD] = useState<Dati>({
    nome: voce.nome,
    piattoId: voce.piattoId,
    porzioni: voce.porzioni,
    incaricato: voce.incaricato,
    inSpesa: voce.inSpesa,
    note: voce.note,
  })
  const [porzioniTesto, setPorzioniTesto] = useState(voce.porzioni === null ? '' : String(voce.porzioni).replace('.', ','))
  const incaricati = [...new Set(menu.portate.flatMap((p) => p.voci.map((v) => v.incaricato)).filter(Boolean))]
  const salva = useScrittura((x: Dati & { versione: number }) => api.modifica<VoceMenu>(`/voci/${voce.id}`, x), {
    oggetto: `«${voce.nome}»`,
    dopo: onChiudi,
    sovrascrivi: (x, attuale) => ({ ...x, versione: (attuale as VoceMenu).versione }),
  })
  const porzioniValide = porzioniTesto.trim() === '' || Number(porzioniTesto.replace(',', '.')) > 0
  const modificato = JSON.stringify(d) !== JSON.stringify({ nome: voce.nome, piattoId: voce.piattoId, porzioni: voce.porzioni, incaricato: voce.incaricato, inSpesa: voce.inSpesa, note: voce.note })

  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={solaLettura ? voce.nome : 'Voce del menù'}>
      <form
        data-modifiche-non-salvate={modificato}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (d.nome.trim() && porzioniValide) void salva.esegui({ ...d, nome: d.nome.trim(), versione: voce.versione })
        }}
      >
        <fieldset disabled={solaLettura} className="flex flex-col gap-4">
          <Campo etichetta="Nome nel menù" htmlFor="voce-nome">
            <Input id="voce-nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} required />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etichetta="Porzioni"
              htmlFor="voce-porzioni"
              aiuto={d.porzioni === null ? `Seguono i coperti (${formattaCoperti(menu.copertiEquivalenti)})` : 'Indicate a mano'}
              errore={porzioniValide ? undefined : 'Numero maggiore di zero'}
            >
              <Input
                id="voce-porzioni"
                inputMode="decimal"
                placeholder={formattaCoperti(menu.copertiEquivalenti)}
                value={porzioniTesto}
                onChange={(e) => {
                  setPorzioniTesto(e.target.value)
                  const n = Number(e.target.value.replace(',', '.'))
                  setD({ ...d, porzioni: e.target.value.trim() === '' || !(n > 0) ? null : n })
                }}
              />
            </Campo>
            <Campo etichetta="Chi lo prepara" htmlFor="voce-incaricato">
              <Input id="voce-incaricato" list="incaricati" value={d.incaricato} placeholder="Facoltativo" onChange={(e) => setD({ ...d, incaricato: e.target.value })} />
              <datalist id="incaricati">
                {incaricati.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </Campo>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-bordo px-3 py-3 text-sm">
            <Casella checked={d.inSpesa} onChange={(e) => setD({ ...d, inSpesa: e.target.checked })} />
            <span>
              <strong className="font-medium">Includi nella spesa</strong>
              <span className="block text-testo-tenue">Togli la spunta se lo porta qualcun altro o è già pronto.</span>
            </span>
          </label>
          <Campo etichetta="Note" htmlFor="voce-note">
            <Textarea id="voce-note" className="min-h-16" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </Campo>
        </fieldset>

        <div className="rounded-xl bg-tenue p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ChefHat className="size-4" /> Ricetta
          </p>
          {d.piattoId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variante="contorno" misura="piccolo">
                <Link to={`/ricettario/${d.piattoId}`}>
                  <BookOpen /> {voce.piattoId === d.piattoId ? (voce.piattoNome ?? 'Apri ricetta') : 'Ricetta scelta'}
                </Link>
              </Button>
              {voce.piattoId === d.piattoId ? (
                <Button asChild variante="contorno" misura="piccolo">
                  <Link to={`/eventi/${evento.id}/voci/${voce.id}/cucina`}>
                    <ChefHat /> Cucina
                  </Link>
                </Button>
              ) : null}
              {!solaLettura ? (
                <Button variante="fantasma" misura="piccolo" onClick={() => setD({ ...d, piattoId: null })}>
                  <Link2Off /> Scollega
                </Button>
              ) : null}
            </div>
          ) : solaLettura ? (
            <p className="text-sm text-testo-tenue">Nessuna ricetta collegata.</p>
          ) : (
            <CollegaPiatto voce={voce} onCollega={(piattoId) => setD({ ...d, piattoId })} onCreato={onChiudi} />
          )}
        </div>

        {!solaLettura ? (
          <Button type="submit" misura="grande" disabled={salva.inCorso || !d.nome.trim() || !porzioniValide || !puoScrivere}>
            {salva.inCorso ? 'Salvataggio…' : 'Salva'}
          </Button>
        ) : null}
      </form>
    </Finestra>
  )
}
