// Avviso di nuova versione: mai ricaricamento automatico (SPEC §13).
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ORA = 60 * 60 * 1000

export function Aggiornamento() {
  const {
    needRefresh: [daAggiornare],
    offlineReady: [pronta, setPronta],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registrazione) {
      if (!registrazione) return
      const controlla = () => {
        if (navigator.onLine) void registrazione.update().catch(() => undefined)
      }
      setInterval(controlla, ORA)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && controlla())
    },
  })

  useEffect(() => {
    if (!pronta) return
    toast.success('App installata: si apre anche quando il server non risponde', { duration: 4000 })
    setPronta(false)
  }, [pronta, setPronta])

  useEffect(() => {
    if (!daAggiornare) return
    toast('Nuova versione disponibile', {
      id: 'aggiornamento',
      duration: Infinity,
      description: 'Aggiorna quando hai finito quello che stai facendo.',
      action: {
        label: 'Aggiorna',
        onClick: () => {
          const moduli = document.querySelectorAll('[data-modifiche-non-salvate="true"]').length
          if (moduli > 0 && !window.confirm('Ci sono modifiche non salvate. Aggiornare comunque?')) return
          void updateServiceWorker(true)
        },
      },
    })
  }, [daAggiornare, updateServiceWorker])

  return null
}
