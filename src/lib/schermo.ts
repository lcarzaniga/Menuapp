// Screen Wake Lock condiviso dalla vista cucina e dalla regia della cucina (SPEC §38).
import { useEffect, useState } from 'react'

/** Tiene lo schermo acceso finché la vista è aperta (Screen Wake Lock, dove supportato). */
export function useSchermoAcceso(): boolean {
  const [attivo, setAttivo] = useState(false)
  useEffect(() => {
    let blocco: WakeLockSentinel | null = null
    let chiuso = false
    const richiedi = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
      try {
        blocco = await navigator.wakeLock.request('screen')
        if (chiuso) await blocco.release()
        else {
          setAttivo(true)
          blocco.addEventListener('release', () => setAttivo(false))
        }
      } catch {
        setAttivo(false)
      }
    }
    void richiedi()
    const visibile = () => void richiedi()
    document.addEventListener('visibilitychange', visibile)
    return () => {
      chiuso = true
      document.removeEventListener('visibilitychange', visibile)
      void blocco?.release()
    }
  }, [])
  return attivo
}
