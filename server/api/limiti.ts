// Limite di tentativi in memoria, a finestra fissa per chiave (indirizzo, «tutti»).

export class Limitatore {
  private readonly conteggi = new Map<string, { da: number; n: number }>()

  private readonly massimo: number
  private readonly finestraMs: number

  constructor(massimo: number, finestraMs: number) {
    this.massimo = massimo
    this.finestraMs = finestraMs
  }

  /** Registra un tentativo: false se la chiave ha superato il massimo nella finestra. */
  prova(chiave: string, adesso = Date.now()): boolean {
    if (this.conteggi.size > 10_000) this.pulisci(adesso)
    const c = this.conteggi.get(chiave)
    if (!c || adesso - c.da >= this.finestraMs) {
      this.conteggi.set(chiave, { da: adesso, n: 1 })
      return true
    }
    c.n++
    return c.n <= this.massimo
  }

  /** Chiave oltre il massimo nella finestra, senza registrare un tentativo. */
  bloccato(chiave: string, adesso = Date.now()): boolean {
    const c = this.conteggi.get(chiave)
    return c !== undefined && adesso - c.da < this.finestraMs && c.n >= this.massimo
  }

  private pulisci(adesso: number): void {
    for (const [k, c] of this.conteggi) if (adesso - c.da >= this.finestraMs) this.conteggi.delete(k)
  }
}
