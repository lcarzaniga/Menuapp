// File di foto e allegati (SPEC §8.10, §32.3): una cartella su disco sul server Debian, un
// bucket R2 privato su Cloudflare. I servizi conoscono solo questa interfaccia.

export interface CartellaFile {
  /** Scrittura completa (mai un file a metà). */
  scrivi(nome: string, dati: Uint8Array): Promise<void>
  /** Contenuto del file, null se manca. */
  leggi(nome: string): Promise<Uint8Array | null>
  /** Nessun errore se il file manca già. */
  elimina(nome: string): Promise<void>
  /**
   * Copia chiamata dentro una transazione (copia di una ricetta con le foto): su disco subito,
   * su R2 alla fine della richiesta. false se l'originale manca, dove lo si può sapere subito.
   */
  copia(da: string, a: string): boolean
}
