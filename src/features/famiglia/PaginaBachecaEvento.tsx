// Bacheca dell'evento: messaggi, sondaggi e proposte di piatti dei partecipanti.
import { Bacheca } from './Bacheca'
import { CorpoScheda, useEventoCorrente } from '@/features/eventi/LayoutEvento'

export function PaginaBachecaEvento() {
  const e = useEventoCorrente()
  return (
    <CorpoScheda>
      <Bacheca ambito={{ tipo: 'evento', id: e.id }} portate={e.portate.map((p) => ({ id: p.id, nome: p.nome }))} segnaposto="«Si comincia alle 13», «Chi porta le bevande?»…" />
    </CorpoScheda>
  )
}
