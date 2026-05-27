function gaussianEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nextMonday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  if (dow === 1) return d
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getColombianHolidays(year: number): Set<string> {
  const h = new Set<string>()
  const add = (d: Date) => h.add(toKey(d))
  const em  = (d: Date) => add(nextMonday(d))

  // Festivos de fecha fija
  add(new Date(year, 0,  1))   // Año Nuevo
  add(new Date(year, 4,  1))   // Día del Trabajo
  add(new Date(year, 6,  20))  // Independencia de Colombia
  add(new Date(year, 7,  7))   // Batalla de Boyacá
  add(new Date(year, 11, 8))   // Inmaculada Concepción
  add(new Date(year, 11, 25))  // Navidad

  // Ley Emiliani (se trasladan al lunes siguiente)
  em(new Date(year, 0,  6))    // Reyes Magos
  em(new Date(year, 2,  19))   // San José
  em(new Date(year, 5,  29))   // San Pedro y San Pablo
  em(new Date(year, 7,  15))   // Asunción de la Virgen
  em(new Date(year, 9,  12))   // Día de la Raza
  em(new Date(year, 10, 1))    // Todos los Santos
  em(new Date(year, 10, 11))   // Independencia de Cartagena

  // Festivos basados en Semana Santa (algoritmo gaussiano)
  const easter = gaussianEaster(year)
  add(addDays(easter, -3))     // Jueves Santo
  add(addDays(easter, -2))     // Viernes Santo
  em(addDays(easter,  39))     // Ascensión del Señor
  em(addDays(easter,  60))     // Corpus Christi
  em(addDays(easter,  68))     // Sagrado Corazón de Jesús

  return h
}
