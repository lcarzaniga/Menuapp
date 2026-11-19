import { lazy, Suspense, type ComponentType } from 'react'
import { createHashRouter } from 'react-router'
import { Caricamento } from '@/components/Pagina'
import { ConPermessoEvento, LayoutEvento } from '@/features/eventi/LayoutEvento'
import { PaginaArchivio, PaginaEventi } from '@/features/eventi/PaginaEventi'
import { PaginaPanoramica } from '@/features/eventi/PaginaPanoramica'
import { PaginaMenu } from '@/features/menu/PaginaMenu'
import { PaginaAccesso, PaginaAttivazione } from '@/features/accesso/Attivazione'
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
  // Senza sessione: attivazione del dispositivo dal link d'invito.
  { path: '/attiva/:token', element: <PaginaAttivazione />, errorElement: <PaginaErrore /> },
  { path: '/accesso', element: <PaginaAccesso />, errorElement: <PaginaErrore /> },
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
          { path: 'partecipanti', element: pigra(() => import('@/features/partecipanti/PaginaPartecipanti'), (m) => m.PaginaPartecipanti) },
          { path: 'confronto', element: pigra(() => import('@/features/eventi/PaginaConfronto'), (m) => m.PaginaConfronto) },
          { path: 'menu', element: <PaginaMenu /> },
          { path: 'spesa', element: pigra(() => import('@/features/spesa/PaginaSpesa'), (m) => m.PaginaSpesa) },
          { path: 'piano', element: pigra(() => import('@/features/piano/PaginaPiano'), (m) => m.PaginaPiano) },
          { path: 'bacheca', element: pigra(() => import('@/features/famiglia/PaginaBachecaEvento'), (m) => m.PaginaBachecaEvento) },
          { path: 'chi-porta', element: pigra(() => import('@/features/famiglia/PaginaChiPorta'), (m) => m.PaginaChiPorta) },
        ],
      },
      { path: '/eventi/:id/regia', element: <ConPermessoEvento>{pigra(() => import('@/features/cucina/PaginaRegia'), (m) => m.PaginaRegia)}</ConPermessoEvento> },
      { path: '/eventi/:id/stampa', element: <ConPermessoEvento>{pigra(() => import('@/features/stampa/PaginaStampa'), (m) => m.PaginaStampa)}</ConPermessoEvento> },
      {
        path: '/eventi/:id/voci/:voceId/cucina',
        element: <ConPermessoEvento>{pigra(() => import('@/features/cucina/VistaCucina'), (m) => m.PaginaCucinaVoce)}</ConPermessoEvento>,
      },
      { path: '/ricettario', element: pigra(() => import('@/features/ricettario/PaginaRicettario'), (m) => m.PaginaRicettario) },
      { path: '/ricettario/nuovo', element: pigra(() => import('@/features/ricettario/PaginaPiatto'), (m) => m.PaginaNuovoPiatto) },
      { path: '/ricettario/:id', element: pigra(() => import('@/features/ricettario/PaginaPiatto'), (m) => m.PaginaPiatto) },
      { path: '/ricettario/:id/cucina', element: pigra(() => import('@/features/cucina/VistaCucina'), (m) => m.PaginaCucinaPiatto) },
      { path: '/ingredienti', element: pigra(() => import('@/features/ingredienti/PaginaIngredienti'), (m) => m.PaginaIngredienti) },
      { path: '/impostazioni', element: pigra(() => import('@/features/impostazioni/PaginaImpostazioni'), (m) => m.PaginaImpostazioni) },
      { path: '/impostazioni/eventi', element: pigra(() => import('@/features/impostazioni/PaginaImpostazioni'), (m) => m.PaginaImpostazioniEventi) },
      { path: '/impostazioni/reparti', element: pigra(() => import('@/features/impostazioni/PaginaImpostazioni'), (m) => m.PaginaReparti) },
      { path: '/impostazioni/dati', element: pigra(() => import('@/features/impostazioni/PaginaDati'), (m) => m.PaginaDati) },
      { path: '/impostazioni/utenti', element: pigra(() => import('@/features/accesso/PaginaUtenti'), (m) => m.PaginaUtenti) },
      { path: '/famiglia', element: pigra(() => import('@/features/famiglia/PaginaFamiglia'), (m) => m.PaginaFamiglia) },
      { path: '/unisciti/:token', element: pigra(() => import('@/features/famiglia/PaginaFamiglia'), (m) => m.PaginaUnisciti) },
      { path: '/notifiche', element: pigra(() => import('@/features/famiglia/PaginaNotifiche'), (m) => m.PaginaNotifiche) },
      { path: '/account', element: pigra(() => import('@/features/accesso/PaginaAccount'), (m) => m.PaginaAccount) },
      { path: '*', element: <NonTrovata /> },
    ],
  },
])
