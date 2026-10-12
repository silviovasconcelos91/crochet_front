/** N'accepte que des chemins internes : refuse "//host", "/\host" et les URL absolues. */
export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
