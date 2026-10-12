import { useState } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Button } from '../../components/Button'
import { IconButton } from '../../components/IconButton'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { nextRowNumber } from '../../lib/rowNumber'
import { maxChars, requiredText } from '../../lib/validation'
import { emptyRow, type PatternFormValues } from './formModel'

interface StepFieldsProps {
  index: number
  count: number
  form: UseFormReturn<PatternFormValues>
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function StepFields({ index, count, form, onMoveUp, onMoveDown, onRemove }: StepFieldsProps) {
  const { register, control, getValues, formState: { errors } } = form
  const rows = useFieldArray({ control, name: `steps.${index}.rows` })
  const stepErrors = errors.steps?.[index]
  const [open, setOpen] = useState(true)
  const isOpen = open || stepErrors !== undefined
  const n = index + 1

  const addRow = () => {
    const last = getValues(`steps.${index}.rows.${rows.fields.length - 1}.number`) ?? ''
    rows.append(emptyRow(nextRowNumber(last)), { focusName: `steps.${index}.rows.${rows.fields.length}.value` })
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex items-start gap-1">
        <IconButton label={isOpen ? `Replier l’étape ${n}` : `Déplier l’étape ${n}`} aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
          {isOpen ? '▾' : '▸'}
        </IconButton>
        <TextField
          className="flex-1"
          label={`Titre de l’étape ${n}`}
          hideLabel
          placeholder={`Étape ${n} (ex : Tête)`}
          error={stepErrors?.title?.message}
          {...register(`steps.${index}.title`, { validate: requiredText, maxLength: maxChars(200) })}
        />
        <IconButton label={`Monter l’étape ${n}`} disabled={index === 0} onClick={onMoveUp}>
          ↑
        </IconButton>
        <IconButton label={`Descendre l’étape ${n}`} disabled={index === count - 1} onClick={onMoveDown}>
          ↓
        </IconButton>
        <IconButton label={`Supprimer l’étape ${n}`} disabled={count === 1} onClick={onRemove}>
          🗑
        </IconButton>
      </div>

      {!isOpen && (
        <p className="px-12 text-sm text-stone-500">
          {rows.fields.length} rang{rows.fields.length > 1 ? 's' : ''}
        </p>
      )}

      {isOpen && (
        <>
          <ol className="flex flex-col gap-2">
            {rows.fields.map((row, r) => {
              const rowErrors = stepErrors?.rows?.[r]
              return (
                <li key={row.id} className="flex items-start gap-2">
                  <TextField
                    className="w-16 shrink-0"
                    label={`Numéro du rang ${r + 1} de l’étape ${n}`}
                    hideLabel
                    placeholder="N°"
                    error={rowErrors?.number?.message}
                    {...register(`steps.${index}.rows.${r}.number`, { validate: requiredText, maxLength: maxChars(20) })}
                  />
                  <TextArea
                    className="flex-1"
                    label={`Instructions du rang ${r + 1} de l’étape ${n}`}
                    hideLabel
                    rows={1}
                    placeholder="ex : 6ms dans un cercle magique (6)"
                    error={rowErrors?.value?.message}
                    {...register(`steps.${index}.rows.${r}.value`, { validate: requiredText })}
                  />
                  <IconButton
                    label={`Supprimer le rang ${r + 1} de l’étape ${n}`}
                    disabled={rows.fields.length === 1}
                    onClick={() => rows.remove(r)}
                  >
                    🗑
                  </IconButton>
                </li>
              )
            })}
          </ol>
          <Button variant="ghost" className="self-start" aria-label={`Ajouter un rang à l’étape ${n}`} onClick={addRow}>
            + Rang
          </Button>
        </>
      )}
    </fieldset>
  )
}
