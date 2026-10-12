export const utf8Length = (value: string): number => new TextEncoder().encode(value).length

export const requiredText = (value: string): true | string => value.trim() !== '' || 'Obligatoire'

export const maxChars = (n: number) => ({ value: n, message: `${n} caractères max` })

export const emailRules = {
  validate: (value: string): true | string => {
    const email = value.trim()
    if (email === '') return 'Obligatoire'
    if (email.length > 254) return '254 caractères max'
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 'Email invalide'
  },
}

export const newPasswordRules = {
  required: 'Obligatoire',
  minLength: { value: 8, message: 'Au moins 8 caractères' },
  validate: (value: string): true | string =>
    utf8Length(value) <= 72 || 'Trop long : 72 octets max (les accents comptent double)',
}

export const confirmRule = (getOther: () => string) => ({
  validate: (value: string): true | string => value === getOther() || 'Les mots de passe ne correspondent pas',
})
