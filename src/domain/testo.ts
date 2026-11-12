// Normalizzazione dei testi per ricerche, unicità e chiavi (SPEC §6.1).

/** Minuscolo, senza accenti, apostrofi uniformati, spazi compattati. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Testo come salvato: NFC e spazi esterni rimossi. */
export function pulisci(s: string): string {
  return s.normalize('NFC').trim()
}
