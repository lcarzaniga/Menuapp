// Ascolto HTTP dalla rete di casa: host locali (niente DNS rebinding) e nessun dato senza HTTPS.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hostLocale } from '../app.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva({ lan: true })
})
afterEach(() => t.chiudi())

describe('ascolto in rete locale', () => {
  it('riconosce gli host locali', () => {
    for (const h of ['192.168.1.160:9880', '10.0.0.5', '172.20.1.1:80', 'localhost:9880', 'loris-srv01.local:9880', 'loris-srv01:9880', 'loris-srv01.dala-tortoise.ts.net:9880', '100.114.50.37:9880']) expect(hostLocale(h), h).toBe(true)
    for (const h of ['evil.example', 'evil.example:9880', '8.8.8.8', '172.40.0.1', '100.200.1.1', 'ts.net.evil.example', undefined]) expect(hostLocale(h), String(h)).toBe(false)
  })

  it('in HTTP non dà accesso ai dati: le API rispondono 403 e le pagine rimandano all\'indirizzo HTTPS', async () => {
    // Senza HTTPS il cookie di sessione (Secure) non esiste: nessun dato passa da questo ingresso.
    const api = await t.inietta({ method: 'GET', url: '/api/v1/impostazioni', headers: { host: '192.168.1.160:9880' } })
    expect(api.statusCode).toBe(403)
    expect(JSON.parse(api.body).errore.messaggio).toMatch(/HTTPS/)
    const salute = await t.inietta({ method: 'GET', url: '/api/v1/salute', headers: { host: '192.168.1.160:9880' } })
    expect(salute.statusCode).toBe(403)
  })

  it('con un indirizzo HTTPS configurato le pagine vi rimandano', async () => {
    const conUrl = await appDiProva({ lan: true, config: { MENUAPP_URL_PUBBLICO: 'https://casa.esempio.ts.net' } })
    try {
      const r = await conUrl.inietta({ method: 'GET', url: '/', headers: { host: '192.168.1.160:9880' } })
      expect(r.statusCode).toBe(302)
      expect(r.headers.location).toBe('https://casa.esempio.ts.net')
    } finally {
      conUrl.chiudi()
    }
  })

  it('rifiuta host esterni (DNS rebinding) anche in lettura e per le pagine', async () => {
    expect((await t.inietta({ method: 'GET', url: '/api/v1/impostazioni', headers: { host: 'evil.example:9880' } })).statusCode).toBe(403)
    expect((await t.inietta({ method: 'GET', url: '/', headers: { host: 'evil.example' } })).statusCode).toBe(403)
  })

})
