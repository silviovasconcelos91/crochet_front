/** Seuls http(s) sont rendus en lien ou en image : bloque javascript:, data:, etc. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
