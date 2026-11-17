// Apertura da una notifica (SPEC §29.1): l'elemento indicato nell'indirizzo (?messaggio=…,
// ?incarico=…) viene portato in vista ed evidenziato; se non esiste più lo si dice.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/** Id dell'elemento da evidenziare e se manca (eliminato o non più visibile), a dati caricati. */
export function useEvidenzia(parametro: string, prefisso: string, pronto: boolean): { id: string | null; mancante: boolean } {
  const [parametri] = useSearchParams()
  const id = parametri.get(parametro)
  const [mancante, setMancante] = useState(false)
  useEffect(() => {
    if (!id || !pronto) return
    // Dopo il disegno della pagina: l'elemento c'è solo se la lista è già mostrata.
    const attesa = requestAnimationFrame(() => {
      const el = document.getElementById(`${prefisso}${id}`)
      setMancante(!el)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(attesa)
  }, [id, pronto, prefisso])
  return { id, mancante: Boolean(id) && mancante }
}
