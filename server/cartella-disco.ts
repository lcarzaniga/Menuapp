// Cartella dei file su disco (server Debian): dati/foto.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CartellaFile } from './servizi/cartella.ts'

export class CartellaDisco implements CartellaFile {
  readonly percorso: string
  constructor(percorso: string) {
    this.percorso = percorso
  }

  async scrivi(nome: string, dati: Uint8Array): Promise<void> {
    await mkdir(this.percorso, { recursive: true })
    const finale = join(this.percorso, nome)
    await writeFile(`${finale}.tmp-${process.pid}`, dati)
    await rename(`${finale}.tmp-${process.pid}`, finale)
  }

  async leggi(nome: string): Promise<Uint8Array | null> {
    try {
      return await readFile(join(this.percorso, nome))
    } catch {
      return null
    }
  }

  async elimina(nome: string): Promise<void> {
    await rm(join(this.percorso, nome), { force: true })
  }

  copia(da: string, a: string): boolean {
    const sorgente = join(this.percorso, da)
    if (!existsSync(sorgente)) return false
    mkdirSync(this.percorso, { recursive: true })
    copyFileSync(sorgente, join(this.percorso, a))
    return true
  }
}
