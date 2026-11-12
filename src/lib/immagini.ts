// Foto ridotte nel browser prima del caricamento (formato ricetta v1: lato lungo 1600 px).
export const LATO_MASSIMO = 1600

export async function riduciFoto(file: Blob, lato = LATO_MASSIMO, qualita = 0.85): Promise<Blob> {
  let immagine: ImageBitmap
  try {
    immagine = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Immagine non leggibile: usa JPEG, PNG o WebP')
  }
  const scala = Math.min(1, lato / Math.max(immagine.width, immagine.height))
  const w = Math.max(1, Math.round(immagine.width * scala))
  const h = Math.max(1, Math.round(immagine.height * scala))
  const tela = document.createElement('canvas')
  tela.width = w
  tela.height = h
  const ctx = tela.getContext('2d')
  if (!ctx) throw new Error('Impossibile elaborare l\'immagine')
  ctx.drawImage(immagine, 0, 0, w, h)
  immagine.close()
  const risultato = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', qualita))
  if (!risultato) throw new Error('Impossibile elaborare l\'immagine')
  return risultato
}

/** Tipo dell'immagine dal nome del file nel pacchetto. */
export function tipoDaNome(nome: string): string {
  const e = nome.toLowerCase().split('.').pop()
  return e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : 'image/jpeg'
}
