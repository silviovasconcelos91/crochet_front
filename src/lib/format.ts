const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' })
const HOOK = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export const formatDate = (iso: string): string => DATE.format(new Date(iso))

export const formatHookSize = (mm: number): string => HOOK.format(mm)
