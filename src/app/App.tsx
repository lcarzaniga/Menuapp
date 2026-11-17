import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { ErroreRichiesta } from '@/api/client'
import { router } from '@/app/router'
import { ConflittoVersione } from '@/components/ConflittoVersione'
import { avviaSorveglianza } from '@/connessione/sorveglianza'
import { Aggiornamento } from '@/pwa/Aggiornamento'

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // I dati vivono sul server: nessuna ripetizione aggressiva quando non risponde.
      retry: (tentativi, e) => !(e instanceof ErroreRichiesta && (e.codice === 'rete' || e.stato === 404)) && tentativi < 2,
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
})

export function App() {
  useEffect(() => avviaSorveglianza(client), [])
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
      <ConflittoVersione />
      <Aggiornamento />
      {/* In basso, sopra la barra di navigazione del telefono: non coprono titoli e schede (SPEC §31.6). */}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        offset={{ bottom: 24 }}
        mobileOffset={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        toastOptions={{ className: 'text-[0.9375rem]' }}
      />
    </QueryClientProvider>
  )
}
