import { lazy, Suspense, type ComponentType } from 'react'
import { createHashRouter } from 'react-router'
import { Caricamento } from '@/components/Pagina'
import { LayoutEvento } from '@/features/eventi/LayoutEvento'
import { PaginaArchivio, PaginaEventi } from '@/features/eventi/PaginaEventi'
import { PaginaPanoramica } from '@/features/eventi/PaginaPanoramica'
import { PaginaMenu } from '@/features/menu/PaginaMenu'
import { NonTrovata, PaginaErrore } from './Errore'
import { Layout } from './Layout'

/** Schermate caricate a richiesta: l'avvio sul telefono resta leggero. */
function pigra<M>(carica: () => Promise<M>, scegli: (m: M) => ComponentType) {
  const C = lazy(async () => ({ default: scegli(await carica()) }))
  return (
    <Suspense fallback={<Caricamento />}>
      <C />
    </Suspense>
  )
}

// Rotte di SPEC §5 (hash routing).
export const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <PaginaErrore />,
    children: [
      { path: '/', element: <PaginaEventi /> },
      { path: '/eventi/archivio', element: <PaginaArchivio /> },
      { path: '/eventi/nuovo', element: pigra(() => import('@/features/eventi/PaginaNuovoEvento'), (m) => m.PaginaNuovoEvento) },
      {
        path: '/eventi/:id',
        element: <LayoutEvento />,
        children: [
          { index: true, element: <PaginaPanoramica /> },
          { path: 'menu', element: <PaginaMenu /> },
          { path: 'spesa', element: pigra(() => import('@/features/spesa/PaginaSpesa'), (m) => m.PaginaSpesa) },
          { path: 'piano', element: pigra(() => import('@/features/piano/PaginaPiano'), (m) => m.PaginaPiano) },
        ],
      },
      { path: '/eventi/:id/stampa', element: pigra(() => import('@/features/stampa/PaginaStampa'), (m) => m.PaginaStampa) },
      { path: '/eventi/:id/voci/:voceId/cucina', element: pigra(() => import('@/features/cucina/VistaCucina'), (m) => m.PaginaCucinaVoce) },
      { path: '/ricettario', element: pigra(() => import('@/features/ricettario/PaginaRicettario'), (m) => m.PaginaRicettario) },
      { path: '/ricettario/nuovo', element: pigra(() => import('@/features/ricettario/PaginaPiatto'), (m) => m.PaginaNuovoPiatto) },
      { path: '/ricettario/:id', element: pigra(() => import('@/features/ricettario/PaginaPiatto'), (m) => m.PaginaPiatto) },
      { path: '/ricettario/:id/cucina', element: pigra(() => import('@/features/cucina/VistaCucina'), (m) => m.PaginaCucinaPiatto) },
      { path: '/ingredienti', element: pigra(() => import('@/features/ingredienti/PaginaIngredienti'), (m) => m.PaginaIngredienti) },
      { path: '/impostazioni', element: pigra(() => import('@/features/impostazioni/PaginaImpostazioni'), (m) => m.PaginaImpostazioni) },
      { path: '/impostazioni/dati', element: pigra(() => import('@/features/impostazioni/PaginaDati'), (m) => m.PaginaDati) },
      { path: '*', element: <NonTrovata /> },
    ],
  },
])
