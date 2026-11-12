// Accesso dalla rete di casa senza Tailscale: host locali, origine propria, niente DNS rebinding.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hostLocale } from '../app.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva({ lan: true })
})
afterEach(() => t.chiudi())

const imp = async (host: string) => JSON.parse((await t.inietta({ method: 'GET', url: '/api/v1/impostazioni', headers: { host } })).body)

describe('ascolto in rete locale', () => {
  it('riconosce gli host locali', () => {
    for (const h of ['192.168.1.160:9880', '10.0.0.5', '172.20.1.1:80', 'localhost:9880', 'loris-srv01.local:9880', 'loris-srv01:9880', 'loris-srv01.dala-tortoise.ts.net:9880', '100.114.50.37:9880']) expect(hostLocale(h), h).toBe(true)
    for (const h of ['evil.example', 'evil.example:9880', '8.8.8.8', '172.40.0.1', '100.200.1.1', 'ts.net.evil.example', undefined]) expect(hostLocale(h), String(h)).toBe(false)
  })

  it('lettura e scrittura dall\'indirizzo locale con la propria origine', async () => {
    const host = '192.168.1.160:9880'
    const corrente = await imp(host)
    const r = await t.inietta({
      method: 'PUT',
      url: '/api/v1/impostazioni',
      headers: { host, origin: `http://${host}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ coefficienteBambini: 0.6, portatePredefinite: corrente.portatePredefinite, versione: corrente.versione }),
    })
    expect(r.statusCode, r.body).toBe(200)
  })

  it('rifiuta host esterni (DNS rebinding) anche in lettura e per le pagine', async () => {
    expect((await t.inietta({ method: 'GET', url: '/api/v1/impostazioni', headers: { host: 'evil.example:9880' } })).statusCode).toBe(403)
    expect((await t.inietta({ method: 'GET', url: '/', headers: { host: 'evil.example' } })).statusCode).toBe(403)
  })

  it('rifiuta scritture con origine diversa dall\'indirizzo usato', async () => {
    const r = await t.inietta({
      method: 'PUT',
      url: '/api/v1/impostazioni',
      headers: { host: '192.168.1.160:9880', origin: 'http://192.168.1.99:3000', 'content-type': 'application/json' },
      payload: '{}',
    })
    expect(r.statusCode).toBe(403)
  })
})
