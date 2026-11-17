// Confronta con l'anno scorso (SPEC §27): menù, portate, coperti, partecipanti e voti di due
// edizioni della stessa Famiglia.
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { api } from '@/api/client'
import { Caricamento, Vuoto } from '@/components/Pagina'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Select } from '@/components/ui/campi'
import type { Confronto } from '@/contratto/edizioni.ts'
import { formattaCoperti } from '@/domain/porzioni.ts'
import { dataBreve } from '@/domain/tempo.ts'
import { plurale } from '@/lib/formato'
import { useEdizioni } from './Edizioni'
import { CorpoScheda, useEventoCorrente } from './LayoutEvento'

type Piatto = Confronto['aggiunti'][number] | Confronto['mantenuti'][number]['ora']

function Voto({ v }: { v: Piatto['valutazione'] }) {
  if (!v) return null
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-testo-tenue" title={plurale(v.numero, 'voto', 'voti')}>
      <Star className="size-3 fill-current text-avviso" /> {new Intl.NumberFormat('it-IT').format(v.media)} ({v.numero})
    </span>
  )
}

export function PaginaConfronto() {
  const e = useEventoCorrente()
  const [parametri, setParametri] = useSearchParams()
  const ed = useEdizioni(e.id)
  const precedente = ed.data ? [...ed.data.edizioni].reverse().find((x) => x.data < e.data) : undefined
  const con = parametri.get('con') ?? precedente?.id ?? ''
  const q = useQuery({ queryKey: ['confronto', e.id, con], queryFn: () => api.leggi<Confronto>(`/eventi/${e.id}/confronto?con=${encodeURIComponent(con)}`), enabled: Boolean(con) })
  const scelte = ed.data ? [...ed.data.edizioni.map((x) => ({ ...x, serie: true })), ...ed.data.altriEventi.map((x) => ({ ...x, serie: false }))] : []
  if (ed.isPending) return <Caricamento />
  return (
    <CorpoScheda>
      <div className="flex flex-col gap-4">
        <Campo etichetta="Confronta con" htmlFor="confronta-con">
          <Select id="confronta-con" value={con} onChange={(ev) => setParametri(ev.target.value ? { con: ev.target.value } : {}, { replace: true })}>
            <option value="">Scegli un evento…</option>
            {scelte.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome} · {dataBreve(x.data)}
                {x.serie ? ' (stessa ricorrenza)' : ''}
              </option>
            ))}
          </Select>
        </Campo>
        {!con ? (
          <Vuoto titolo="Nessun evento da confrontare" testo={scelte.length ? 'Scegli un evento della stessa Famiglia.' : 'Non ci sono altri eventi della stessa Famiglia che puoi vedere.'} />
        ) : q.isPending ? (
          <Caricamento />
        ) : q.data ? (
          <Risultato c={q.data} ricorrenza={ed.data?.ricorrenza && ed.data.edizioni.some((x) => x.id === con) ? ed.data.ricorrenza.nome : null} />
        ) : (
          <Vuoto titolo="Confronto non disponibile" testo="L'evento scelto non è visibile o è di un'altra Famiglia." />
        )}
      </div>
    </CorpoScheda>
  )
}

/** «+2», «−1,5» o niente se uguali. */
function Differenza({ prima, ora }: { prima: number; ora: number }) {
  const d = ora - prima
  if (!d) return null
  return <span className="ml-1 text-xs text-testo-tenue">({d > 0 ? '+' : '−'}{formattaCoperti(Math.abs(d))})</span>
}

