import type { PatternFormValues } from './formModel'

/**
 * Brouillon gardé le temps de la session de l'onglet quand un enregistrement échoue
 * sur une session expirée (401), pour le proposer au retour sur le formulaire.
 */
const draftKey = (patternId?: number) => `crochet.draft:${patternId ?? 'new'}`

export function readDraft(patternId?: number): Partial<PatternFormValues> | null {
  try {
    const raw = sessionStorage.getItem(draftKey(patternId))
    return raw ? (JSON.parse(raw) as Partial<PatternFormValues>) : null
  } catch {
    return null
  }
}

export function saveDraft(patternId: number | undefined, values: PatternFormValues): void {
  try {
    sessionStorage.setItem(draftKey(patternId), JSON.stringify(values))
  } catch {
    // stockage indisponible : la saisie est perdue, comme sans brouillon
  }
}

export function clearDraft(patternId?: number): void {
  try {
    sessionStorage.removeItem(draftKey(patternId))
  } catch {
    // rien à nettoyer
  }
}
