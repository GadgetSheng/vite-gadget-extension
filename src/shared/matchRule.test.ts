import { describe, expect, it } from 'vitest'
import {
  findMatchingRule,
  isMockEnabled,
  methodMatches,
  parseResponseHeadersBlock,
  tryParseSlashRegex,
  urlRuleMatches,
} from './matchRule'
import type { Rule } from './rule'

function R(p: Partial<Rule> & Pick<Rule, 'id'>): Rule {
  return {
    label: '',
    urlPrefix: 'https://a.com/v1',
    method: 'GET',
    delayMs: 0,
    statusCode: 200,
    requestPayload: '',
    responsePayload: '{}',
    responseSnippet: '',
    responseHeaders: '',
    enabled: true,
    ...p,
  }
}

describe('urlRuleMatches', () => {
  it('substring is case insensitive', () => {
    expect(urlRuleMatches('https://X.COM/QueryWORK', 'querywork')).toBe(true)
    expect(urlRuleMatches('https://x.com/foo', 'BAR')).toBe(false)
  })

  it('re: regex with case insensitive', () => {
    expect(urlRuleMatches('https://a.com/QueryWorkBenchList', 're:queryworkbench')).toBe(true)
    expect(urlRuleMatches('https://a.com/other', 're:queryworkbench')).toBe(false)
    expect(urlRuleMatches('https://a.com/v1', 're:v\\d+')).toBe(true)
  })

  it('re: invalid regex returns false', () => {
    expect(urlRuleMatches('https://a.com', 're:(')).toBe(false)
  })

  it('slash regex form', () => {
    expect(urlRuleMatches('https://host/QueryList', '/querylist/i')).toBe(true)
    expect(urlRuleMatches('https://host/xxQueryListyy', '/^querylist$/i')).toBe(false)
  })

  it('path-like string falls back to substring when flags invalid', () => {
    expect(urlRuleMatches('https://x.com/api/v1/users', '/api/v1')).toBe(true)
  })

  it('leading slash pattern also matches without slash in URL (e.g. query)', () => {
    expect(
      urlRuleMatches('https://host/api/call?action=queryWorkBenchList&x=1', '/queryWorkBenchList'),
    ).toBe(true)
  })

  it('matches when path segment is percent-encoded', () => {
    expect(urlRuleMatches('https://h.com/%71ueryWorkBenchList', 'queryWorkBenchList')).toBe(true)
  })
})

describe('tryParseSlashRegex', () => {
  it('returns null when trailing part is not flags', () => {
    expect(tryParseSlashRegex('/api/v1')).toBeNull()
  })
  it('parses /body/flags', () => {
    const r = tryParseSlashRegex('/foo\\.bar/i')
    expect(r).toBeTruthy()
    expect(r?.test('https://x.com/foo.bar')).toBe(true)
  })
})

describe('methodMatches', () => {
  it('star matches any', () => {
    expect(methodMatches('*', 'POST')).toBe(true)
  })
  it('case insensitive', () => {
    expect(methodMatches('get', 'GET')).toBe(true)
  })
})

describe('findMatchingRule', () => {
  const rules = [
    R({ id: 'a', urlPrefix: 'https://x.com', enabled: false }),
    R({ id: 'b', urlPrefix: 'https://x.com/api', method: 'GET', responsePayload: '{}' }),
    R({ id: 'c', urlPrefix: 'https://x.com/api', method: 'POST' }),
  ]

  it('returns undefined when global off', () => {
    expect(findMatchingRule(rules, false, 'https://x.com/api/a', 'GET')).toBeUndefined()
  })
  it('skips disabled', () => {
    expect(findMatchingRule(rules, true, 'https://x.com/foo', 'GET')).toBeUndefined()
  })
  it('first match wins', () => {
    const hit = findMatchingRule(rules, true, 'https://x.com/api/foo', 'GET')
    expect(hit?.id).toBe('b')
  })
})

describe('isMockEnabled', () => {
  it('empty response means no mock', () => {
    expect(isMockEnabled(R({ id: '1', responsePayload: '' }))).toBe(false)
    expect(isMockEnabled(R({ id: '2', responsePayload: '   ' }))).toBe(false)
  })
  it('non-empty enables mock', () => {
    expect(isMockEnabled(R({ id: '3', responsePayload: '{}' }))).toBe(true)
  })
})

describe('parseResponseHeadersBlock', () => {
  it('defaults content-type when empty', () => {
    const h = parseResponseHeadersBlock('')
    expect(h.get('Content-Type')).toBe('application/json')
  })
  it('parses lines', () => {
    const h = parseResponseHeadersBlock('X-Test: 1\nX-Other: a b')
    expect(h.get('X-Test')).toBe('1')
    expect(h.get('X-Other')).toBe('a b')
  })
})
