import { describe, expect, it, vi } from 'vitest'
import {
  createGadgetLodash,
  isPlainObject,
  merge,
  parseHookResponseRaw,
  runResponseSnippet,
  stringifySnippetResult,
} from './responseSnippetRunner'

describe('parseHookResponseRaw', () => {
  it('parses JSON object', () => {
    expect(parseHookResponseRaw('{"a":1}')).toEqual({ a: 1 })
  })
  it('returns raw string on invalid JSON', () => {
    expect(parseHookResponseRaw('not json')).toBe('not json')
  })
  it('empty trim returns empty string', () => {
    expect(parseHookResponseRaw('   ')).toBe('')
  })
})

describe('stringifySnippetResult', () => {
  it('undefined falls back', () => {
    expect(stringifySnippetResult(undefined, 'orig')).toBe('orig')
  })
  it('object to JSON', () => {
    expect(stringifySnippetResult({ x: 1 }, '')).toBe('{"x":1}')
  })
  it('string passthrough', () => {
    expect(stringifySnippetResult('hi', '')).toBe('hi')
  })
})

describe('merge', () => {
  it('merges nested objects like lodash merge', () => {
    const response = {
      location: {
        country: 'UK',
        city: 'London',
      },
    }
    const _ = createGadgetLodash()
    const out = _.merge(response, {
      location: {
        city: 'Liverpool',
      },
    }) as typeof response
    expect(out.location.city).toBe('Liverpool')
    expect(out.location.country).toBe('UK')
  })
})

describe('runResponseSnippet', () => {
  it('transforms JSON with return', () => {
    const out = runResponseSnippet({
      snippet: 'return { ...response, n: 2 }',
      responseRaw: '{"a":1}',
      url: 'https://x.com',
      method: 'GET',
      body: '',
    })
    expect(JSON.parse(out)).toEqual({ a: 1, n: 2 })
  })

  it('falls back on throw', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const raw = '{"a":1}'
    const out = runResponseSnippet({
      snippet: 'throw new Error("x")',
      responseRaw: raw,
      url: 'https://x.com',
      method: 'GET',
      body: '',
    })
    expect(out).toBe(raw)
    err.mockRestore()
  })

  it('empty snippet returns raw', () => {
    expect(
      runResponseSnippet({
        snippet: '  ',
        responseRaw: 'ok',
        url: '',
        method: 'GET',
        body: '',
      }),
    ).toBe('ok')
  })

  it('passes hookVars into snippet', () => {
    const out = runResponseSnippet({
      snippet: 'return String(vars.n + 1)',
      responseRaw: '{}',
      url: '',
      method: 'GET',
      body: '',
      hookVars: { n: 41 },
    })
    expect(out).toBe('42')
  })
})

describe('isPlainObject', () => {
  it('rejects array', () => {
    expect(isPlainObject([])).toBe(false)
  })
})
