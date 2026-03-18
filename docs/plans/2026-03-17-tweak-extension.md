# Tweak Extension Clone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the core features of the "tweak: mock and modify HTTP requests" extension, allowing users to intercept and modify HTTP responses.

**Architecture:** We will inject a script into the page's MAIN world to patch `window.fetch` and `window.XMLHttpRequest`. The content script will act as a bridge, reading mock rules from `chrome.storage.local` and sending them to the injected script via `window.postMessage`. The UI in the popup/sidepanel will manage these rules.

**Tech Stack:** React, TypeScript, Vite, CRXJS (MV3)

---

### Task 1: Setup Types and Storage Utils

**Files:**
- Create: `src/types.ts`
- Create: `src/storage.ts`

**Step 1: Define MockRule type in `src/types.ts`**
```typescript
export interface MockRule {
  id: string;
  urlPattern: string;
  method: string; // GET, POST, PUT, DELETE, ALL
  status: number;
  responseBody: string;
  delayMs?: number;
  active: boolean;
}
```

**Step 2: Create storage helpers in `src/storage.ts`**
```typescript
import { MockRule } from './types';

export const getRules = async (): Promise<MockRule[]> => {
  const result = await chrome.storage.local.get('rules');
  return result.rules || [];
};

export const saveRules = async (rules: MockRule[]): Promise<void> => {
  await chrome.storage.local.set({ rules });
};
```

### Task 2: Configure Manifest for Injection

**Files:**
- Modify: `manifest.config.ts`

**Step 1: Update manifest to include permissions and accessible resources**
```typescript
// Add to manifest.config.ts:
// permissions: ['storage', ...existingPermissions]
// web_accessible_resources: [{ resources: ['src/content/inject.ts'], matches: ['<all_urls>'] }]
```

### Task 3: Create Injection Script (Monkey Patching)

**Files:**
- Create: `src/content/inject.ts`

**Step 1: Patch `fetch` and `XMLHttpRequest`**
Write a script that overrides `window.fetch` and `XMLHttpRequest.prototype.open` / `send`.
The script should listen to `window.addEventListener('message')` to receive updated rules from the content script, and apply them when a request matches the `urlPattern` and `method`.

### Task 4: Setup Content Script Bridge

**Files:**
- Modify: `src/content/main.tsx`

**Step 1: Inject the script and establish the bridge**
- Inject `<script src={chrome.runtime.getURL('src/content/inject.ts')}>` into the document `head`.
- Read rules from `chrome.storage.local` and send them to the page via `window.postMessage`.
- Listen to `chrome.storage.onChanged` to dynamically update the page when rules change in the popup.

### Task 5: Build Rule Management UI

**Files:**
- Modify: `src/sidepanel/App.tsx` (or `src/popup/App.tsx`)

**Step 1: Create UI to manage rules**
- A list of existing rules with a toggle switch.
- A form to add/edit rules (URL, Method, Status, Response Body JSON).
- Use `src/storage.ts` to save changes, which will automatically trigger the content script to notify the injected script.
