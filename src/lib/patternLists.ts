import type { PatternSummary } from '../api/types'

/**
 * « Mes patterns » : les miens, plus les patterns publics des autres que j'ai commencés
 * (aucun endpoint ne les renvoie ensemble). Dédoublonné par id, trié par titre.
 */
export function mergeMyPatterns(mine: PatternSummary[], publics: PatternSummary[]): PatternSummary[] {
  const byId = new Map(mine.map((pattern) => [pattern.id, pattern]))
  for (const pattern of publics) {
    if (!pattern.mine && pattern.progress !== null && !byId.has(pattern.id)) byId.set(pattern.id, pattern)
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
}
