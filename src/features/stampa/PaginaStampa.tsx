// Stampa del menù: anteprima elegante, A4 o A5 (SPEC F8).
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMenu } from '@/api/query'
import { Caricamento } from '@/components/Pagina'
import { Button } from '@/components/ui/button'
import { Casella, Input, Select } from '@/components/ui/campi'
import { dataLunga } from '@/domain/tempo.ts'
import { cn } from '@/lib/utils'

export function PaginaStampa() {
  const { id = '' } = useParams()
  const q = useMenu(id)
  const [formato, setFormato] = useState<'A4' | 'A5'>('A4')
  const [vuote, setVuote] = useState(false)
  const [nota, setNota] = useState('')
  useEffect(() => {
    if (q.data) document.title = `Menù · ${q.data.evento.nome}`
  }, [q.data])
  useEffect(() => {
    const stile = document.createElement('style')
    stile.textContent = `@page { size: ${formato}; margin: ${formato === 'A4' ? '22mm 20mm' : '14mm 12mm'}; }`
    document.head.appendChild(stile)
    return () => stile.remove()
  }, [formato])
  if (q.isPending) return <Caricamento />
  if (!q.data) return <p className="p-6">Menù non disponibile.</p>
  const { evento, portate } = q.data
  const visibili = portate.filter((p) => vuote || p.voci.length > 0)
  return (
    <div className="min-h-dvh bg-tenue pb-28 md:pb-10 print:bg-white print:p-0">
      <div className="non-stampare mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <Button asChild variante="fantasma" misura="iconaPiccola" aria-label="Indietro">
          <Link to={`/eventi/${evento.id}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <Select aria-label="Formato" className="h-9 w-24" value={formato} onChange={(e) => setFormato(e.target.value as 'A4' | 'A5')}>
          <option value="A4">A4</option>
          <option value="A5">A5</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Casella checked={vuote} onChange={(e) => setVuote(e.target.checked)} /> Portate vuote
        </label>
        <Input aria-label="Nota finale" className="h-9 min-w-40 flex-1" placeholder="Nota finale (facoltativa)" value={nota} onChange={(e) => setNota(e.target.value)} />
        <Button misura="piccolo" onClick={() => window.print()}>
          <Printer /> Stampa
        </Button>
      </div>
      <article
        aria-label="Anteprima del menù"
        className={cn(
          'mx-auto bg-white px-8 py-12 text-center font-serif text-[#2a211c] shadow-sm print:shadow-none',
          formato === 'A4' ? 'max-w-[210mm] sm:min-h-[297mm] sm:px-16' : 'max-w-[148mm] sm:min-h-[210mm] sm:px-10',
          'print:min-h-0 print:max-w-none print:px-0 print:py-0',
        )}
      >
        <p className="text-xs uppercase tracking-[0.35em] text-[#8a6a58]">Menù</p>
        <h1 className={cn('mt-3 font-semibold leading-tight', formato === 'A4' ? 'text-4xl' : 'text-3xl')}>{evento.nome}</h1>
        <p className="mt-2 text-sm italic text-[#6f625a] first-letter:uppercase">{dataLunga(evento.data)}</p>
        <div className="mx-auto my-8 h-px w-24 bg-[#b5482c]/60" />
        <div className={cn('flex flex-col', formato === 'A4' ? 'gap-8' : 'gap-6')}>
          {visibili.map((p) => (
            <section key={p.id} className="break-inside-avoid">
              <h2 className="text-[13px] uppercase tracking-[0.28em] text-[#b5482c]">{p.nome}</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {p.voci.map((v) => (
                  <li key={v.id} className={cn(formato === 'A4' ? 'text-xl' : 'text-lg')}>
                    {v.nome}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {nota ? (
          <>
            <div className="mx-auto my-8 h-px w-24 bg-[#b5482c]/60" />
            <p className="whitespace-pre-line text-sm italic text-[#6f625a]">{nota}</p>
          </>
        ) : null}
      </article>
    </div>
  )
}
