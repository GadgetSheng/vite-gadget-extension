## 1. Create Side Panel Structure

- [ ] 1.1 Create src/sidepanel directory
- [ ] 1.2 Create src/sidepanel/index.html with side panel entry point
- [ ] 1.3 Create src/sidepanel/main.tsx as React rendering entry
- [ ] 1.4 Copy App.tsx from src/popup (reuse as main component)

## 2. Update Manifest Configuration

- [ ] 2.1 Add side_panel permission to manifest.json
- [ ] 2.2 Configure side_panel.default_path to sidepanel/index.html
- [ ] 2.3 Remove or deprecate browser_action popup configuration

## 3. Update Vite Configuration

- [ ] 3.1 Add sidepanel as a new entry point in vite.config.ts
- [ ] 3.2 Ensure sidepanel builds to dist/sidepanel/

## 4. Migration and Cleanup

- [ ] 4.1 Remove old popup directory after verification
- [ ] 4.2 Update any references to popup in documentation