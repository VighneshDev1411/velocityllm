'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  DollarSign,
  Hash,
  Play,
  Code2,
  Settings2,
  History,
  Loader2,
  Terminal,
  AlertCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletionResponse {
  status: string;
  data: {
    response: string;
    model: string;
    tokens_used: number;
    cost: number;
    latency_ms: number;
  };
}

interface HistoryEntry {
  id: string;
  timestamp: Date;
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  response: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta' },
];

const CODE_TABS = ['curl', 'Python', 'JavaScript', 'Go'] as const;
type CodeTab = (typeof CODE_TABS)[number];

const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Helper: generate code snippets
// ---------------------------------------------------------------------------

function generateCodeSnippet(
  tab: CodeTab,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
  topP: number,
): string {
  const escapedPrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  switch (tab) {
    case 'curl':
      return `curl -X POST ${baseUrl}/api/v1/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "${escapedPrompt}",
    "model": "${model}",
    "max_tokens": ${maxTokens},
    "temperature": ${temperature},
    "top_p": ${topP}
  }'`;

    case 'Python':
      return `import requests

url = "${baseUrl}/api/v1/completions"
payload = {
    "prompt": "${escapedPrompt}",
    "model": "${model}",
    "max_tokens": ${maxTokens},
    "temperature": ${temperature},
    "top_p": ${topP},
}

response = requests.post(url, json=payload)
data = response.json()

print(data["data"]["response"])
print(f"Tokens: {data['data']['tokens_used']}")
print(f"Cost: ${'{'}data['data']['cost']:.4f{'}'}")
print(f"Latency: {data['data']['latency_ms']}ms")`;

    case 'JavaScript':
      return `const response = await fetch("${baseUrl}/api/v1/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "${escapedPrompt}",
    model: "${model}",
    max_tokens: ${maxTokens},
    temperature: ${temperature},
    top_p: ${topP},
  }),
});

const data = await response.json();

console.log(data.data.response);
console.log(\`Tokens: \${data.data.tokens_used}\`);
console.log(\`Cost: $\${data.data.cost.toFixed(4)}\`);
console.log(\`Latency: \${data.data.latency_ms}ms\`);`;

    case 'Go':
      return `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	payload := map[string]interface{}{
		"prompt":     "${escapedPrompt}",
		"model":      "${model}",
		"max_tokens": ${maxTokens},
		"temperature": ${temperature},
		"top_p":      ${topP},
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(
		"${baseUrl}/api/v1/completions",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}`;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function ParameterSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-20 text-right text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function HistoryItem({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{entry.prompt}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              {entry.model}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {entry.latencyMs}ms
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {entry.tokensUsed} tokens
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {entry.timestamp.toLocaleTimeString()}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Prompt
            </h4>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-200">
              {entry.prompt}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Response
            </h4>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-md p-3 border border-gray-200">
              {entry.error ? (
                <span className="text-red-600">{entry.error}</span>
              ) : (
                entry.response
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Settings2 className="w-3 h-3" />
              temp={entry.temperature}, top_p={entry.topP}, max_tokens={entry.maxTokens}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />${entry.cost.toFixed(4)}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />{entry.latencyMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PlaygroundPage() {
  // Prompt state
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Model & params
  const [model, setModel] = useState('gpt-4');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(1.0);

  // Response state
  const [response, setResponse] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [responseMeta, setResponseMeta] = useState<{
    model: string;
    tokensUsed: number;
    cost: number;
    latencyMs: number;
  } | null>(null);

  // Code tab
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('curl');

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ------- Handlers -------

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse(null);
    setResponseError(null);
    setResponseMeta(null);

    const startTime = Date.now();

    try {
      const res = await api.post<CompletionResponse>('/api/v1/completions', {
        prompt: prompt.trim(),
        model,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
      });

      const data = res.data.data;
      const latency = data.latency_ms || Date.now() - startTime;

      setResponse(data.response);
      setResponseMeta({
        model: data.model,
        tokensUsed: data.tokens_used,
        cost: data.cost,
        latencyMs: latency,
      });

      // Add to history
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          prompt: prompt.trim(),
          model: data.model,
          temperature,
          maxTokens,
          topP,
          response: data.response,
          tokensUsed: data.tokens_used,
          cost: data.cost,
          latencyMs: latency,
        };
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred';

      setResponseError(errorMessage);
      setResponseMeta({
        model,
        tokensUsed: 0,
        cost: 0,
        latencyMs: elapsed,
      });

      // Still add to history as a failed entry
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          prompt: prompt.trim(),
          model,
          temperature,
          maxTokens,
          topP,
          response: '',
          tokensUsed: 0,
          cost: 0,
          latencyMs: elapsed,
          error: errorMessage,
        };
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, model, maxTokens, temperature, topP, isLoading]);

  const handleClear = useCallback(() => {
    setPrompt('');
    setResponse(null);
    setResponseError(null);
    setResponseMeta(null);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const currentSnippet = generateCodeSnippet(activeCodeTab, model, prompt || 'Hello, world!', temperature, maxTokens, topP);
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === model);

  // ------- Render -------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">API Playground</h1>
                <p className="text-sm text-gray-500">
                  Test and explore the VelocityLLM completions API
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                API Connected
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ============ LEFT COLUMN ============ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prompt Input */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  Prompt
                </h2>
                <span className="text-xs text-gray-400">
                  {prompt.length > 0 ? `${prompt.length} characters` : 'Enter your prompt below'}
                </span>
              </div>

              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your prompt here... (Ctrl/Cmd + Enter to send)"
                rows={6}
                className="w-full px-5 py-4 text-sm text-gray-900 placeholder-gray-400 resize-y focus:outline-none min-h-[140px] max-h-[400px] font-mono"
              />

              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">
                    Ctrl+Enter
                  </span>
                  to send
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!prompt.trim() || isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {isLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>

            {/* Response Display */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-500" />
                  Response
                </h2>
                {responseMeta && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {responseMeta.latencyMs}ms
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {responseMeta.tokensUsed} tokens
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />${responseMeta.cost.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 min-h-[180px]">
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                      <p className="mt-3 text-sm text-gray-500">Generating response...</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Using {selectedModel?.name || model}
                      </p>
                    </div>
                  </div>
                )}

                {!isLoading && responseError && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Request Failed</p>
                      <p className="text-sm text-red-700 mt-1">{responseError}</p>
                    </div>
                  </div>
                )}

                {!isLoading && response && (
                  <div className="relative group">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={response} />
                    </div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 rounded-lg p-4 border border-gray-200">
                      {response}
                    </div>
                  </div>
                )}

                {!isLoading && !response && !responseError && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Terminal className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-sm font-medium">No response yet</p>
                    <p className="text-xs mt-1">
                      Enter a prompt above and click Send to get started
                    </p>
                  </div>
                )}
              </div>

              {responseMeta && (
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      Model:{' '}
                      <span className="font-medium text-gray-700">{responseMeta.model}</span>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      Latency:{' '}
                      <span className="font-medium text-gray-700">{responseMeta.latencyMs}ms</span>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      Tokens:{' '}
                      <span className="font-medium text-gray-700">{responseMeta.tokensUsed}</span>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      Cost:{' '}
                      <span className="font-medium text-gray-700">
                        ${responseMeta.cost.toFixed(4)}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Request / Response History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-500" />
                  Request History
                  {history.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                      {history.length}
                    </span>
                  )}
                </h2>
                {isHistoryOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isHistoryOpen && (
                <div className="px-5 py-4">
                  {history.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No requests yet</p>
                      <p className="text-xs mt-1">
                        Your request history will appear here (max {MAX_HISTORY} entries)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {history.map((entry) => (
                        <HistoryItem
                          key={entry.id}
                          entry={entry}
                          isExpanded={expandedHistoryId === entry.id}
                          onToggle={() =>
                            setExpandedHistoryId(
                              expandedHistoryId === entry.id ? null : entry.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  )}

                  {history.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => {
                          setHistory([]);
                          setExpandedHistoryId(null);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear History
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <div className="space-y-6">
            {/* Model Selection */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Model
                </h2>
              </div>
              <div className="px-5 py-4">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-200">
                      {selectedModel.provider}
                    </span>
                    <span className="text-xs text-gray-500">{selectedModel.id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Parameter Controls */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-gray-500" />
                  Parameters
                </h2>
              </div>
              <div className="px-5 py-4 space-y-6">
                <ParameterSlider
                  label="Temperature"
                  value={temperature}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={setTemperature}
                  icon={<Sparkles className="w-3.5 h-3.5 text-orange-500" />}
                />
                <ParameterSlider
                  label="Max Tokens"
                  value={maxTokens}
                  min={1}
                  max={4096}
                  step={1}
                  onChange={setMaxTokens}
                  icon={<Hash className="w-3.5 h-3.5 text-blue-500" />}
                />
                <ParameterSlider
                  label="Top-P"
                  value={topP}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={setTopP}
                  icon={<TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                />

                {/* Reset defaults */}
                <button
                  onClick={() => {
                    setTemperature(0.7);
                    setMaxTokens(1024);
                    setTopP(1.0);
                  }}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* Code Examples */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-500" />
                  Code Examples
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {CODE_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCodeTab(tab)}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                      activeCodeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Code Block */}
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <CopyButton text={currentSnippet} />
                </div>
                <pre className="px-5 py-4 text-xs text-gray-800 font-mono overflow-x-auto bg-gray-900 text-gray-100 leading-relaxed max-h-[400px]">
                  <code>{currentSnippet}</code>
                </pre>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-400">
                  Code updates dynamically based on your current settings
                </p>
              </div>
            </div>

            {/* Quick Reference */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  API Reference
                </h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600">Completions</p>
                  <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded block mt-1">
                    POST /api/v1/completions
                  </code>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Streaming</p>
                  <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded block mt-1">
                    POST /api/v1/completions/stream
                  </code>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">List Models</p>
                  <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded block mt-1">
                    GET /api/v1/models
                  </code>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Base URL:{' '}
                    <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
