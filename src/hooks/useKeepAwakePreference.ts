import { useCallback, useState } from 'react'

const KEY = 'crochet.keepAwake'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

export function useKeepAwakePreference(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(read)
  const update = useCallback((next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      // stockage indisponible (navigation privée) : on garde le choix en mémoire
    }
  }, [])
  return [value, update]
}
