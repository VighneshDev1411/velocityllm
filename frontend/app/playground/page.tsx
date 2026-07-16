'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
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
  Terminal,
  AlertCircle,
  Sparkles,
  TrendingUp,
  StopCircle,
  Radio,
  GitCompare,
} from 'lucide-react';
import LinearProgress from '@mui/material/LinearProgress';
import Switch from '@mui/material/Switch';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useStreaming } from '@/hooks/useStreaming';
import BatchCompare from './BatchCompare';

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

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
}

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
// Shared styles
// ---------------------------------------------------------------------------

const paperSx = {
  elevation: 0,
  border: '1px solid', borderColor: 'divider',
  borderRadius: '8px',
  overflow: 'hidden',
};

const sectionHeaderSx = {
  px: 2.5,
  py: 1.5,
  borderBottom: '1px solid', borderColor: 'divider',
  bgcolor: 'rgba(37,37,37,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

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
    <IconButton
      onClick={handleCopy}
      size="small"
      title="Copy to clipboard"
      sx={{ color: copied ? 'success.main' : 'text.disabled', '&:hover': { color: 'text.secondary', bgcolor: 'action.hover' } }}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </IconButton>
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75 }}
        >
          {icon}
          {label}
        </Typography>
        <TextField
          type="number"
          value={value}
          size="small"
          inputProps={{ min, max, step, style: { textAlign: 'right', fontSize: '0.875rem', padding: '4px 8px', fontFamily: 'var(--font-mono), "JetBrains Mono", monospace' } }}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          sx={{ width: 80, '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
        />
      </Box>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(v as number)}
        sx={{
          color: '#adc6ff',
          height: 6,
          '& .MuiSlider-thumb': { width: 16, height: 16 },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{min}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{max}</Typography>
      </Box>
    </Box>
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
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'background.default' },
          transition: 'background-color 0.15s',
        }}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.prompt}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
            <Chip label={entry.model} size="small" sx={{ height: 22, fontSize: '0.75rem', fontWeight: 500, bgcolor: 'rgba(173,198,255,0.1)', color: 'primary.dark' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Clock className="w-3 h-3" />
              {entry.latencyMs}ms
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Hash className="w-3 h-3" />
              {entry.tokensUsed} tokens
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
          {entry.timestamp.toLocaleTimeString()}
        </Typography>
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1.5, bgcolor: 'background.default' }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Prompt
            </Typography>
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', bgcolor: 'background.paper', borderRadius: '6px', p: 1.5, border: '1px solid', borderColor: 'divider', mt: 0.5, color: 'text.primary' }}
            >
              {entry.prompt}
            </Typography>
          </Box>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Response
            </Typography>
            <Typography
              variant="body2"
              component="div"
              sx={{ whiteSpace: 'pre-wrap', bgcolor: 'background.paper', borderRadius: '6px', p: 1.5, border: '1px solid', borderColor: 'divider', mt: 0.5, color: 'text.primary' }}
            >
              {entry.error ? (
                <Typography variant="body2" sx={{ color: '#dc2626' }}>{entry.error}</Typography>
              ) : (
                entry.response
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Settings2 className="w-3 h-3" />
              temp={entry.temperature}, top_p={entry.topP}, max_tokens={entry.maxTokens}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DollarSign className="w-3 h-3" />${entry.cost.toFixed(4)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Zap className="w-3 h-3" />{entry.latencyMs}ms
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
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
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(1.0);

  // Fetch models from backend on mount
  useEffect(() => {
    api.get('/api/v1/models').then((res) => {
      const models: AvailableModel[] = (res.data?.data || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        provider: m.provider,
      }));
      if (models.length > 0) {
        setAvailableModels(models);
        setModel((prev) => prev || models[0].id);
      }
    }).catch(() => {
      // silently fail — user can still type a model name
    });
  }, []);

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

  // Streaming mode
  const [streamMode, setStreamMode] = useState(true);
  const streaming = useStreaming();

  // Page-level tabs: Playground vs Compare
  const [pageTab, setPageTab] = useState(0);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll during streaming
  useEffect(() => {
    if (streaming.isStreaming && responseEndRef.current) {
      responseEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [streaming.text, streaming.isStreaming]);

  // ------- Handlers -------

  const handleStreamSend = useCallback(() => {
    if (!prompt.trim() || streaming.isStreaming) return;
    setResponse(null);
    setResponseError(null);
    setResponseMeta(null);

    streaming.start({
      model,
      prompt: prompt.trim(),
      maxTokens,
      temperature,
      topP,
      onDone: (fullText, tokenCount, elapsedMs) => {
        setResponse(fullText);
        setResponseMeta({ model, tokensUsed: tokenCount, cost: 0, latencyMs: elapsedMs });
        setHistory((prev) => {
          const entry: HistoryEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            prompt: prompt.trim(),
            model,
            temperature,
            maxTokens,
            topP,
            response: fullText,
            tokensUsed: tokenCount,
            cost: 0,
            latencyMs: elapsedMs,
          };
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
      },
      onError: (errMsg) => {
        setResponseError(errMsg);
      },
    });
  }, [prompt, model, maxTokens, temperature, topP, streaming]);

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
    streaming.stop();
    setPrompt('');
    setResponse(null);
    setResponseError(null);
    setResponseMeta(null);
    textareaRef.current?.focus();
  }, [streaming]);

  const activeSend = streamMode ? handleStreamSend : handleSend;
  const isBusy = streamMode ? streaming.isStreaming : isLoading;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        activeSend();
      }
    },
    [activeSend],
  );

  const currentSnippet = generateCodeSnippet(activeCodeTab, model, prompt || 'Hello, world!', temperature, maxTokens, topP);
  const selectedModel = availableModels.find((m) => m.id === model);

  // ------- Render -------

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <PageHeader
        title="API Playground"
        subtitle="Test and explore the VelocityLLM completions API"
        action={
          <Chip
            label="API Connected"
            size="small"
            sx={{
              bgcolor: 'rgba(83,225,111,0.1)',
              color: '#53e16f',
              border: '1px solid rgba(83,225,111,0.3)',
              fontWeight: 500,
              '& .MuiChip-icon': { color: '#53e16f' },
            }}
            icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#53e16f', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />}
          />
        }
      />

      {/* Page-level Tabs */}
      <Tabs
        value={pageTab}
        onChange={(_, v) => setPageTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', minHeight: 40 },
          '& .Mui-selected': { color: '#06b6d4' },
          '& .MuiTabs-indicator': { bgcolor: '#06b6d4' },
        }}
      >
        <Tab icon={<Terminal className="w-4 h-4" />} iconPosition="start" label="Playground" />
        <Tab icon={<GitCompare className="w-4 h-4" />} iconPosition="start" label="Compare" />
      </Tabs>

      {pageTab === 1 && <BatchCompare availableModels={availableModels} />}

      {pageTab === 0 && <Grid container spacing={3}>
        {/* ============ LEFT COLUMN ============ */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Prompt Input */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  Prompt
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {prompt.length > 0 ? `${prompt.length} characters` : 'Enter your prompt below'}
                </Typography>
              </Box>

              <TextField
                inputRef={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your prompt here... (Ctrl/Cmd + Enter to send)"
                multiline
                minRows={6}
                maxRows={16}
                fullWidth
                variant="standard"
                InputProps={{ disableUnderline: true }}
                sx={{
                  '& .MuiInputBase-root': { px: 2.5, py: 2, fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.primary' },
                  '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 1 },
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(37,37,37,0.5)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ px: 1, py: 0.25, bgcolor: 'divider', borderRadius: '4px', color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}
                  >
                    Ctrl+Enter
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    to send
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {/* Stream Mode Toggle */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <Radio className="w-3.5 h-3.5" style={{ color: streamMode ? '#53e16f' : undefined, opacity: streamMode ? 1 : 0.4 }} />
                    <Typography variant="caption" sx={{ color: streamMode ? 'success.main' : 'text.disabled', fontWeight: 500, mx: 0.5, userSelect: 'none' }}>
                      Stream
                    </Typography>
                    <Switch
                      size="small"
                      checked={streamMode}
                      onChange={(e) => setStreamMode(e.target.checked)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#53e16f' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(83,225,111,0.4)' } }}
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleClear}
                    disabled={isBusy}
                    startIcon={<Trash2 className="w-3.5 h-3.5" />}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'divider',
                      color: 'text.secondary',
                      borderRadius: '8px',
                      '&:hover': { borderColor: 'divider', bgcolor: 'background.default' },
                    }}
                  >
                    Clear
                  </Button>
                  {/* Stop button (streaming) */}
                  {streaming.isStreaming && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={streaming.stop}
                      startIcon={<StopCircle className="w-3.5 h-3.5" />}
                      sx={{
                        textTransform: 'none',
                        bgcolor: '#dc2626',
                        borderRadius: '8px',
                        '&:hover': { bgcolor: '#b91c1c' },
                      }}
                    >
                      Stop
                    </Button>
                  )}
                  {/* Send button */}
                  {!streaming.isStreaming && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={activeSend}
                      disabled={!prompt.trim() || isBusy}
                      startIcon={
                        isBusy ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )
                      }
                      sx={{
                        textTransform: 'none',
                        bgcolor: '#adc6ff',
                        color: '#131313',
                        borderRadius: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: 'primary.dark', color: '#131313' },
                        '&.Mui-disabled': { bgcolor: 'rgba(173,198,255,0.4)', color: 'rgba(19,19,19,0.5)' },
                      }}
                    >
                      {isBusy ? 'Sending...' : 'Send'}
                    </Button>
                  )}
                </Box>
              </Box>
            </Paper>

            {/* Response Display */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Play className="w-4 h-4 text-green-500" />
                  Response
                  {streaming.isStreaming && (
                    <Chip
                      label="LIVE"
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                        bgcolor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)',
                        animation: 'pulse 1.5s infinite',
                        '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
                      }}
                    />
                  )}
                </Typography>
                {/* Streaming stats */}
                {streaming.isStreaming && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, fontFamily: 'monospace' }}>
                      <Hash className="w-3 h-3" />
                      {streaming.tokenCount} tokens
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, fontFamily: 'monospace' }}>
                      <Clock className="w-3 h-3" />
                      {(streaming.elapsedMs / 1000).toFixed(1)}s
                    </Typography>
                    {streaming.tokenCount > 0 && streaming.elapsedMs > 0 && (
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontFamily: 'monospace' }}>
                        {(streaming.tokenCount / (streaming.elapsedMs / 1000)).toFixed(0)} tok/s
                      </Typography>
                    )}
                  </Box>
                )}
                {/* Non-streaming stats */}
                {!streaming.isStreaming && responseMeta && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Clock className="w-3 h-3" />
                      {responseMeta.latencyMs}ms
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Hash className="w-3 h-3" />
                      {responseMeta.tokensUsed} tokens
                    </Typography>
                    {responseMeta.cost > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DollarSign className="w-3 h-3" />${responseMeta.cost.toFixed(4)}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Streaming progress bar */}
              {streaming.isStreaming && (
                <LinearProgress
                  variant="indeterminate"
                  sx={{
                    height: 2,
                    bgcolor: 'transparent',
                    '& .MuiLinearProgress-bar': { bgcolor: '#53e16f' },
                  }}
                />
              )}

              <Box sx={{ px: 2.5, py: 2, minHeight: 180 }}>
                {/* Streaming response — typewriter */}
                {streaming.isStreaming && (
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        fontSize: '0.875rem',
                        color: 'text.primary',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.7,
                        fontFamily: 'monospace',
                        bgcolor: '#0e0e0e',
                        borderRadius: '8px',
                        p: 2,
                        border: '1px solid', borderColor: 'divider',
                        maxHeight: 500,
                        overflowY: 'auto',
                      }}
                    >
                      {streaming.text}
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: '2px',
                          height: '1.1em',
                          bgcolor: '#53e16f',
                          ml: '1px',
                          verticalAlign: 'text-bottom',
                          animation: 'blink 0.8s step-end infinite',
                          '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
                        }}
                      />
                      <div ref={responseEndRef} />
                    </Box>
                  </Box>
                )}

                {/* Non-streaming loading */}
                {!streaming.isStreaming && isLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <CircularProgress size={32} sx={{ color: '#adc6ff' }} />
                      <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
                        Generating response...
                      </Typography>
                      <Typography variant="caption" sx={{ mt: 0.5, color: 'text.disabled', display: 'block' }}>
                        Using {selectedModel?.name || model}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Error */}
                {!isBusy && (responseError || streaming.error) && (
                  <Alert
                    severity="error"
                    icon={<AlertCircle className="w-5 h-5" />}
                    sx={{ borderRadius: '8px' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Request Failed</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{responseError || streaming.error}</Typography>
                  </Alert>
                )}

                {/* Completed response */}
                {!isBusy && response && !responseError && !streaming.error && (
                  <Box sx={{ position: 'relative', '&:hover .copy-btn': { opacity: 1 } }}>
                    <Box className="copy-btn" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s' }}>
                      <CopyButton text={response} />
                    </Box>
                    <Box
                      sx={{
                        fontSize: '0.875rem',
                        color: 'text.primary',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.7,
                        fontFamily: 'monospace',
                        bgcolor: '#0e0e0e',
                        borderRadius: '8px',
                        p: 2,
                        border: '1px solid', borderColor: 'divider',
                      }}
                    >
                      {response}
                    </Box>
                  </Box>
                )}

                {/* Empty state */}
                {!isBusy && !response && !responseError && !streaming.error && !streaming.text && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, color: 'text.disabled' }}>
                    <Terminal className="w-12 h-12 mb-1.5" style={{ color: 'text.disabled' }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>No response yet</Typography>
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                      Enter a prompt above and click Send to get started
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Footer stats */}
              {responseMeta && !streaming.isStreaming && (
                <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(37,37,37,0.5)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Model: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{responseMeta.model}</Box>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Latency: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{responseMeta.latencyMs}ms</Box>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Tokens: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{responseMeta.tokensUsed}</Box>
                    </Typography>
                    {responseMeta.cost > 0 && (
                      <>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>|</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Cost: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>${responseMeta.cost.toFixed(4)}</Box>
                        </Typography>
                      </>
                    )}
                    {streaming.completed && streaming.tokenCount > 0 && streaming.elapsedMs > 0 && (
                      <>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>|</Typography>
                        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                          {(streaming.tokenCount / (streaming.elapsedMs / 1000)).toFixed(0)} tok/s
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Request / Response History */}
            <Paper sx={paperSx}>
              <Box
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                sx={{
                  ...sectionHeaderSx,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(37,37,37,0.5)' },
                  transition: 'background-color 0.15s',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History className="w-4 h-4 text-purple-500" />
                  Request History
                  {history.length > 0 && (
                    <Chip
                      label={history.length}
                      size="small"
                      sx={{ ml: 0.5, height: 20, fontSize: '0.7rem', fontWeight: 500, bgcolor: 'rgba(139,92,246,0.1)', color: '#4b8eff' }}
                    />
                  )}
                </Typography>
                {isHistoryOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </Box>

              <Collapse in={isHistoryOpen}>
                <Box sx={{ px: 2.5, py: 2 }}>
                  {history.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                      <History className="w-10 h-10 mx-auto mb-1" style={{ color: 'text.disabled' }} />
                      <Typography variant="body2">No requests yet</Typography>
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                        Your request history will appear here (max {MAX_HISTORY} entries)
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 500, overflowY: 'auto' }}>
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
                    </Box>
                  )}

                  {history.length > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setHistory([]);
                          setExpandedHistoryId(null);
                        }}
                        startIcon={<Trash2 className="w-3 h-3" />}
                        sx={{ textTransform: 'none', color: '#ef4444', fontSize: '0.75rem', '&:hover': { color: '#dc2626', bgcolor: 'rgba(239,68,68,0.1)' } }}
                      >
                        Clear History
                      </Button>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          </Box>
        </Grid>

        {/* ============ RIGHT COLUMN ============ */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Model Selection */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Model
                </Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 2 }}>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                  }}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.875rem' }}>
                      {m.name} ({m.provider})
                    </MenuItem>
                  ))}
                </Select>
                {selectedModel && (
                  <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={selectedModel.provider}
                      size="small"
                      sx={{ height: 24, fontSize: '0.75rem', fontWeight: 500, bgcolor: 'rgba(173,198,255,0.1)', color: '#adc6ff', border: '1px solid rgba(173,198,255,0.3)' }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{selectedModel.id}</Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Parameter Controls */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Settings2 className="w-4 h-4 text-gray-500" />
                  Parameters
                </Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  onClick={() => {
                    setTemperature(0.7);
                    setMaxTokens(1024);
                    setTopP(1.0);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    borderColor: 'divider',
                    borderStyle: 'dashed',
                    borderRadius: '8px',
                    '&:hover': { borderColor: 'divider', bgcolor: 'background.default', borderStyle: 'dashed' },
                  }}
                >
                  Reset to defaults
                </Button>
              </Box>
            </Paper>

            {/* Code Examples */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Code2 className="w-4 h-4 text-indigo-500" />
                  Code Examples
                </Typography>
              </Box>

              {/* Tabs */}
              <Tabs
                value={CODE_TABS.indexOf(activeCodeTab)}
                onChange={(_, idx) => setActiveCodeTab(CODE_TABS[idx])}
                variant="fullWidth"
                sx={{
                  borderBottom: '1px solid', borderColor: 'divider',
                  minHeight: 40,
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    minHeight: 40,
                    color: 'text.secondary',
                    '&.Mui-selected': { color: '#adc6ff' },
                  },
                  '& .MuiTabs-indicator': { bgcolor: '#adc6ff' },
                }}
              >
                {CODE_TABS.map((tab) => (
                  <Tab key={tab} label={tab} />
                ))}
              </Tabs>

              {/* Code Block */}
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
                  <CopyButton text={currentSnippet} />
                </Box>
                <Box
                  component="pre"
                  sx={{
                    px: 2.5,
                    py: 2,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    bgcolor: 'text.primary',
                    color: 'divider',
                    lineHeight: 1.7,
                    maxHeight: 400,
                    m: 0,
                  }}
                >
                  <code>{currentSnippet}</code>
                </Box>
              </Box>

              <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(37,37,37,0.5)' }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Code updates dynamically based on your current settings
                </Typography>
              </Box>
            </Paper>

            {/* Quick Reference */}
            <Paper sx={paperSx}>
              <Box sx={sectionHeaderSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  API Reference
                </Typography>
              </Box>
              <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>Completions</Typography>
                  <Box
                    component="code"
                    sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem', color: '#adc6ff', bgcolor: 'rgba(173,198,255,0.1)', px: 1, py: 0.5, borderRadius: '4px' }}
                  >
                    POST /api/v1/completions
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>Streaming</Typography>
                  <Box
                    component="code"
                    sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem', color: '#adc6ff', bgcolor: 'rgba(173,198,255,0.1)', px: 1, py: 0.5, borderRadius: '4px' }}
                  >
                    POST /api/v1/completions/stream
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>List Models</Typography>
                  <Box
                    component="code"
                    sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem', color: '#adc6ff', bgcolor: 'rgba(173,198,255,0.1)', px: 1, py: 0.5, borderRadius: '4px' }}
                  >
                    GET /api/v1/models
                  </Box>
                </Box>
                <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Base URL:{' '}
                    <Box
                      component="code"
                      sx={{ color: 'text.primary', bgcolor: 'action.hover', px: 0.75, py: 0.25, borderRadius: '4px' }}
                    >
                      {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}
                    </Box>
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>}
    </Box>
  );
}
