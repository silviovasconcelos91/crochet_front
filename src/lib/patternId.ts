export function parsePatternId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id > 0 && Number.isSafeInteger(id) ? id : null
}
