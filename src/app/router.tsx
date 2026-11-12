import { createHashRouter } from 'react-router'
import { Segnaposto } from '@/components/Segnaposto'
import { PaginaCucinaPiatto, PaginaCucinaVoce } from '@/features/cucina/VistaCucina'
import { LayoutEvento } from '@/features/eventi/LayoutEvento'
import { PaginaArchivio, PaginaEventi } from '@/features/eventi/PaginaEventi'
import { PaginaNuovoEvento } from '@/features/eventi/PaginaNuovoEvento'
import { PaginaPanoramica } from '@/features/eventi/PaginaPanoramica'
import { PaginaDati } from '@/features/impostazioni/PaginaDati'
import { PaginaImpostazioni } from '@/features/impostazioni/PaginaImpostazioni'
import { PaginaIngredienti } from '@/features/ingredienti/PaginaIngredienti'
import { PaginaMenu } from '@/features/menu/PaginaMenu'
import { PaginaNuovoPiatto, PaginaPiatto } from '@/features/ricettario/PaginaPiatto'
import { PaginaRicettario } from '@/features/ricettario/PaginaRicettario'
import { NonTrovata, PaginaErrore } from './Errore'
import { Layout } from './Layout'

// Rotte di SPEC §5 (hash routing).
export const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <PaginaErrore />,
    children: [
      { path: '/', element: <PaginaEventi /> },
      { path: '/eventi/archivio', element: <PaginaArchivio /> },
      { path: '/eventi/nuovo', element: <PaginaNuovoEvento /> },
      {
        path: '/eventi/:id',
        element: <LayoutEvento />,
        children: [
          { index: true, element: <PaginaPanoramica /> },
          { path: 'menu', element: <PaginaMenu /> },
          { path: 'spesa', element: <Segnaposto titolo="Spesa" /> },
          { path: 'piano', element: <Segnaposto titolo="Piano" /> },
        ],
      },
      { path: '/eventi/:id/stampa', element: <Segnaposto titolo="Stampa menù" indietro="/" /> },
      { path: '/eventi/:id/voci/:voceId/cucina', element: <PaginaCucinaVoce /> },
      { path: '/ricettario', element: <PaginaRicettario /> },
      { path: '/ricettario/nuovo', element: <PaginaNuovoPiatto /> },
      { path: '/ricettario/:id', element: <PaginaPiatto /> },
      { path: '/ricettario/:id/cucina', element: <PaginaCucinaPiatto /> },
      { path: '/ingredienti', element: <PaginaIngredienti /> },
      { path: '/impostazioni', element: <PaginaImpostazioni /> },
      { path: '/impostazioni/dati', element: <PaginaDati /> },
      { path: '*', element: <NonTrovata /> },
    ],
  },
])
