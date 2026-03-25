import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  type ExtensionState,
  type Rule,
  migrateRulesFromStorage,
  migrateVariablesFromStorage,
} from './shared/rule'

export async function getExtensionState(): Promise<ExtensionState> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.rules,
    STORAGE_KEYS.globalEnabled,
    STORAGE_KEYS.schemaVersion,
    STORAGE_KEYS.variables,
  ])
  const rules = migrateRulesFromStorage(raw[STORAGE_KEYS.rules])
  const sv = raw[STORAGE_KEYS.schemaVersion]
  return {
    schemaVersion: typeof sv === 'number' ? sv : SCHEMA_VERSION,
    globalEnabled: raw[STORAGE_KEYS.globalEnabled] !== false,
    rules,
    variables: migrateVariablesFromStorage(raw[STORAGE_KEYS.variables]),
  }
}

export async function setExtensionState(partial: {
  rules?: Rule[]
  globalEnabled?: boolean
  variables?: ExtensionState['variables']
}): Promise<void> {
  const payload: Record<string, unknown> = {
    [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
  }
  if (partial.rules !== undefined) {
    payload[STORAGE_KEYS.rules] = partial.rules
  }
  if (partial.globalEnabled !== undefined) {
    payload[STORAGE_KEYS.globalEnabled] = partial.globalEnabled
  }
  if (partial.variables !== undefined) {
    payload[STORAGE_KEYS.variables] = partial.variables
  }
  await chrome.storage.local.set(payload)
}

/** @deprecated 使用 getExtensionState */
export async function getRules(): Promise<Rule[]> {
  const s = await getExtensionState()
  return s.rules
}

/** @deprecated 使用 setExtensionState */
export async function saveRules(rules: Rule[]): Promise<void> {
  await setExtensionState({ rules })
}
