const BASE = 'http://app.invalid'

/**
 * N'accepte que des chemins internes : refuse "//host", "/\host", les URL absolues et
 * tout ce que le parseur d'URL transformerait en autre hôte (tabulations, retours ligne…).
 */
export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (/[\s\\]/.test(value)) return '/'
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
