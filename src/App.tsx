import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Save, History, Settings, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { ApiRequest, ApiResponse, KeyValuePair, HttpMethod } from './types';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Default new request
const createNewRequest = (): ApiRequest => ({
  id: generateId(),
  name: 'New Request',
  method: 'GET',
  url: '',
  headers: [{ id: generateId(), key: '', value: '', enabled: true }],
  queryParams: [{ id: generateId(), key: '', value: '', enabled: true }],
  bodyType: 'none',
  body: '',
  timestamp: Date.now()
});

export default function App() {
  // State
  const [requests, setRequests] = useState<ApiRequest[]>([createNewRequest()]);
  const [activeRequestId, setActiveRequestId] = useState<string>(requests[0].id);
  const [responses, setResponses] = useState<Record<string, ApiResponse | null>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');

  const activeRequest = requests.find(r => r.id === activeRequestId) || requests[0];
  const activeResponse = responses[activeRequestId];

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('api-tester-requests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setRequests(parsed);
          setActiveRequestId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse saved requests');
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('api-tester-requests', JSON.stringify(requests));
  }, [requests]);

  // Handlers
  const updateActiveRequest = (updates: Partial<ApiRequest>) => {
    setRequests(prev => prev.map(req => 
      req.id === activeRequestId ? { ...req, ...updates } : req
    ));
  };

  const handleSend = async () => {
    if (!activeRequest.url) return;
    
    setLoading(true);
    
    // Build URL with query params
    let finalUrl = activeRequest.url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      const urlObj = new URL(finalUrl);
      activeRequest.queryParams.filter(p => p.enabled && p.key).forEach(p => {
        urlObj.searchParams.append(p.key, p.value);
      });
      finalUrl = urlObj.toString();
    } catch (e) {
      // Invalid URL, just use as is
    }

    // Build headers
    const headers: Record<string, string> = {};
    activeRequest.headers.filter(h => h.enabled && h.key).forEach(h => {
      headers[h.key] = h.value;
    });

    if (activeRequest.bodyType === 'json' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: activeRequest.method,
          url: finalUrl,
          headers,
          body: activeRequest.bodyType !== 'none' ? activeRequest.body : undefined
        })
      });

      const data = await res.json();
      setResponses(prev => ({ ...prev, [activeRequestId]: data }));
    } catch (error: any) {
      setResponses(prev => ({ 
        ...prev, 
        [activeRequestId]: {
          status: 0,
          statusText: 'Error',
          time: 0,
          size: 0,
          data: null,
          headers: {},
          error: error.message || 'Failed to send request'
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const addNewRequest = () => {
    const newReq = createNewRequest();
    setRequests(prev => [newReq, ...prev]);
    setActiveRequestId(newReq.id);
  };

  const deleteRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (requests.length === 1) {
      const newReq = createNewRequest();
      setRequests([newReq]);
      setActiveRequestId(newReq.id);
      return;
    }
    
    const newRequests = requests.filter(r => r.id !== id);
    setRequests(newRequests);
    if (activeRequestId === id) {
      setActiveRequestId(newRequests[0].id);
    }
  };

  // UI Components
  const renderKeyValueEditor = (
    items: KeyValuePair[], 
    onChange: (items: KeyValuePair[]) => void,
    placeholderKey = 'Key',
    placeholderValue = 'Value'
  ) => {
    const handleChange = (id: string, field: keyof KeyValuePair, value: any) => {
      const newItems = items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      
      // Add new empty row if last row is being edited
      const lastItem = newItems[newItems.length - 1];
      if (lastItem.key || lastItem.value) {
        newItems.push({ id: generateId(), key: '', value: '', enabled: true });
      }
      
      onChange(newItems);
    };

    const handleDelete = (id: string) => {
      if (items.length === 1) {
        onChange([{ id: generateId(), key: '', value: '', enabled: true }]);
        return;
      }
      onChange(items.filter(item => item.id !== id));
    };

    return (
      <div className="flex flex-col space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={item.enabled}
              onChange={(e) => handleChange(item.id, 'enabled', e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-900"
            />
            <input
              type="text"
              value={item.key}
              onChange={(e) => handleChange(item.id, 'key', e.target.value)}
              placeholder={placeholderKey}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => handleChange(item.id, 'value', e.target.value)}
              placeholder={placeholderValue}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button 
              onClick={() => handleDelete(item.id)}
              className="p-1.5 text-zinc-500 hover:text-red-400 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const methodColors: Record<string, string> = {
    GET: 'text-emerald-400',
    POST: 'text-amber-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
    OPTIONS: 'text-zinc-400',
    HEAD: 'text-zinc-400',
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-900/50">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
            <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center">
              <Play size={14} className="text-white ml-0.5" />
            </div>
            <span>API Tester</span>
          </div>
          <button 
            onClick={addNewRequest}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            History
          </div>
          <div className="space-y-0.5 px-2">
            {requests.map(req => (
              <div 
                key={req.id}
                onClick={() => setActiveRequestId(req.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  activeRequestId === req.id 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'hover:bg-zinc-800/50 text-zinc-400'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className={`font-mono text-[10px] font-bold w-10 ${methodColors[req.method]}`}>
                    {req.method}
                  </span>
                  <span className="truncate">{req.name || req.url || 'Untitled Request'}</span>
                </div>
                <button 
                  onClick={(e) => deleteRequest(req.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - URL & Method */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center space-x-2 mb-4">
            <input 
              type="text"
              value={activeRequest.name}
              onChange={(e) => updateActiveRequest({ name: e.target.value })}
              className="bg-transparent text-xl font-semibold text-zinc-100 focus:outline-none focus:border-b border-indigo-500 px-1 py-0.5"
              placeholder="Request Name"
            />
          </div>
          
          <div className="flex space-x-2">
            <select
              value={activeRequest.method}
              onChange={(e) => updateActiveRequest({ method: e.target.value as HttpMethod })}
              className={`bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-500 ${methodColors[activeRequest.method]}`}
            >
              {Object.keys(methodColors).map(m => (
                <option key={m} value={m} className="text-zinc-300">{m}</option>
              ))}
            </select>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={activeRequest.url}
                onChange={(e) => updateActiveRequest({ url: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="https://api.example.com/v1/users"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-4 pr-10 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            
            <button
              onClick={handleSend}
              disabled={loading || !activeRequest.url}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play size={16} className="fill-current" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>

        {/* Middle - Request Details & Response Split */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          
          {/* Request Panel */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 min-h-0">
            <div className="flex items-center px-4 border-b border-zinc-800">
              {(['params', 'headers', 'body'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab 
                      ? 'border-indigo-500 text-indigo-400' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'params' && activeRequest.queryParams.filter(p => p.key).length > 0 && (
                    <span className="ml-2 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">
                      {activeRequest.queryParams.filter(p => p.key).length}
                    </span>
                  )}
                  {tab === 'headers' && activeRequest.headers.filter(h => h.key).length > 0 && (
                    <span className="ml-2 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">
                      {activeRequest.headers.filter(h => h.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-900/20">
              {activeTab === 'params' && (
                <div>
                  <div className="mb-4 text-sm text-zinc-400">Query Parameters</div>
                  {renderKeyValueEditor(
                    activeRequest.queryParams, 
                    (params) => updateActiveRequest({ queryParams: params })
                  )}
                </div>
              )}
              
              {activeTab === 'headers' && (
                <div>
                  <div className="mb-4 text-sm text-zinc-400">Headers</div>
                  {renderKeyValueEditor(
                    activeRequest.headers, 
                    (headers) => updateActiveRequest({ headers })
                  )}
                </div>
              )}
              
              {activeTab === 'body' && (
                <div className="h-full flex flex-col">
                  <div className="flex items-center space-x-4 mb-4">
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        checked={activeRequest.bodyType === 'none'}
                        onChange={() => updateActiveRequest({ bodyType: 'none' })}
                        className="text-indigo-500 focus:ring-indigo-500 bg-zinc-800 border-zinc-700"
                      />
                      <span>None</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        checked={activeRequest.bodyType === 'json'}
                        onChange={() => updateActiveRequest({ bodyType: 'json' })}
                        className="text-indigo-500 focus:ring-indigo-500 bg-zinc-800 border-zinc-700"
                      />
                      <span>JSON</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        checked={activeRequest.bodyType === 'text'}
                        onChange={() => updateActiveRequest({ bodyType: 'text' })}
                        className="text-indigo-500 focus:ring-indigo-500 bg-zinc-800 border-zinc-700"
                      />
                      <span>Text</span>
                    </label>
                  </div>
                  
                  {activeRequest.bodyType !== 'none' && (
                    <textarea
                      value={activeRequest.body}
                      onChange={(e) => updateActiveRequest({ body: e.target.value })}
                      placeholder={activeRequest.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Enter body content...'}
                      className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none"
                      spellCheck={false}
                    />
                  )}
                  {activeRequest.bodyType === 'none' && (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                      This request does not have a body
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Response Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
            {activeResponse ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-500">Status:</span>
                      <span className={`font-mono font-bold ${
                        activeResponse.status >= 200 && activeResponse.status < 300 ? 'text-emerald-400' :
                        activeResponse.status >= 400 ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {activeResponse.status} {activeResponse.statusText}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-500">Time:</span>
                      <span className="font-mono text-emerald-400">{activeResponse.time} ms</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-500">Size:</span>
                      <span className="font-mono text-emerald-400">
                        {(activeResponse.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center px-4 border-b border-zinc-800 bg-zinc-900/30">
                  {(['body', 'headers'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setResponseTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        responseTab === tab 
                          ? 'border-indigo-500 text-indigo-400' 
                          : 'border-transparent text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === 'headers' && (
                        <span className="ml-2 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">
                          {Object.keys(activeResponse.headers).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {activeResponse.error ? (
                    <div className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                      {activeResponse.error}
                    </div>
                  ) : responseTab === 'body' ? (
                    <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-all">
                      {typeof activeResponse.data === 'object' 
                        ? JSON.stringify(activeResponse.data, null, 2)
                        : activeResponse.data}
                    </pre>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(activeResponse.headers).map(([key, value]) => (
                        <div key={key} className="flex text-sm font-mono">
                          <span className="text-indigo-300 w-1/3 break-all pr-4">{key}:</span>
                          <span className="text-zinc-300 w-2/3 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                <Play size={48} className="mb-4 opacity-20" />
                <p>Enter a URL and click Send to get a response</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