function Risultato({ c, ricorrenza }: { c: Confronto; ricorrenza: string | null }) {
  const persone = (l: Confronto['ora']) =>
    l.partecipanti ? `${plurale(l.partecipanti.confermati, 'confermato', 'confermati')}${l.partecipanti.inAttesa ? `, ${l.partecipanti.inAttesa} in attesa` : ''}` : '—'
  return (
    <>
      <p className="text-sm" data-testid="eventi-confrontati">
        <strong>{c.ora.nome}</strong> ({dataBreve(c.ora.data)}) a confronto con{' '}
        <Link to={`/eventi/${c.prima.id}`} className="font-semibold text-primario underline-offset-2 hover:underline">
          {c.prima.nome}
        </Link>{' '}
        ({dataBreve(c.prima.data)})
        <span className="block text-xs text-testo-tenue">{ricorrenza ? `Stessa ricorrenza: ${ricorrenza}` : 'Evento scelto a mano, senza una ricorrenza in comune'}</span>
      </p>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-testo-tenue">
                <th className="w-24 font-normal" />
                <th className="break-words pr-2 font-medium">Prima</th>
                <th className="break-words font-medium">Ora</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-3 text-testo-tenue">Coperti</td>
                <td>{formattaCoperti(c.prima.coperti.equivalenti)}</td>
                <td>
                  {formattaCoperti(c.ora.coperti.equivalenti)}
                  <Differenza prima={c.prima.coperti.equivalenti} ora={c.ora.coperti.equivalenti} />
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-testo-tenue">Persone</td>
                <td>
                  {c.prima.coperti.adulti} + {c.prima.coperti.bambini} bamb.
                </td>
                <td>
                  {c.ora.coperti.adulti} + {c.ora.coperti.bambini} bamb.
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-testo-tenue">Partecipanti</td>
                <td>{persone(c.prima)}</td>
                <td>{persone(c.ora)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {c.portate.aggiunte.length || c.portate.tolte.length ? (
        <p className="text-sm text-testo-tenue">
          {c.portate.aggiunte.length ? `Portate nuove: ${c.portate.aggiunte.join(', ')}. ` : ''}
          {c.portate.tolte.length ? `Portate non più presenti: ${c.portate.tolte.join(', ')}.` : ''}
        </p>
      ) : null}

      <Sezione titolo="In entrambe" vuoto="Nessun piatto in comune">
        {c.mantenuti.map((m) => (
          <li key={`${m.prima.nome}-${m.ora.nome}-${m.ora.portata}`} className="flex flex-col gap-0.5 py-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{m.ora.nome}</span>
              {m.prima.nome !== m.ora.nome ? <span className="text-xs text-testo-tenue">(prima «{m.prima.nome}»)</span> : null}
              {m.corrispondenza === 'incerta' ? <Badge variante="avviso">stesso nome, ricetta non verificabile</Badge> : null}
            </span>
            <span className="flex flex-wrap gap-x-3 text-xs text-testo-tenue">
              <span>{m.ora.portata}</span>
              {m.prima.porzioni !== m.ora.porzioni ? (
                <span>
                  porzioni {formattaCoperti(m.prima.porzioni)} → {formattaCoperti(m.ora.porzioni)}
                </span>
              ) : null}
              {m.prima.valutazione ? (
                <span className="flex items-center gap-1">
                  {c.prima.nome}: <Voto v={m.prima.valutazione} />
                </span>
              ) : null}
              {m.ora.valutazione ? (
                <span className="flex items-center gap-1">
                  {c.ora.nome}: <Voto v={m.ora.valutazione} />
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </Sezione>
      <Sezione titolo="Nuovi" vuoto="Nessun piatto nuovo">
        {c.aggiunti.map((p) => (
          <RigaPiatto key={`${p.nome}-${p.portata}`} p={p} omonimo={p.omonimo} />
        ))}
      </Sezione>
      <Sezione titolo="Non riproposti" vuoto="Tutti i piatti sono stati riproposti">
        {c.nonRiproposti.map((p) => (
          <RigaPiatto key={`${p.nome}-${p.portata}`} p={p} omonimo={p.omonimo} />
        ))}
      </Sezione>
    </>
  )
}

function RigaPiatto({ p, omonimo }: { p: Piatto; omonimo: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="font-medium">{p.nome}</span>
      <span className="text-xs text-testo-tenue">{p.portata}</span>
      <Voto v={p.valutazione} />
      {omonimo ? <Badge variante="info">ricetta diversa da quella con lo stesso nome</Badge> : null}
    </li>
  )
}

function Sezione({ titolo, vuoto, children }: { titolo: string; vuoto: string; children: React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titolo}</CardTitle>
      </CardHeader>
      <CardContent>
        {children.length ? (
          <ul className="flex flex-col divide-y divide-bordo/60" aria-label={titolo}>
            {children}
          </ul>
        ) : (
          <p className="text-sm text-testo-tenue">{vuoto}</p>
        )}
      </CardContent>
    </Card>
  )
}
