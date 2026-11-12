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
      <Toaster position="top-center" richColors closeButton offset={12} toastOptions={{ className: 'text-[15px]' }} />
    </QueryClientProvider>
  )
}
