import { createHashRouter } from 'react-router'
import { Segnaposto } from '@/components/Segnaposto'
import { PaginaDati } from '@/features/impostazioni/PaginaDati'
import { NonTrovata, PaginaErrore } from './Errore'
import { Layout } from './Layout'

// Rotte di SPEC §5 (hash routing).
export const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <PaginaErrore />,
    children: [
      { path: '/', element: <Segnaposto titolo="Eventi" /> },
      { path: '/eventi/archivio', element: <Segnaposto titolo="Archivio" indietro="/" /> },
      { path: '/eventi/nuovo', element: <Segnaposto titolo="Nuovo evento" indietro="/" /> },
      { path: '/eventi/:id', element: <Segnaposto titolo="Evento" indietro="/" /> },
      { path: '/eventi/:id/menu', element: <Segnaposto titolo="Menù" indietro="/" /> },
      { path: '/eventi/:id/spesa', element: <Segnaposto titolo="Spesa" indietro="/" /> },
      { path: '/eventi/:id/piano', element: <Segnaposto titolo="Piano" indietro="/" /> },
      { path: '/eventi/:id/stampa', element: <Segnaposto titolo="Stampa menù" indietro="/" /> },
      { path: '/eventi/:id/voci/:voceId/cucina', element: <Segnaposto titolo="Vista cucina" indietro="/" /> },
      { path: '/ricettario', element: <Segnaposto titolo="Ricettario" /> },
      { path: '/ricettario/nuovo', element: <Segnaposto titolo="Nuovo piatto" indietro="/ricettario" /> },
      { path: '/ricettario/:id', element: <Segnaposto titolo="Piatto" indietro="/ricettario" /> },
      { path: '/ricettario/:id/cucina', element: <Segnaposto titolo="Vista cucina" indietro="/ricettario" /> },
      { path: '/ingredienti', element: <Segnaposto titolo="Ingredienti" /> },
      { path: '/impostazioni', element: <Segnaposto titolo="Impostazioni" /> },
      { path: '/impostazioni/dati', element: <PaginaDati /> },
      { path: '*', element: <NonTrovata /> },
    ],
  },
])
