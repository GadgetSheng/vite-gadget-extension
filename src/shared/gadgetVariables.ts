import type { GadgetVariables } from './rule'

const VAR_TOKEN = /\$gadget\.var\.([A-Za-z0-9_]+)/g
const QUOTED_TOKEN = /"\$gadget\.var\.([A-Za-z0-9_]+)"/g

/**
 * 将 `$gadget.var.NAME` 展开（语义对齐常见「变量表」产品；外链参考见仓库 README）。
 * 1. 先替换带引号整段 `"$gadget.var.NAME"` → JSON.stringify(原始值)
 * 2. 再替换剩余 `$gadget.var.NAME`：未定义则保留原 token；已定义则按 JSON 字面量或字符串输出
 */
export function expandGadgetVariables(text: string, vars: GadgetVariables): string {
  if (text == null || text === '') return text
  let out = String(text)

  out = out.replace(QUOTED_TOKEN, (full, name: string) => {
    if (!(name in vars)) return full
    return JSON.stringify(vars[name])
  })

  out = out.replace(VAR_TOKEN, (match, name: string) => {
    if (!(name in vars)) return match
    return formatUnquotedReplacement(vars[name])
  })

  return out
}

function formatUnquotedReplacement(raw: string): string {
  const t = String(raw).trim()
  try {
    const j = JSON.parse(t) as unknown
    if (typeof j === 'number' || typeof j === 'boolean' || j === null) {
      return JSON.stringify(j)
    }
  } catch {
    /* use string */
  }
  return JSON.stringify(t)
}

/** Response hook 中 `vars`：各值尝试 JSON.parse，失败则保留字符串 */
export function parseVariablesForHook(raw: GadgetVariables): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue
    const t = String(v).trim()
    try {
      out[k] = JSON.parse(t) as unknown
    } catch {
      out[k] = v
    }
  }
  return out
}

/** 变量名是否合法（字母、数字、下划线） */
export function isValidVariableName(name: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(name)
}
