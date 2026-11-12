// Serializzazione canonica per l'impronta delle esportazioni (SPEC §11.3).
// Chiavi degli oggetti in ordine alfabetico a ogni livello, ordine degli array conservato,
// nessuno spazio. Due oggetti uguali producono sempre la stessa stringa.

export function serializzaCanonico(valore: unknown): string {
  return JSON.stringify(ordina(valore))
}

function ordina(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordina)
  if (v !== null && typeof v === 'object') {
    const risultato: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const x = (v as Record<string, unknown>)[k]
      if (x !== undefined) risultato[k] = ordina(x)
    }
    return risultato
  }
  return v
}
