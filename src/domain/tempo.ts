// Date di calendario locali 'YYYY-MM-DD' e ore 'HH:mm', senza fusi orari (SPEC §6.1).

export type DataISO = string
export type Ora = string

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const RE_ORA = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isDataISO(s: string): boolean {
  const m = RE_DATA.exec(s)
  if (!m) return false
  const [a, me, g] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(a, me - 1, g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === me - 1 && d.getUTCDate() === g
}

export function isOra(s: string): boolean {
  return RE_ORA.test(s)
}

export function dataLocale(d: Date): DataISO {
  const a = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${a}-${m}-${g}`
}

export function oggiISO(): DataISO {
  return dataLocale(new Date())
}

/** Aggiunge giorni a una data di calendario (anche negativi). */
export function aggiungiGiorni(data: DataISO, giorni: number): DataISO {
  const m = RE_DATA.exec(data)
  if (!m) throw new Error(`Data non valida: ${data}`)
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + giorni))
  return d.toISOString().slice(0, 10)
}

/** Differenza in giorni b − a. */
export function differenzaGiorni(a: DataISO, b: DataISO): number {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  return Math.round((tb - ta) / 86_400_000)
}

/** Sottrae minuti a un'ora; restituisce data e ora risultanti. */
export function sottraiMinuti(data: DataISO, ora: Ora, minuti: number): { data: DataISO; ora: Ora } {
  const [h, mi] = ora.split(':').map(Number) as [number, number]
  let totale = h * 60 + mi - minuti
  let giorni = 0
  while (totale < 0) {
    totale += 1440
    giorni -= 1
  }
  const hh = String(Math.floor(totale / 60)).padStart(2, '0')
  const mm = String(totale % 60).padStart(2, '0')
  return { data: aggiungiGiorni(data, giorni), ora: `${hh}:${mm}` }
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

/** «giovedì 25 dicembre 2026» */
export function dataLunga(data: DataISO): string {
  const m = RE_DATA.exec(data)
  if (!m) return data
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** «25/12» */
export function dataBreve(data: DataISO): string {
  const m = RE_DATA.exec(data)
  return m ? `${m[3]}/${m[2]}` : data
}
