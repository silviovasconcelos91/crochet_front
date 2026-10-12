/** Propose le libellé du rang suivant : "2" → "3", "3-5" → "6", texte sans nombre final → "". */
export function nextRowNumber(previous: string): string {
  const match = /(\d+)$/.exec(previous.trim())
  return match ? String(Number(match[1]) + 1) : ''
}
