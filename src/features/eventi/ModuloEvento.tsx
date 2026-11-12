// Modulo evento: creazione e modifica (SPEC F2).
import { useMemo, useState } from 'react'
import { Contatore } from '@/components/Contatore'
import { Button } from '@/components/ui/button'
import { Campo, Input, Select, Textarea } from '@/components/ui/campi'
import { copertiEquivalenti, formattaCoperti } from '@/domain/porzioni.ts'
import { nomeSuggerito, OCCASIONI_SUGGERITE } from '@/domain/regole/evento.ts'
import { TIPI_EVENTO, type TipoEvento } from '@/domain/tipi.ts'
import { usePuoScrivere } from '@/connessione/stato'

export interface DatiModuloEvento {
  nome: string
  data: string
  oraServizio: string | null
  tipo: TipoEvento
  occasione: string
  adulti: number
  bambini: number
  coefficienteBambini: number
  note: string
}

const NOMI_TIPO: Record<TipoEvento, string> = { pranzo: 'Pranzo', cena: 'Cena', aperitivo: 'Aperitivo', brunch: 'Brunch' }
const COEFFICIENTI = Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100)

export function ModuloEvento({
  iniziale,
  onSalva,
  inCorso,
  etichetta,
  errori = {},
}: {
  iniziale: DatiModuloEvento
  onSalva: (d: DatiModuloEvento) => void
  inCorso: boolean
  etichetta: string
  errori?: Record<string, string>
}) {
  const [d, setD] = useState(iniziale)
  const [nomeToccato, setNomeToccato] = useState(Boolean(iniziale.nome))
  const puoScrivere = usePuoScrivere()
  const coperti = useMemo(() => copertiEquivalenti(d), [d])
  const modificato = JSON.stringify(d) !== JSON.stringify(iniziale)

  function cambia<K extends keyof DatiModuloEvento>(k: K, v: DatiModuloEvento[K]) {
    setD((x) => {
      const nuovo = { ...x, [k]: v }
      if (!nomeToccato && (k === 'occasione' || k === 'data')) nuovo.nome = nomeSuggerito(nuovo.occasione, nuovo.data)
      return nuovo
    })
  }

  const nomeVuoto = !d.nome.trim()
  return (
    <form
      data-modifiche-non-salvate={modificato}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!nomeVuoto) onSalva({ ...d, nome: d.nome.trim() })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Occasione" htmlFor="ev-occasione" aiuto="Es. Natale, compleanno di Giulia">
          <Input id="ev-occasione" list="occasioni" value={d.occasione} onChange={(e) => cambia('occasione', e.target.value)} />
          <datalist id="occasioni">
            {OCCASIONI_SUGGERITE.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Campo>
        <Campo etichetta="Tipo" htmlFor="ev-tipo">
          <Select id="ev-tipo" value={d.tipo} onChange={(e) => cambia('tipo', e.target.value as TipoEvento)}>
            {TIPI_EVENTO.map((t) => (
              <option key={t} value={t}>
                {NOMI_TIPO[t]}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo etichetta="Nome dell'evento" htmlFor="ev-nome" errore={errori.nome}>
        <Input
          id="ev-nome"
          required
          value={d.nome}
          placeholder="Natale 2026"
          onChange={(e) => {
            setNomeToccato(true)
            cambia('nome', e.target.value)
          }}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo etichetta="Data" htmlFor="ev-data" errore={errori.data}>
          <Input id="ev-data" type="date" required value={d.data} onChange={(e) => cambia('data', e.target.value)} />
        </Campo>
        <Campo etichetta="Ora di servizio" htmlFor="ev-ora" errore={errori.oraServizio}>
          <Input id="ev-ora" type="time" value={d.oraServizio ?? ''} onChange={(e) => cambia('oraServizio', e.target.value || null)} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etichetta="Adulti" htmlFor="ev-adulti">
          <Contatore id="ev-adulti" etichetta="adulti" valore={d.adulti} onCambia={(n) => cambia('adulti', n)} />
        </Campo>
        <Campo etichetta="Bambini" htmlFor="ev-bambini">
          <Contatore id="ev-bambini" etichetta="bambini" valore={d.bambini} onCambia={(n) => cambia('bambini', n)} />
        </Campo>
        <Campo etichetta="Un bambino conta come" htmlFor="ev-coeff" aiuto="Frazione di porzione adulta">
          <Select id="ev-coeff" value={String(d.coefficienteBambini)} onChange={(e) => cambia('coefficienteBambini', Number(e.target.value))}>
            {COEFFICIENTI.map((c) => (
              <option key={c} value={c}>
                {new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(c)} adulti
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <p className="rounded-xl bg-primario-tenue px-3 py-2 text-sm text-primario">
        <strong>{formattaCoperti(coperti)} coperti equivalenti</strong> — le porzioni del menù seguono questo numero, salvo quelle indicate a mano.
      </p>
      <Campo etichetta="Note" htmlFor="ev-note">
        <Textarea id="ev-note" value={d.note} onChange={(e) => cambia('note', e.target.value)} placeholder="Ospiti, intolleranze, idee…" />
      </Campo>
      <Button type="submit" misura="grande" disabled={inCorso || nomeVuoto || !d.data || !puoScrivere}>
        {inCorso ? 'Salvataggio…' : etichetta}
      </Button>
    </form>
  )
}
