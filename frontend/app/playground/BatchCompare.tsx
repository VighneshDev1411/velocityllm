'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import {
  Play,
  Clock,
  Zap,
  DollarSign,
  Hash,
  Trophy,
  History,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { batchAPI } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
}

interface BatchItem {
  model: string;
  provider: string;
  response: string;
  tokens: number;
  latency_ms: number;
  cost: number;
  error?: string;
  success: boolean;
}

interface BatchResult {
  id: string;
  prompt: string;
  models: string[];
  results: BatchItem[];
  total_time_ms: number;
  created_at: string;
}

interface Props {
  availableModels: AvailableModel[];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const paperSx = {
  elevation: 0,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  overflow: 'hidden',
};

const sectionHeaderSx = {
  px: 2.5,
  py: 1.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
  bgcolor: 'rgba(28,27,27,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const accentColor = '#06b6d4';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latencyColor(latency: number, min: number, max: number): string {
  if (max === min) return '#22c55e';
  const ratio = (latency - min) / (max - min);
  if (ratio < 0.33) return '#22c55e';
  if (ratio < 0.66) return '#eab308';
  return '#ef4444';
}

function providerColor(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes('openai')) return '#10a37f';
  if (p.includes('anthropic')) return '#d97706';
  if (p.includes('google')) return '#4285f4';
  if (p.includes('cohere')) return '#4b8eff';
  return '#6b7280';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BatchCompare({ availableModels }: Props) {
  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  // History
  const [history, setHistory] = useState<BatchResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    batchAPI.getHistory(20).then((res) => {
      setHistory(res.data?.data?.runs || []);
    }).catch(() => {});
  }, []);

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((m) => m !== modelId)
        : prev.length >= 6
        ? prev
        : [...prev, modelId],
    );
  };

  const runBatch = async () => {
    if (!prompt.trim() || selectedModels.length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await batchAPI.runBatch({
        prompt: prompt.trim(),
        models: selectedModels,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
      });
      const data = res.data?.data as BatchResult;
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 20));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Batch request failed');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryRun = (run: BatchResult) => {
    setResult(run);
    setPrompt(run.prompt);
    setSelectedModels(run.models);
    setShowHistory(false);
  };

  // Derived stats
  const successResults = result?.results.filter((r) => r.success) || [];
  const minLatency = successResults.length ? Math.min(...successResults.map((r) => r.latency_ms)) : 0;
  const maxLatency = successResults.length ? Math.max(...successResults.map((r) => r.latency_ms)) : 0;
  const minCost = successResults.length ? Math.min(...successResults.map((r) => r.cost)) : 0;
  const maxTokensUsed = successResults.length ? Math.max(...successResults.map((r) => r.tokens)) : 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Prompt Input */}
      <Paper sx={paperSx}>
        <Box sx={sectionHeaderSx}>
          <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart3 className="w-4 h-4" style={{ color: accentColor }} />
            Batch Prompt
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {prompt.length > 0 ? `${prompt.length} chars` : 'Same prompt, multiple models'}
          </Typography>
        </Box>
        <TextField
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt to test across multiple models..."
          multiline
          minRows={4}
          maxRows={10}
          fullWidth
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ '& .MuiInputBase-input': { px: 2.5, py: 2, fontFamily: 'monospace', fontSize: '0.875rem' } }}
        />
      </Paper>

      {/* Model Selection */}
      <Paper sx={paperSx}>
        <Box sx={sectionHeaderSx}>
          <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap className="w-4 h-4 text-yellow-500" />
            Select Models (2–6)
          </Typography>
          <Chip
            label={`${selectedModels.length} selected`}
            size="small"
            sx={{ height: 22, fontSize: '0.7rem', bgcolor: selectedModels.length >= 2 ? 'rgba(6,182,212,0.1)' : 'rgba(239,68,68,0.1)', color: selectedModels.length >= 2 ? accentColor : '#ef4444' }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {availableModels.map((m) => (
            <FormControlLabel
              key={m.id}
              control={
                <Checkbox
                  checked={selectedModels.includes(m.id)}
                  onChange={() => toggleModel(m.id)}
                  size="small"
                  sx={{ '&.Mui-checked': { color: accentColor } }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{m.name}</Typography>
                  <Chip label={m.provider} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${providerColor(m.provider)}15`, color: providerColor(m.provider) }} />
                </Box>
              }
              sx={{ mr: 2, mb: 0.5 }}
            />
          ))}
        </Box>
      </Paper>

      {/* Parameters */}
      <Paper sx={paperSx}>
        <Box sx={sectionHeaderSx}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Parameters</Typography>
        </Box>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>Temperature: {temperature}</Typography>
              <Slider value={temperature} onChange={(_, v) => setTemperature(v as number)} min={0} max={2} step={0.1} size="small" sx={{ color: accentColor }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>Max Tokens: {maxTokens}</Typography>
              <Slider value={maxTokens} onChange={(_, v) => setMaxTokens(v as number)} min={64} max={4096} step={64} size="small" sx={{ color: accentColor }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>Top P: {topP}</Typography>
              <Slider value={topP} onChange={(_, v) => setTopP(v as number)} min={0} max={1} step={0.05} size="small" sx={{ color: accentColor }} />
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Action Row */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={runBatch}
          disabled={loading || selectedModels.length < 2 || !prompt.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Play className="w-4 h-4" />}
          sx={{
            bgcolor: accentColor,
            '&:hover': { bgcolor: '#0891b2' },
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px',
            px: 3,
          }}
        >
          {loading ? 'Running...' : `Compare ${selectedModels.length} Models`}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setShowHistory(!showHistory)}
          startIcon={<History className="w-4 h-4" />}
          sx={{ textTransform: 'none', borderRadius: '8px', borderColor: 'divider', color: 'text.secondary' }}
        >
          History ({history.length})
        </Button>
      </Box>

      {error && (
        <Alert severity="error" icon={<AlertCircle className="w-4 h-4" />} sx={{ borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <Paper sx={paperSx}>
          <Box sx={sectionHeaderSx}>
            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <History className="w-4 h-4" />
              Past Runs
            </Typography>
          </Box>
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {history.map((run) => (
              <Box
                key={run.id}
                onClick={() => loadHistoryRun(run)}
                sx={{
                  px: 2.5, py: 1.5,
                  borderBottom: '1px solid', borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {run.prompt.length > 80 ? run.prompt.slice(0, 80) + '...' : run.prompt}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {run.models.length} models &middot; {run.total_time_ms}ms &middot; {new Date(run.created_at).toLocaleString()}
                  </Typography>
                </Box>
                <Chip label={`${run.models.length} models`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Bar */}
          <Paper sx={{ ...paperSx, bgcolor: 'rgba(6,182,212,0.03)' }}>
            <Box sx={{ px: 2.5, py: 2, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Clock className="w-4 h-4" style={{ color: '#6b7280' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  Total: <strong>{result.total_time_ms}ms</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Hash className="w-4 h-4" style={{ color: '#6b7280' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  Models: <strong>{result.results.length}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Zap className="w-4 h-4" style={{ color: '#22c55e' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  Fastest: <strong>{minLatency}ms</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DollarSign className="w-4 h-4" style={{ color: '#22c55e' }} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  Cheapest: <strong>${minCost.toFixed(6)}</strong>
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Comparison Bars */}
          <Paper sx={paperSx}>
            <Box sx={sectionHeaderSx}>
              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChart3 className="w-4 h-4" style={{ color: accentColor }} />
                Comparison
              </Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 2 }}>
              {/* Latency comparison */}
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block', color: 'text.secondary' }}>Latency (ms)</Typography>
              {successResults.map((item) => (
                <Box key={`lat-${item.model}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Typography variant="caption" sx={{ width: 160, fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.model}
                  </Typography>
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    <LinearProgress
                      variant="determinate"
                      value={maxLatency > 0 ? (item.latency_ms / maxLatency) * 100 : 0}
                      sx={{
                        height: 14,
                        borderRadius: 7,
                        bgcolor: 'rgba(0,0,0,0.04)',
                        '& .MuiLinearProgress-bar': { bgcolor: latencyColor(item.latency_ms, minLatency, maxLatency), borderRadius: 7 },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 50, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {item.latency_ms}ms
                  </Typography>
                  {item.latency_ms === minLatency && (
                    <Trophy className="w-3 h-3" style={{ color: '#eab308', flexShrink: 0 }} />
                  )}
                </Box>
              ))}

              {/* Token comparison */}
              <Typography variant="caption" sx={{ fontWeight: 600, mt: 2, mb: 1, display: 'block', color: 'text.secondary' }}>Tokens</Typography>
              {successResults.map((item) => (
                <Box key={`tok-${item.model}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Typography variant="caption" sx={{ width: 160, fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.model}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={maxTokensUsed > 0 ? (item.tokens / maxTokensUsed) * 100 : 0}
                      sx={{
                        height: 14,
                        borderRadius: 7,
                        bgcolor: 'rgba(0,0,0,0.04)',
                        '& .MuiLinearProgress-bar': { bgcolor: '#4b8eff', borderRadius: 7 },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 50, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {item.tokens}
                  </Typography>
                </Box>
              ))}

              {/* Cost comparison */}
              <Typography variant="caption" sx={{ fontWeight: 600, mt: 2, mb: 1, display: 'block', color: 'text.secondary' }}>Cost ($)</Typography>
              {successResults.map((item) => {
                const maxCost = Math.max(...successResults.map((r) => r.cost));
                return (
                  <Box key={`cost-${item.model}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Typography variant="caption" sx={{ width: 160, fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.model}
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={maxCost > 0 ? (item.cost / maxCost) * 100 : 0}
                        sx={{
                          height: 14,
                          borderRadius: 7,
                          bgcolor: 'rgba(0,0,0,0.04)',
                          '& .MuiLinearProgress-bar': { bgcolor: '#22c55e', borderRadius: 7 },
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 70, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      ${item.cost.toFixed(6)}
                    </Typography>
                    {item.cost === minCost && (
                      <DollarSign className="w-3 h-3" style={{ color: '#22c55e', flexShrink: 0 }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* Result Cards Grid */}
          <Grid container spacing={2}>
            {result.results.map((item, idx) => (
              <Grid key={idx} size={{ xs: 12, md: 6 }}>
                <Paper sx={{ ...paperSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Card header */}
                  <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(28,27,27,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.model}</Typography>
                      <Chip
                        label={item.provider}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${providerColor(item.provider)}15`, color: providerColor(item.provider) }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {item.success && item.latency_ms === minLatency && (
                        <Tooltip title="Fastest">
                          <Chip label="Fastest" size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 700 }} />
                        </Tooltip>
                      )}
                      {item.success && item.cost === minCost && (
                        <Tooltip title="Cheapest">
                          <Chip label="Cheapest" size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(173,198,255,0.1)', color: '#adc6ff', fontWeight: 700 }} />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Metrics row */}
                  {item.success && (
                    <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Clock className="w-3 h-3" style={{ color: latencyColor(item.latency_ms, minLatency, maxLatency) }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: latencyColor(item.latency_ms, minLatency, maxLatency) }}>
                          {item.latency_ms}ms
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Hash className="w-3 h-3" style={{ color: '#4b8eff' }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{item.tokens} tokens</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DollarSign className="w-3 h-3" style={{ color: '#22c55e' }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>${item.cost.toFixed(6)}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Response body */}
                  <Box sx={{ px: 2, py: 2, flex: 1, overflow: 'auto', maxHeight: 300 }}>
                    {item.success ? (
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: 'text.primary',
                        }}
                      >
                        {item.response}
                      </Typography>
                    ) : (
                      <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                        {item.error || 'Unknown error'}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
