// Centro notifiche interno (SPEC §20.6): raggruppate per chiave, mai a chi ha compiuto
// l'azione, filtrate dalle preferenze. In lettura i permessi si ricontrollano: le notifiche
// su risorse non più accessibili spariscono (e vengono cancellate).
import { randomUUID } from 'node:crypto'
import type { Notifica, TipoNotifica } from '../../src/contratto/famiglia.ts'
import { TIPI_NOTIFICA } from '../../src/contratto/famiglia.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repoEventi from '../db/repo/eventi.ts'
import * as repo from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import { permessoEvento, type UtenteCorrente } from './permessi.ts'

export interface Avviso {
  tipo: TipoNotifica
  /** Chi ha compiuto l'azione: non riceve la notifica. */
  attoreId: string
  destinatari: Iterable<string>
  /** Aggiornamenti con la stessa chiave non letti diventano una notifica sola con un contatore. */
  chiave: string
  gruppoId?: string | null
  eventoId?: string | null
  messaggioId?: string | null
  piattoId?: string | null
  testo: string
}

/** Registra un avviso per i destinatari (da chiamare dentro la transazione dell'azione). */
export function avvisa(db: Db, a: Avviso, adesso = Date.now()): void {
  const testo = a.testo.replace(/\s+/g, ' ').trim().slice(0, 160)
  for (const utenteId of new Set(a.destinatari)) {
    if (utenteId === a.attoreId) continue
    if (repo.notificheDisattivate(db, utenteId).includes(a.tipo)) continue
    repo.registraNotifica(
      db,
      {
        id: randomUUID(),
        utenteId,
        tipo: a.tipo,
        chiave: a.chiave,
        gruppoId: a.gruppoId ?? null,
        eventoId: a.eventoId ?? null,
        messaggioId: a.messaggioId ?? null,
        piattoId: a.piattoId ?? null,
        attoreId: a.attoreId,
        testo,
      },
      adesso,
    )
  }
}

/** Persone che seguono un evento: proprietario e invitati. */
export const personeEvento = (db: Db, eventoId: string) => repoAccesso.personeEvento(db, eventoId)
/** Membri attivi di un gruppo. */
export const membriGruppo = (db: Db, gruppoId: string) => repoAccesso.membriGruppo(db, gruppoId).map((m) => m.utente_id)

/** La risorsa della notifica è ancora accessibile all'utente? */
function accessibile(db: Db, u: UtenteCorrente, n: repo.RigaNotifica): boolean {
  if (n.evento_id && !permessoEvento(db, u, n.evento_id)) return false
  if (n.gruppo_id && !repoAccesso.ruoloNelGruppo(db, n.gruppo_id, u.id)) return false
  if (n.piatto_id) {
    const proprietario = repoAccesso.proprietarioPiatto(db, n.piatto_id)
    if (!proprietario || (proprietario !== u.id && !repoAccesso.piattoLeggibileDaAltri(db, n.piatto_id, u.id))) return false
  }
  return true
}

function collegamento(n: repo.RigaNotifica): string {
  const ancora = n.messaggio_id ? `?messaggio=${n.messaggio_id}` : ''
  if (n.evento_id) {
    if (n.tipo === 'incarico') return `/eventi/${n.evento_id}/chi-porta`
    if (n.tipo === 'menu' || n.tipo === 'valutazione' || n.tipo === 'condivisione') return n.tipo === 'condivisione' ? `/eventi/${n.evento_id}` : `/eventi/${n.evento_id}/menu`
    return `/eventi/${n.evento_id}/bacheca${ancora}`
  }
  if (n.gruppo_id) return `/famiglia${ancora}`
  if (n.piatto_id) return `/ricettario/${n.piatto_id}`
  return '/notifiche'
}

function titolo(db: Db, n: repo.RigaNotifica): string {
  if (n.evento_id) return repoEventi.leggiEvento(db, n.evento_id)?.nome ?? 'Evento'
  if (n.gruppo_id) return repoAccesso.elencaGruppi(db).find((g) => g.id === n.gruppo_id)?.nome ?? 'Famiglia'
  if (n.piatto_id) return repoRic.leggiPiatto(db, n.piatto_id)?.nome ?? 'Ricetta'
  return 'Ricette di famiglia & Co.'
}

function famiglia(db: Db, n: repo.RigaNotifica): string | null {
  const g = n.gruppo_id ?? (n.evento_id ? repoAccesso.gruppoEvento(db, n.evento_id) : null)
  return g ? (repoAccesso.leggiGruppo(db, g)?.nome ?? null) : null
}

/** Notifiche dell'utente, ricontrollando i permessi: quelle non più accessibili si cancellano. */
export function elencaNotifiche(db: Db, u: UtenteCorrente, adesso = Date.now()): Notifica[] {
  return transazione(db, () => {
    repo.pulisciNotificheVecchie(db, u.id, adesso - 60 * 24 * 3600_000)
    const visibili: Notifica[] = []
    for (const n of repo.notificheUtente(db, u.id)) {
      if (!accessibile(db, u, n)) {
        repo.eliminaNotifica(db, n.id)
        continue
      }
      visibili.push({
        id: n.id,
        tipo: (TIPI_NOTIFICA as readonly string[]).includes(n.tipo) ? (n.tipo as TipoNotifica) : 'menu',
        titolo: titolo(db, n),
        famiglia: famiglia(db, n),
        testo: n.testo,
        attore: n.attore_nome,
        conteggio: n.conteggio,
        collegamento: collegamento(n),
        letta: n.letta_il !== null,
        aggiornatoIl: n.aggiornato_il,
      })
    }
    return visibili
  })
}

export const contaNonLette = (db: Db, u: UtenteCorrente) => elencaNotifiche(db, u).filter((n) => !n.letta).length

export function segnaLetta(db: Db, u: UtenteCorrente, id: string): void {
  repo.segnaLetta(db, id, u.id, Date.now())
}
export function segnaTutteLette(db: Db, u: UtenteCorrente): void {
  repo.segnaTutteLette(db, u.id, Date.now())
}

export const preferenze = (db: Db, u: UtenteCorrente) => ({ disattivate: repo.notificheDisattivate(db, u.id) as TipoNotifica[] })
export function impostaPreferenze(db: Db, u: UtenteCorrente, disattivate: TipoNotifica[]) {
  transazione(db, () => {
    repo.scriviPreferenze(db, u.id, [...new Set(disattivate)])
    incrementaRevisione(db)
  })
  return preferenze(db, u)
}
