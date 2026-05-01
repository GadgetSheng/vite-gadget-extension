## ADDED Requirements

### Requirement: Side Panel Entry Point
The extension SHALL provide a side panel entry point accessible via Chrome Side Panel API (Chrome 120+).

#### Scenario: Side panel opens via toolbar icon
- **WHEN** user clicks the extension toolbar icon
- **THEN** the side panel opens with the full mock rule management interface

#### Scenario: Side panel persists across tab navigation
- **WHEN** user navigates to another page in the same tab
- **THEN** the side panel remains open and functional

### Requirement: Feature Parity with Popup
The side panel SHALL expose all functionality previously available in the popup:
- Rule list display with cover, method, URL prefix, delay, and status code
- Rule creation, editing, deletion, and enable/disable toggle
- Variables editor for global custom variables
- Import/Export of rule configurations
- Global enable/disable control

#### Scenario: Rule management in side panel
- **WHEN** user manages rules in the side panel
- **THEN** behavior matches the previous popup implementation

#### Scenario: Import/Export functionality
- **WHEN** user imports or exports rule configurations
- **THEN** behavior matches the previous popup implementation

### Requirement: Manifest Configuration
The extension manifest SHALL declare side_panel permission and configure the default side panel path.

#### Scenario: Manifest declares side panel
- **WHEN** Chrome loads the extension
- **THEN** the manifest includes side_panel permission and default_path pointing to sidepanel/index.html

### Requirement: Build Output
The side panel SHALL be built as a separate HTML entry point by Vite, alongside the existing popup entry.

#### Scenario: Side panel builds successfully
- **WHEN** `npm run build` is executed
- **THEN** the dist/ directory contains sidepanel/index.html and its associated assets