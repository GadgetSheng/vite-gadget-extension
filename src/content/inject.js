// Use plain JavaScript comments here since it may not get transpiled depending on config
// Define MockRule locally to avoid import issues in injected script
// interface MockRule {
//   id: string;
//   urlPattern: string;
//   method: string;
//   status: number;
//   responseBody: string;
//   delayMs?: number;
//   active: boolean;
// }

let mockRules = [];

console.log('[Tweak Clone] Inject script loaded and running!');

// Listen for rules updates from the content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'TWEAK_UPDATE_RULES') {
    console.log('[Tweak Clone] Received updated rules:', event.data.rules);
    mockRules = event.data.rules;
  }
});

// Helper to check if a request should be mocked
const getMockRule = (url, method) => {
  return mockRules.find(
    (rule) => {
      if (!rule.active) return false;
      if (rule.method !== 'ALL' && rule.method.toUpperCase() !== method.toUpperCase()) return false;
      
      try {
        // Simple string match or try regex match if it's formatted as a regex
        if (rule.urlPattern.startsWith('/') && rule.urlPattern.endsWith('/')) {
          const regexStr = rule.urlPattern.slice(1, -1);
          const regex = new RegExp(regexStr);
          return regex.test(url);
        }
        return url.includes(rule.urlPattern);
      } catch (e) {
        // Fallback to simple string match if regex fails
        return url.includes(rule.urlPattern);
      }
    }
  );
};

// Patch fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  let url = '';
  if (typeof resource === 'string') {
    url = resource;
  } else if (resource instanceof Request) {
    url = resource.url;
  } else {
    url = resource ? resource.toString() : '';
  }

  const method = config?.method || (resource instanceof Request ? resource.method : 'GET');
  const rule = getMockRule(url, method);

  if (rule) {
    console.log(
      '%c[Tweak Clone]%c 🚀 Mocking fetch request:', 
      'color: white; background: #3498db; padding: 2px 4px; border-radius: 4px;',
      'color: inherit;',
      url
    );
    console.log('[Tweak Clone] Applied Rule:', rule);
    
    if (rule.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    }
    return new Response(rule.responseBody, {
      status: rule.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return originalFetch(...args);
};

// Patch XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (...args) {
  this._tweak_method = args[0];
  this._tweak_url = args[1];
  return originalXHROpen.apply(this, args);
};

XMLHttpRequest.prototype.send = function (...args) {
  const method = this._tweak_method;
  const url = this._tweak_url;
  const rule = getMockRule(url, method);
  
  if (rule) {
    console.log(
      '%c[Tweak Clone]%c 🚀 Mocking XHR request:', 
      'color: white; background: #3498db; padding: 2px 4px; border-radius: 4px;',
      'color: inherit;',
      url
    );
    console.log('[Tweak Clone] Applied Rule:', rule);
    
    const applyMock = () => {
      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
      Object.defineProperty(this, 'status', { value: rule.status, writable: false });
      Object.defineProperty(this, 'response', { value: rule.responseBody, writable: false });
      Object.defineProperty(this, 'responseText', { value: rule.responseBody, writable: false });
      
      const event = new ProgressEvent('readystatechange');
      const loadEvent = new ProgressEvent('load');
      
      if (this.onreadystatechange) {
        this.onreadystatechange(event);
      }
      if (this.onload) {
        this.onload(loadEvent);
      }
      this.dispatchEvent(event);
      this.dispatchEvent(loadEvent);
    };

    if (rule.delayMs) {
      setTimeout(applyMock, rule.delayMs);
    } else {
      applyMock();
    }
    return;
  }

  return originalXHRSend.apply(this, args);
};
