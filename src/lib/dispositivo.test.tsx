import { describe, expect, it } from 'vitest'
import { altezzaPannelloBasso, scorrimentoPerCampo } from './dispositivo'

describe('pannello dal basso e tastiera virtuale', () => {
  it('altezza: poco meno di metà dello spazio visibile, fra 180 e 360 px', () => {
    expect(altezzaPannelloBasso({ alto: 0, altezza: 800, coperto: 0 })).toBe(360)
    expect(altezzaPannelloBasso({ alto: 0, altezza: 500, coperto: 300 })).toBe(225)
    expect(altezzaPannelloBasso({ alto: 0, altezza: 300, coperto: 500 })).toBe(180)
  })
  it('il campo coperto dal pannello fa scorrere la pagina in giù quanto basta', () => {
    // Tastiera aperta: visibili 500 px, pannello alto 225, quindi il campo deve finire entro 263.
    expect(scorrimentoPerCampo({ top: 400, bottom: 444 }, { alto: 0, altezza: 500, coperto: 300 }, 225)).toBe(181)
  })
  it('un campo già visibile non fa scorrere; uno sopra il bordo fa scorrere in su', () => {
    expect(scorrimentoPerCampo({ top: 100, bottom: 144 }, { alto: 0, altezza: 500, coperto: 300 }, 225)).toBe(0)
    expect(scorrimentoPerCampo({ top: 50, bottom: 94 }, { alto: 80, altezza: 500, coperto: 0 }, 225)).toBe(-42)
  })
})
