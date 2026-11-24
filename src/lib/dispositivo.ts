// Larghezza, metodo di puntamento e tastiera virtuale, per il ricettario contestuale del menù:
// la colonna laterale dipende dallo spazio, il trascinamento dal puntatore (un tablet largo è
// comunque a tocco) e il pannello dal basso deve restare sopra la tastiera.
import { useEffect, useState, useSyncExternalStore } from 'react'

/** Una media query, aggiornata quando cambia (rotazione, finestra ridimensionata, mouse collegato). */
export function useCorrisponde(query: string): boolean {
  return useSyncExternalStore(
    (avvisa) => {
      const m = window.matchMedia?.(query)
      m?.addEventListener('change', avvisa)
      return () => m?.removeEventListener('change', avvisa)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

/** Parte visibile della finestra: `coperto` è l'altezza nascosta in basso (la tastiera virtuale). */
export interface AreaVisibile {
  alto: number
  altezza: number
  coperto: number
}

function leggiArea(): AreaVisibile {
  const v = window.visualViewport
  if (!v) return { alto: 0, altezza: window.innerHeight, coperto: 0 }
  return { alto: v.offsetTop, altezza: v.height, coperto: Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) }
}

/** L'area visibile, seguita mentre la tastiera si apre e si chiude (solo quando serve). */
export function useAreaVisibile(attiva: boolean): AreaVisibile {
  const [area, setArea] = useState(leggiArea)
  useEffect(() => {
    if (!attiva) return
    const aggiorna = () =>
      setArea((a) => {
        const n = leggiArea()
        return n.alto === a.alto && n.altezza === a.altezza && n.coperto === a.coperto ? a : n
      })
    aggiorna()
    const v = window.visualViewport
    v?.addEventListener('resize', aggiorna)
    v?.addEventListener('scroll', aggiorna)
    window.addEventListener('resize', aggiorna)
    return () => {
      v?.removeEventListener('resize', aggiorna)
      v?.removeEventListener('scroll', aggiorna)
      window.removeEventListener('resize', aggiorna)
    }
  }, [attiva])
  return area
}

/** Altezza del pannello dal basso: poco meno di metà dello spazio visibile, fra 180 e 360 px. */
export const altezzaPannelloBasso = (area: AreaVisibile) => Math.round(Math.min(360, Math.max(180, area.altezza * 0.45)))

/**
 * Di quanto scorrere la pagina perché un campo resti visibile sopra il pannello dal basso
 * (positivo: in giù). Zero se è già visibile fra il bordo alto e il pannello.
 */
export function scorrimentoPerCampo(campo: { top: number; bottom: number }, area: AreaVisibile, pannello: number, margine = 12): number {
  const limite = area.alto + area.altezza - pannello - margine
  if (campo.bottom > limite) return Math.ceil(campo.bottom - limite)
  if (campo.top < area.alto + margine) return Math.floor(campo.top - area.alto - margine)
  return 0
}
