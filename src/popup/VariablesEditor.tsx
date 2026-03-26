import { useCallback, useState } from 'react'
import type { GadgetVariables } from '@/shared/rule'
import { isValidVariableName } from '@/shared/gadgetVariables'

type Row = { id: string; name: string; value: string }

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

function rowsFromVars(v: GadgetVariables): Row[] {
  const e = Object.entries(v)
  if (e.length === 0) return [{ id: newId(), name: '', value: '' }]
  return e.map(([name, value]) => ({ id: name, name, value }))
}

function toVariables(rows: Row[]): GadgetVariables {
  const out: GadgetVariables = {}
  for (const r of rows) {
    const n = r.name.trim()
    if (!n) continue
    if (!isValidVariableName(n)) continue
    out[n] = r.value
  }
  return out
}

export interface VariablesEditorProps {
  initialVariables: GadgetVariables
  onChange: (v: GadgetVariables) => void
}

export function VariablesEditor({
  initialVariables,
  onChange,
}: VariablesEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => rowsFromVars(initialVariables))
  const [nameError, setNameError] = useState<string | null>(null)

  const updateRow = useCallback(
    (id: string, patch: Partial<Pick<Row, 'name' | 'value'>>) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
        const row = next.find((r) => r.id === id)
        const nm = row?.name.trim()
        if (nm && !isValidVariableName(nm)) {
          setNameError('变量名仅允许字母、数字、下划线')
        } else {
          setNameError(null)
        }
        onChange(toVariables(next))
        return next
      })
    },
    [onChange]
  )

  const addRow = useCallback(() => {
    setRows((prev) => {
      const next = [...prev, { id: newId(), name: '', value: '' }]
      onChange(toVariables(next))
      return next
    })
  }, [onChange])

  const removeRow = useCallback(
    (id: string) => {
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id)
        const finalRows = next.length
          ? next
          : [{ id: newId(), name: '', value: '' }]
        onChange(toVariables(finalRows))
        return finalRows
      })
    },
    [onChange]
  )

  return (
    <section className="variables-editor" aria-label="自定义变量">
      <div className="variables-editor__head">
        <h2 className="variables-editor__title">自定义变量</h2>
        <p className="variables-editor__desc">
          在 Response / Request payload、Headers、Response snippet 中使用
          <code>$gadget.var.变量名</code> 插值；脚本内用{' '}
          <code>vars.变量名</code>。
        </p>
      </div>
      {nameError ? (
        <p className="variables-editor__error">{nameError}</p>
      ) : null}
      <div className="variables-editor__table-wrap">
        <table className="variables-editor__table">
          <thead>
            <tr>
              <th scope="col">变量名</th>
              <th scope="col">值</th>
              <th scope="col" className="variables-editor__col-actions">
                <span className="variables-editor__sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="variables-editor__input variables-editor__input--name"
                    value={row.name}
                    onChange={(e) =>
                      updateRow(row.id, { name: e.target.value })
                    }
                    placeholder="e.g. token"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="变量名"
                  />
                </td>
                <td>
                  <input
                    className="variables-editor__input"
                    value={row.value}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value })
                    }
                    placeholder="值（可为 JSON 字面量）"
                    spellCheck={false}
                    aria-label="变量值"
                  />
                </td>
                <td className="variables-editor__col-actions">
                  <button
                    type="button"
                    className="variables-editor__remove"
                    onClick={() => removeRow(row.id)}
                    title="删除此行"
                    aria-label="删除此行"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="variables-editor__add" onClick={addRow}>
        ＋ 添加变量
      </button>
    </section>
  )
}
