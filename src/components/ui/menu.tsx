import { DropdownMenu as DM } from 'radix-ui'
import { MoreVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface VoceMenuAzioni {
  etichetta: string
  icona?: ReactNode
  onSelect: () => void
  pericolosa?: boolean
  disabilitata?: boolean
  nascosta?: boolean
}

/** Menu «⋮» con azioni secondarie. */
export function MenuAzioni({ voci, etichetta = 'Altre azioni', trigger }: { voci: VoceMenuAzioni[]; etichetta?: string; trigger?: ReactNode }) {
  const visibili = voci.filter((v) => !v.nascosta)
  if (visibili.length === 0) return null
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        {trigger ?? (
          <Button variante="fantasma" misura="iconaPiccola" aria-label={etichetta}>
            <MoreVertical />
          </Button>
        )}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-2xl border border-bordo bg-carta p-1.5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          {visibili.map((v) => (
            <DM.Item
              key={v.etichetta}
              disabled={v.disabilitata}
              onSelect={v.onSelect}
              className={cn(
                'flex min-h-11 cursor-default items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-[highlighted]:bg-tenue data-[disabled]:opacity-45 [&_svg]:size-4',
                v.pericolosa && 'text-pericolo',
              )}
            >
              {v.icona}
              {v.etichetta}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
