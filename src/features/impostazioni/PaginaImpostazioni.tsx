// Impostazioni: portate predefinite, coefficiente bambini, reparti, tema del dispositivo (SPEC §5).
import { ArrowDown, ArrowUp, Carrot, ChevronRight, CircleUserRound, Database, Plus, Trash2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, nuovoId } from '@/api/client'
import { useImpostazioni, useReparti } from '@/api/query'
import { useScrittura } from '@/api/scrittura'
import { Caricamento, Pagina } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Campo, Input, Select } from '@/components/ui/campi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Conferma } from '@/components/ui/dialog'
import { SolaLettura, usePuoScrivere } from '@/connessione/stato'
import { useUtenteCorrente } from '@/features/accesso/sessione'
import type { Impostazioni, Reparto } from '@/domain/tipi.ts'

type Tema = 'sistema' | 'chiaro' | 'scuro'
type Testo = 'auto' | 'normale' | 'grande' | 'molto-grande' | 'enorme'

function leggiTesto(): Testo {
  try {
    return (localStorage.getItem('menuapp.testo') as Testo | null) ?? 'auto'
  } catch {
    return 'auto'
  }
}

function applicaTesto(t: Testo) {
  try {
    localStorage.setItem('menuapp.testo', t)
  } catch {
    // preferenza non salvabile: vale solo per questa sessione
  }
  document.documentElement.setAttribute('data-testo', t)
}

function leggiTema(): Tema {
  try {
    return (localStorage.getItem('menuapp.tema') as Tema | null) ?? 'sistema'
  } catch {
    return 'sistema'
  }
}

export function applicaTema(t: Tema) {
  try {
    localStorage.setItem('menuapp.tema', t)
  } catch {
    // preferenza non salvabile: vale solo per questa sessione
  }
  const scuro = t === 'scuro' || (t === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', scuro)
}

const COEFFICIENTI = Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100)

export function PaginaImpostazioni() {
  const [tema, setTema] = useState<Tema>(leggiTema)
  const [testo, setTesto] = useState<Testo>(leggiTesto)
  const { utente, amministratore, ingressoPrivato } = useUtenteCorrente()
  return (
    <Pagina titolo="Impostazioni">
      <div className="flex flex-col gap-4">
        <Link to="/account" className="flex items-center gap-3 rounded-2xl border border-bordo bg-carta p-4 hover:bg-tenue/60">
          <CircleUserRound className="size-5 text-primario" />
          <span className="flex-1">
            <span className="block font-medium">Il mio account · {utente?.nome}</span>
            <span className="text-sm text-testo-tenue">Dispositivi autorizzati, nuovo dispositivo, i miei dati</span>
          </span>
          <ChevronRight className="size-5 text-testo-tenue" />
        </Link>
        <Link to="/ingredienti" className="flex items-center gap-3 rounded-2xl border border-bordo bg-carta p-4 hover:bg-tenue/60">
          <Carrot className="size-5 text-primario" />
          <span className="flex-1">
            <span className="block font-medium">Ingredienti</span>
            <span className="text-sm text-testo-tenue">Catalogo comune: reparti, sinonimi, unità</span>
          </span>
          <ChevronRight className="size-5 text-testo-tenue" />
        </Link>
        {amministratore && ingressoPrivato ? (
          <Link to="/impostazioni/utenti" className="flex items-center gap-3 rounded-2xl border border-bordo bg-carta p-4 hover:bg-tenue/60">
            <UsersRound className="size-5 text-primario" />
            <span className="flex-1">
              <span className="block font-medium">Utenti e dispositivi</span>
              <span className="text-sm text-testo-tenue">Nuovi utenti e inviti, approvazioni, dispositivi di tutti</span>
            </span>
            <ChevronRight className="size-5 text-testo-tenue" />
          </Link>
        ) : null}
        {amministratore && ingressoPrivato ? (
          <Link to="/impostazioni/dati" className="flex items-center gap-3 rounded-2xl border border-bordo bg-carta p-4 hover:bg-tenue/60">
            <Database className="size-5 text-primario" />
            <span className="flex-1">
              <span className="block font-medium">Dati e backup</span>
              <span className="text-sm text-testo-tenue">Stato del server, backup, esportazione, ripristino</span>
            </span>
            <ChevronRight className="size-5 text-testo-tenue" />
          </Link>
        ) : null}
        {/* Impostazioni comuni a tutti: le cambia l'amministratore. */}
        <SolaLettura motivo={amministratore ? null : 'Le cambia l\'amministratore'}>
          {!amministratore ? <p className="-mb-2 text-sm text-testo-tenue">Portate proposte e reparti sono comuni a tutti: li cambia l&apos;amministratore.</p> : null}
          <ImpostazioniEventi />
          <GestioneReparti />
        </SolaLettura>
        <Card>
          <CardHeader>
            <CardTitle>Aspetto</CardTitle>
          </CardHeader>
          <CardContent>
            <Campo etichetta="Tema (solo su questo dispositivo)" htmlFor="tema">
              <Select
                id="tema"
                value={tema}
                onChange={(e) => {
                  const t = e.target.value as Tema
                  setTema(t)
                  applicaTema(t)
                }}
              >
                <option value="sistema">Come il sistema</option>
                <option value="chiaro">Chiaro</option>
                <option value="scuro">Scuro</option>
              </Select>
            </Campo>
            <Campo etichetta="Dimensione del testo (solo su questo dispositivo)" htmlFor="testo" aiuto="«Automatica» ingrandisce tutto sugli schermi grandi, come l'Echo Show 15." className="mt-4">
              <Select
                id="testo"
                value={testo}
                onChange={(e) => {
                  const t = e.target.value as Testo
                  setTesto(t)
                  applicaTesto(t)
                }}
              >
                <option value="auto">Automatica</option>
                <option value="normale">Normale</option>
                <option value="grande">Grande</option>
                <option value="molto-grande">Molto grande</option>
                <option value="enorme">Enorme</option>
              </Select>
            </Campo>
          </CardContent>
        </Card>
      </div>
    </Pagina>
  )
}

