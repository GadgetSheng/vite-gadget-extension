import { useEffect, useState } from 'react'
import { MockRule } from '../types'
import { getRules, saveRules } from '../storage'
import './App.css'

export default function App() {
  const [rules, setRules] = useState<MockRule[]>([])
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getRules().then(setRules)
  }, [])

  const handleSave = async (newRules: MockRule[]) => {
    setRules(newRules)
    await saveRules(newRules)
  }

  const addRule = () => {
    const newRule: MockRule = {
      id: Math.random().toString(36).substring(7),
      urlPattern: 'api/example',
      method: 'GET',
      status: 200,
      responseBody: '{"message": "Hello World"}',
      active: true,
      delayMs: 0
    }
    handleSave([...rules, newRule])
  }

  const toggleRule = (id: string) => {
    const newRules = rules.map(r => r.id === id ? { ...r, active: !r.active } : r)
    handleSave(newRules)
  }

  const deleteRule = (id: string) => {
    handleSave(rules.filter(r => r.id !== id))
    const newErrors = { ...jsonErrors }
    delete newErrors[id]
    setJsonErrors(newErrors)
  }

  const updateRule = (id: string, updates: Partial<MockRule>) => {
    const newRules = rules.map(r => r.id === id ? { ...r, ...updates } : r)
    
    // Validate JSON if responseBody is being updated
    if (updates.responseBody !== undefined) {
      try {
        JSON.parse(updates.responseBody)
        setJsonErrors(prev => ({ ...prev, [id]: '' }))
      } catch (e) {
        setJsonErrors(prev => ({ ...prev, [id]: 'Invalid JSON format' }))
      }
    }
    
    handleSave(newRules)
  }

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rules, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tweak_rules_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedRules = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedRules)) {
          // Add imported rules, optionally generate new IDs to avoid conflicts
          const newRules = importedRules.map(r => ({ ...r, id: Math.random().toString(36).substring(7) }));
          const mergedRules = [...rules, ...newRules];
          setRules(mergedRules);
          await saveRules(mergedRules);
        } else {
          alert('Invalid format: Expected an array of rules.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    event.target.value = '';
  }

  return (
    <div className="app-container">
      <div className="header-actions">
        <h2>Tweak Clone</h2>
        <div className="action-buttons">
          <button onClick={handleExport} className="btn-secondary" title="Export Rules">Export</button>
          <label className="btn-secondary import-label" title="Import Rules">
            Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      <button onClick={addRule} className="btn-add">+ Add Mock Rule</button>
      
      <div className="rules-list">
        {rules.map((rule) => (
          <div key={rule.id} className={`rule-card ${rule.active ? 'active' : 'inactive'}`}>
            <div className="rule-header">
              <input 
                type="checkbox" 
                checked={rule.active} 
                onChange={() => toggleRule(rule.id)} 
                title="Enable/Disable Mock"
              />
              <select 
                value={rule.method} 
                onChange={(e) => updateRule(rule.id, { method: e.target.value })}
              >
                <option value="ALL">ALL</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input 
                type="text" 
                value={rule.urlPattern} 
                onChange={(e) => updateRule(rule.id, { urlPattern: e.target.value })}
                placeholder="URL match pattern (e.g. /api\/v1\/.*/ or exact text)"
                className="url-input"
                title="Supports simple substring match or regex (e.g. /pattern/)"
              />
              <button onClick={() => deleteRule(rule.id)} className="btn-delete" title="Delete Rule">🗑</button>
            </div>
            <div className="rule-details">
              <div>
                Status: <input type="number" value={rule.status} onChange={(e) => updateRule(rule.id, { status: Number(e.target.value) })} style={{width: '60px'}}/>
              </div>
              <div>
                Delay (ms): <input type="number" value={rule.delayMs || 0} onChange={(e) => updateRule(rule.id, { delayMs: Number(e.target.value) })} style={{width: '80px'}}/>
              </div>
            </div>
            <textarea 
              value={rule.responseBody}
              onChange={(e) => updateRule(rule.id, { responseBody: e.target.value })}
              className={`json-input ${jsonErrors[rule.id] ? 'has-error' : ''}`}
              placeholder="Response Body (JSON or Text)"
            />
            {jsonErrors[rule.id] && <div className="error-text">{jsonErrors[rule.id]}</div>}
          </div>
        ))}
        {rules.length === 0 && <p className="no-rules">No rules yet. Add one to start mocking!</p>}
      </div>
    </div>
  )
}
