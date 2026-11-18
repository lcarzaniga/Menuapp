// Foto e allegati in un bucket R2 privato (SPEC §32.3). Le copie chiamate dentro una
// transazione partono alla fine della richiesta; i file eliminati passano dal cestino, che la
// manutenzione notturna svuota dopo 30 giorni (servono ai ripristini dei backup).
import type { CartellaFile } from '../server/servizi/cartella.ts'

export const CESTINO = 'cestino/'

export class CartellaR2 implements CartellaFile {
  private readonly bucket: R2Bucket
  private copie: [string, string][] = []

  constructor(bucket: R2Bucket) {
    this.bucket = bucket
  }

  async scrivi(nome: string, dati: Uint8Array): Promise<void> {
    await this.bucket.put(nome, dati)
  }

  async leggi(nome: string): Promise<Uint8Array | null> {
    const o = await this.bucket.get(nome)
    return o ? new Uint8Array(await o.arrayBuffer()) : null
  }

  async elimina(nome: string): Promise<void> {
    const o = await this.bucket.get(nome)
    if (!o) return
    await this.bucket.put(`${CESTINO}${nome}`, await o.arrayBuffer(), { customMetadata: { eliminatoIl: new Date().toISOString() } })
    await this.bucket.delete(nome)
  }

  copia(da: string, a: string): boolean {
    this.copie.push([da, a])
    return true
  }

  /** Esegue le copie in sospeso (alla fine di ogni richiesta). */
  async completa(): Promise<void> {
    const copie = this.copie
    this.copie = []
    for (const [da, a] of copie) {
      const o = await this.bucket.get(da)
      if (o) await this.bucket.put(a, await o.arrayBuffer())
    }
  }
}