function ImpostazioniEventi() {
  const imp = useImpostazioni()
  if (!imp.data) return <Caricamento />
  // Rimontato quando le impostazioni cambiano sul server (anche da un altro dispositivo).
  return <ModuloImpostazioni key={imp.data.versione} imp={imp.data} />
}

function ModuloImpostazioni({ imp: dati }: { imp: Impostazioni }) {
  const imp = { data: dati }
  const puoScrivere = usePuoScrivere()
  const [portate, setPortate] = useState(() => dati.portatePredefinite.map((p) => ({ id: p.id, nome: p.nome })))
  const [coeff, setCoeff] = useState(dati.coefficienteBambini)
  const salva = useScrittura(
    (versione: number) => api.modifica<Impostazioni>('/impostazioni', { coefficienteBambini: coeff, portatePredefinite: portate.map((p) => ({ id: p.id, nome: p.nome.trim() })), versione }),
    { oggetto: 'Le impostazioni', sovrascrivi: (_v, a) => (a as Impostazioni).versione },
  )
  const modificato =
    coeff !== imp.data.coefficienteBambini || JSON.stringify(portate) !== JSON.stringify(imp.data.portatePredefinite.map((p) => ({ id: p.id, nome: p.nome })))
  const valide = portate.length > 0 && portate.every((p) => p.nome.trim())
  function sposta(i: number, delta: number) {
    const r = [...portate]
    const [x] = r.splice(i, 1)
    r.splice(i + delta, 0, x!)
    setPortate(r)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovi eventi</CardTitle>
        <p className="text-sm text-testo-tenue">Valori proposti alla creazione di un evento; ogni evento poi ha i suoi.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4" data-modifiche-non-salvate={modificato}>
        <Campo etichetta="Un bambino conta come" htmlFor="imp-coeff">
          <Select id="imp-coeff" value={String(coeff)} onChange={(e) => setCoeff(Number(e.target.value))}>
            {COEFFICIENTI.map((c) => (
              <option key={c} value={c}>
                {new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(c)} adulti
              </option>
            ))}
          </Select>
        </Campo>
        <div>
          <p className="mb-1.5 text-sm font-medium">Portate predefinite</p>
          <ul className="flex flex-col gap-1.5">
            {portate.map((p, i) => (
              <li key={p.id} className="flex items-center gap-1">
                <Input aria-label={`Portata ${i + 1}`} value={p.nome} onChange={(e) => setPortate(portate.map((x) => (x.id === p.id ? { ...x, nome: e.target.value } : x)))} />
                <Button variante="fantasma" misura="iconaPiccola" aria-label="Su" disabled={i === 0} onClick={() => sposta(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variante="fantasma" misura="iconaPiccola" aria-label="Giù" disabled={i === portate.length - 1} onClick={() => sposta(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button variante="fantasma" misura="iconaPiccola" aria-label={`Elimina ${p.nome}`} disabled={portate.length === 1} onClick={() => setPortate(portate.filter((x) => x.id !== p.id))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <Button variante="fantasma" misura="piccolo" className="mt-2" onClick={() => setPortate([...portate, { id: nuovoId(), nome: '' }])}>
            <Plus /> Aggiungi portata
          </Button>
        </div>
        <Button disabled={!modificato || !valide || salva.inCorso || !puoScrivere} onClick={() => void salva.esegui(imp.data.versione)}>
          Salva
        </Button>
      </CardContent>
    </Card>
  )
}

function GestioneReparti() {
  const reparti = useReparti()
  const puoScrivere = usePuoScrivere()
  const [nuovo, setNuovo] = useState('')
  const [elimina, setElimina] = useState<Reparto | null>(null)
  const crea = useScrittura((nome: string) => api.crea<Reparto>('/reparti', { id: `rep-${nuovoId().slice(0, 8)}`, nome }), { dopo: () => setNuovo('') })
  const rinomina = useScrittura((d: { r: Reparto; nome: string }) => api.modifica(`/reparti/${d.r.id}`, { nome: d.nome, versione: d.r.versione }), { oggetto: 'Il reparto' })
  const riordina = useScrittura((voci: { id: string; versione: number }[]) => api.modifica('/reparti/ordine', { voci }), { successo: null, oggetto: 'I reparti' })
  const cancella = useScrittura((r: Reparto) => api.elimina(`/reparti/${r.id}`, r.versione), { oggetto: 'Il reparto', successo: 'Reparto eliminato' })
  const elenco = reparti.data ?? []
  function sposta(i: number, delta: number) {
    const r = elenco.map((x) => ({ id: x.id, versione: x.versione }))
    const [x] = r.splice(i, 1)
    r.splice(i + delta, 0, x!)
    void riordina.esegui(r)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reparti del supermercato</CardTitle>
        <p className="text-sm text-testo-tenue">L'ordine dei reparti è l'ordine della lista della spesa.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {elenco.map((r, i) => (
          <RigaReparto
            key={`${r.id}-${r.versione}`}
            reparto={r}
            primo={i === 0}
            ultimo={i === elenco.length - 1}
            disabilitato={!puoScrivere}
            onRinomina={(nome) => void rinomina.esegui({ r, nome })}
            onSposta={(d) => sposta(i, d)}
            onElimina={() => setElimina(r)}
          />
        ))}
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (nuovo.trim()) void crea.esegui(nuovo.trim())
          }}
        >
          <Input aria-label="Nuovo reparto" placeholder="Nuovo reparto…" value={nuovo} onChange={(e) => setNuovo(e.target.value)} />
          <Button type="submit" variante="secondario" disabled={!nuovo.trim() || !puoScrivere}>
            <Plus /> Aggiungi
          </Button>
        </form>
      </CardContent>
      <Conferma
        aperta={elimina !== null}
        onCambia={(a) => !a && setElimina(null)}
        pericolosa
        titolo={`Eliminare il reparto «${elimina?.nome}»?`}
        descrizione="I suoi ingredienti passeranno al reparto «Altro»."
        etichettaConferma="Elimina"
        onConferma={() => elimina && void cancella.esegui(elimina)}
      />
    </Card>
  )
}

function RigaReparto({
  reparto,
  primo,
  ultimo,
  disabilitato,
  onRinomina,
  onSposta,
  onElimina,
}: {
  reparto: Reparto
  primo: boolean
  ultimo: boolean
  disabilitato: boolean
  onRinomina: (nome: string) => void
  onSposta: (delta: number) => void
  onElimina: () => void
}) {
  const [nome, setNome] = useState(reparto.nome)
  return (
    <div className="flex items-center gap-1">
      <Input
        aria-label={`Reparto ${reparto.nome}`}
        value={nome}
        disabled={disabilitato}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome.trim() && nome.trim() !== reparto.nome && onRinomina(nome.trim())}
      />
      <Button variante="fantasma" misura="iconaPiccola" aria-label="Su" disabled={primo || disabilitato} onClick={() => onSposta(-1)}>
        <ArrowUp />
      </Button>
      <Button variante="fantasma" misura="iconaPiccola" aria-label="Giù" disabled={ultimo || disabilitato} onClick={() => onSposta(1)}>
        <ArrowDown />
      </Button>
      <Button variante="fantasma" misura="iconaPiccola" aria-label={`Elimina ${reparto.nome}`} disabled={reparto.diSistema || disabilitato} onClick={onElimina}>
        <Trash2 />
      </Button>
    </div>
  )
}
