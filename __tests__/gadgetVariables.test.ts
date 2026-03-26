import { describe, expect, it } from 'vitest'
import {
  expandGadgetVariables,
  parseVariablesForHook,
} from '../src/shared/gadgetVariables'

describe('expandGadgetVariables', () => {
  it('quoted form stringifies value', () => {
    const v = { token: 'abc' }
    expect(expandGadgetVariables('{"x":"$gadget.var.token"}', v)).toBe(
      '{"x":"abc"}'
    )
  })

  it('unquoted numeric from JSON-like stored value', () => {
    const vars = { ts: '123' }
    expect(expandGadgetVariables('{"t": $gadget.var.ts}', vars)).toBe(
      '{"t": 123}'
    )
  })

  it('unquoted boolean', () => {
    expect(
      expandGadgetVariables('{"ok": $gadget.var.flag}', { flag: 'true' })
    ).toBe('{"ok": true}')
  })

  it('unknown variable leaves token', () => {
    expect(expandGadgetVariables('{"a": $gadget.var.missing}', {})).toBe(
      '{"a": $gadget.var.missing}'
    )
  })

  it('empty vars table', () => {
    expect(expandGadgetVariables('{"a": $gadget.var.x}', {})).toBe(
      '{"a": $gadget.var.x}'
    )
  })
})

describe('parseVariablesForHook', () => {
  it('parses numbers and keeps plain strings', () => {
    const p = parseVariablesForHook({ n: '42', s: 'hello' })
    expect(p.n).toBe(42)
    expect(p.s).toBe('hello')
  })
})
