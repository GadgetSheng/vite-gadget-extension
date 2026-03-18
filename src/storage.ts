import { MockRule } from './types';

export const getRules = async (): Promise<MockRule[]> => {
  const result = await chrome.storage.local.get('rules');
  return (result.rules as MockRule[]) || [];
};

export const saveRules = async (rules: MockRule[]): Promise<void> => {
  await chrome.storage.local.set({ rules });
};
