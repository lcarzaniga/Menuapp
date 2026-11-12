// Coperti equivalenti, porzioni effettive e fattore di scalatura (SPEC §7.1, §9.1).

export const TOLLERANZA = 1e-6

/** adulti + bambini × coefficiente; decimale, mai arrotondato. */
export function copertiEquivalenti(e: { adulti: number; bambini: number; coefficienteBambini: number }): number {
  return arrotondaPrecisione(e.adulti + e.bambini * e.coefficienteBambini)
}

/** Porzioni di una voce: le sue, oppure i coperti equivalenti dell'evento. */
export function porzioniEffettive(voce: { porzioni: number | null }, coperti: number): number {
  return voce.porzioni ?? coperti
}

/** Fattore porzioni/porzioniBase; null se il piatto non ha porzioni base valide. */
export function fattoreScalatura(porzioni: number, porzioniBase: number | null): number | null {
  if (porzioniBase === null || !(porzioniBase > 0)) return null
  return arrotondaPrecisione(porzioni / porzioniBase)
}

export function scala(quantita: number, fattore: number, scalatura: 'proporzionale' | 'fissa'): number {
  return scalatura === 'fissa' ? quantita : arrotondaPrecisione(quantita * fattore)
}

/** Fattori molto alti o bassi meritano un avviso (SPEC §9.2). */
export function fattoreAnomalo(fattore: number | null): boolean {
  return fattore !== null && (fattore > 4 || fattore < 0.25)
}

/** Elimina il rumore della virgola mobile (0.1 + 0.2) senza arrotondare davvero. */
export function arrotondaPrecisione(n: number): number {
  return Math.round(n * 1e9) / 1e9
}

export function quasiUguali(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLLERANZA * Math.max(1, Math.abs(a), Math.abs(b))
}

export function formattaCoperti(n: number): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(n)
}
