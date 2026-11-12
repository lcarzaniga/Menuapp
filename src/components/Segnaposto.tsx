import { Pagina } from './Pagina'

export function Segnaposto({ titolo, indietro }: { titolo: string; indietro?: string }) {
  return (
    <Pagina titolo={titolo} indietro={indietro}>
      <p className="text-testo-tenue">Schermata in preparazione.</p>
    </Pagina>
  )
}
