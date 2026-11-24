// Dettagli di una voce di menù: porzioni, incaricato, spesa, note, piatto collegato.
import { BookOpen, ChefHat, Link2Off, ListTodo } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/api/client'
import { useScrittura } from '@/api/scrittura'
import { Button } from '@/components/ui/button'
import { Campo, Casella, Input, Textarea } from '@/components/ui/campi'
import { cn } from '@/lib/utils'
import { Finestra } from '@/components/ui/dialog'
import { usePuoScrivere } from '@/connessione/stato'
import type { Menu, VoceDelMenu } from '@/contratto/eventi.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import type { Evento, VoceMenu } from '@/domain/tipi.ts'
import { CollegaPiatto } from '@/features/ricettario/CollegaPiatto'
import { ModuloAttivita } from '@/features/piano/ModuloAttivita'
import { IngredientiVoce } from './IngredientiVoce'

interface Dati {
  nome: string
  piattoId: string | null
  porzioni: number | null
  incaricato: string
  inSpesa: boolean
  note: string
  daDefinire: boolean
  contributi: number
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
    daDefinire: voce.daDefinire,
    contributi: voce.contributi,
  })
  const [preparazione, setPreparazione] = useState(false)
  // La voce com'è adesso nel menù (gli ingredienti adattati si salvano a parte, SPEC §44) e la versione
  // da mandare con «Salva»: una variante salvata da qui non deve far scattare un conflitto.
  const viva = menu.portate.flatMap((p) => p.voci).find((x) => x.id === voce.id) ?? voce
  const [versione, setVersione] = useState(voce.versione)
  const [porzioniTesto, setPorzioniTesto] = useState(voce.porzioni === null ? '' : String(voce.porzioni).replace('.', ','))
  const salva = useScrittura((x: Dati & { versione: number }) => api.modifica<VoceMenu>(`/voci/${voce.id}`, x), {
    oggetto: `«${voce.nome}»`,
    dopo: onChiudi,
    sovrascrivi: (x, attuale) => ({ ...x, versione: (attuale as VoceMenu).versione }),
  })
  const porzioniValide = porzioniTesto.trim() === '' || Number(porzioniTesto.replace(',', '.')) > 0
  const modificato = JSON.stringify(d) !== JSON.stringify({
    nome: voce.nome,
    piattoId: voce.piattoId,
    porzioni: voce.porzioni,
    incaricato: voce.incaricato,
    inSpesa: voce.inSpesa,
    note: voce.note,
    daDefinire: voce.daDefinire,
    contributi: voce.contributi,
  })

  return (
    <Finestra aperta onCambia={(a) => !a && onChiudi()} titolo={solaLettura ? voce.nome : 'Voce del menù'}>
      <form
        data-modifiche-non-salvate={modificato}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (d.nome.trim() && porzioniValide) void salva.esegui({ ...d, nome: d.nome.trim(), versione })
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
            {/* «A cura di» è lo stesso incarico di «Chi porta» (persona, spesa, fatto): si gestisce
                là, qui si legge. Un solo posto, nessun incarico scritto due volte (SPEC §31.2). */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">A cura di</span>
              <p className="flex min-h-11 flex-wrap items-center gap-2 text-sm" data-testid="a-cura-di">
                <span className="flex-1">{voce.incaricato || <span className="text-testo-tenue">Nessuno</span>}</span>
                <Link to={`/eventi/${evento.id}/chi-porta?incarico=${encodeURIComponent(`voce:${voce.id}`)}`} className="text-primario underline-offset-2 hover:underline" onClick={onChiudi}>
                  {voce.incaricato ? 'Cambia in Chi porta' : 'Affida in Chi porta'}
                </Link>
              </p>
            </div>
          </div>
          {/* Contributo a scelta di chi lo porta (SPEC §39): nessuna ricetta, fuori dalla spesa. */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-bordo px-3 py-3 text-sm">
            <label className="flex flex-1 basis-56 items-center gap-3">
              <Casella checked={d.daDefinire} onChange={(e) => setD({ ...d, daDefinire: e.target.checked, piattoId: e.target.checked ? null : d.piattoId })} />
              <span>
                <strong className="font-medium">Da definire</strong>
                <span className="block text-testo-tenue">A scelta di chi lo porta: si precisa più tardi.</span>
              </span>
            </label>
            <label className="flex items-center gap-2">
              Quanti
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                className="w-20"
                aria-label="Quanti contributi"
                value={d.contributi}
                onChange={(e) => setD({ ...d, contributi: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </label>
          </div>
          <label className={cn('flex items-center gap-3 rounded-xl border border-bordo px-3 py-3 text-sm', d.daDefinire && 'opacity-60')}>
            <Casella checked={d.inSpesa && !d.daDefinire} disabled={d.daDefinire} onChange={(e) => setD({ ...d, inSpesa: e.target.checked })} />
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
          ) : null}
          {/* Ingredienti adattati per questo evento (SPEC §44): solo con la ricetta già collegata. */}
          {d.piattoId && voce.piattoId === d.piattoId && !d.daDefinire ? (
            <IngredientiVoce voce={viva} solaLettura={solaLettura} onSalvata={(v) => setVersione(v.versione)} />
          ) : null}
          {d.piattoId ? null : solaLettura ? (
            <p className="text-sm text-testo-tenue">Nessuna ricetta collegata.</p>
          ) : (
            <CollegaPiatto voce={voce} onCollega={(piattoId) => setD({ ...d, piattoId })} onCreato={onChiudi} />
          )}
        </div>

        {!solaLettura ? (
          <Button variante="contorno" disabled={!puoScrivere} onClick={() => setPreparazione(true)}>
            <ListTodo /> Aggiungi preparazione al piano
          </Button>
        ) : null}
        {!solaLettura ? (
          <Button type="submit" misura="grande" disabled={salva.inCorso || !d.nome.trim() || !porzioniValide || !puoScrivere}>
            {salva.inCorso ? 'Salvataggio…' : 'Salva'}
          </Button>
        ) : null}
      </form>
      {preparazione ? (
        <ModuloAttivita
          evento={evento}
          attivita={null}
          voci={menu.portate.flatMap((p) => p.voci)}
          voceIniziale={voce.id}
          onChiudi={() => setPreparazione(false)}
        />
      ) : null}
    </Finestra>
  )
}
