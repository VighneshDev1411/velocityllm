'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import { Search, Copy, Check, ChevronRight, BookOpen, Zap, Shield, Code2, Clock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  category: string;
  params?: Param[];
  body?: Param[];
  responseExample: string;
  examples: Record<string, string>;
}

const endpoints: Endpoint[] = [
  {
    id: 'completion',
    method: 'POST',
    path: '/api/v1/completion',
    summary: 'Create Completion',
    description: 'Submit a prompt to the router. VelocityLLM picks the best model based on cost, latency, and availability, optionally serving from cache.',
    category: 'Completions',
    body: [
      { name: 'prompt', type: 'string', required: true, description: 'The input prompt text.' },
      { name: 'model', type: 'string', required: false, description: 'Force a specific model (e.g. "gpt-4o"). Omit to let the router decide.' },
      { name: 'use_cache', type: 'boolean', required: false, description: 'Return cached response if available. Default: true.' },
      { name: 'max_tokens', type: 'integer', required: false, description: 'Maximum tokens in the response.' },
      { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature (0–2). Default: 1.' },
    ],
    responseExample: `{
  "id": "cmpl_abc123",
  "model": "gpt-4o",
  "prompt": "Explain recursion",
  "response": "Recursion is...",
  "tokens": 312,
  "latency": 148,
  "cost": 0.000187,
  "cache_hit": false,
  "provider": "openai",
  "created_at": "2025-01-15T12:00:00Z"
}`,
    examples: {
      curl: `curl -X POST https://api.velocityllm.com/api/v1/completion \\
  -H "Authorization: Bearer $VELOCITY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Explain recursion in simple terms",
    "use_cache": true
  }'`,
      python: `import velocityllm

client = velocityllm.Client(api_key="$VELOCITY_API_KEY")

response = client.complete(
    prompt="Explain recursion in simple terms",
    use_cache=True,
)
print(response.response)`,
      javascript: `import VelocityLLM from 'velocityllm';

const client = new VelocityLLM({ apiKey: process.env.VELOCITY_API_KEY });

const res = await client.complete({
  prompt: 'Explain recursion in simple terms',
  useCache: true,
});
console.log(res.response);`,
      go: `package main

import (
  "fmt"
  velocity "github.com/velocityllm/go-client"
)

func main() {
  client := velocity.New(os.Getenv("VELOCITY_API_KEY"))
  res, _ := client.Complete(velocity.CompletionRequest{
    Prompt:   "Explain recursion in simple terms",
    UseCache: true,
  })
  fmt.Println(res.Response)
}`,
    },
  },
  {
    id: 'models',
    method: 'GET',
    path: '/api/v1/models',
    summary: 'List Models',
    description: 'Returns all available LLM models registered with the router, including provider, cost-per-token, and current health status.',
    category: 'Models',
    responseExample: `{
  "data": {
    "models": [
      {
        "id": "gpt-4o",
        "name": "gpt-4o",
        "provider": "openai",
        "cost_per_token": 0.000005,
        "is_healthy": true,
        "avg_latency_ms": 142
      },
      {
        "id": "claude-3-5-sonnet",
        "name": "claude-3-5-sonnet-20241022",
        "provider": "anthropic",
        "cost_per_token": 0.000003,
        "is_healthy": true,
        "avg_latency_ms": 118
      }
    ],
    "total": 6
  }
}`,
    examples: {
      curl: `curl https://api.velocityllm.com/api/v1/models \\
  -H "Authorization: Bearer $VELOCITY_API_KEY"`,
      python: `models = client.models.list()
for m in models:
    print(m.name, m.provider, m.cost_per_token)`,
      javascript: `const { data } = await client.models.list();
data.models.forEach(m => console.log(m.name, m.provider));`,
      go: `models, _ := client.Models.List()
for _, m := range models {
  fmt.Println(m.Name, m.Provider)
}`,
    },
  },
  {
    id: 'analytics-summary',
    method: 'GET',
    path: '/api/v1/analytics/summary',
    summary: 'Analytics Summary',
    description: 'High-level aggregate metrics: total requests, tokens, cost, latency percentiles, cache hit rate, and per-model breakdown.',
    category: 'Analytics',
    params: [
      { name: 'period', type: 'string', required: false, description: 'One of: 1h, 6h, 24h, 7d. Default: 24h.' },
    ],
    responseExample: `{
  "total_requests": 14832,
  "total_tokens": 4821043,
  "total_cost": 28.74,
  "avg_latency_ms": 136,
  "p99_latency_ms": 512,
  "cache_hit_rate": 34.2,
  "requests_per_second": 2.1,
  "models": [...]
}`,
    examples: {
      curl: `curl "https://api.velocityllm.com/api/v1/analytics/summary?period=24h" \\
  -H "Authorization: Bearer $VELOCITY_API_KEY"`,
      python: `summary = client.analytics.summary(period="24h")
print(f"Requests: {summary.total_requests}")
print(f"Cost: \${summary.total_cost:.2f}")`,
      javascript: `const summary = await client.analytics.summary({ period: '24h' });
console.log('Cache hit rate:', summary.cacheHitRate);`,
      go: `summary, _ := client.Analytics.Summary("24h")
fmt.Printf("Requests: %d\\n", summary.TotalRequests)`,
    },
  },
  {
    id: 'analytics-timeseries',
    method: 'GET',
    path: '/api/v1/analytics/timeseries',
    summary: 'Time-Series Metrics',
    description: 'Bucketed request metrics (count, latency percentiles, cost, errors) over time. Ideal for charting.',
    category: 'Analytics',
    params: [
      { name: 'period', type: 'string', required: false, description: '1h | 6h | 24h | 7d (default: 24h)' },
    ],
    responseExample: `{
  "period": "24h",
  "points": 24,
  "requests": [142, 198, 231, ...],
  "latency": [128, 134, 141, ...],
  "cost": [0.84, 1.17, 1.36, ...],
  "errors": [0, 1, 0, ...]
}`,
    examples: {
      curl: `curl "https://api.velocityllm.com/api/v1/analytics/timeseries?period=7d" \\
  -H "Authorization: Bearer $VELOCITY_API_KEY"`,
      python: `ts = client.analytics.timeseries(period="7d")
for i, bucket in enumerate(ts.requests):
    print(f"Hour {i}: {bucket} requests")`,
      javascript: `const ts = await client.analytics.timeseries({ period: '7d' });
ts.requests.forEach((count, i) => console.log(\`Bucket \${i}: \${count}\`));`,
      go: `ts, _ := client.Analytics.Timeseries("7d")
fmt.Printf("%d data points\\n", ts.Points)`,
    },
  },
  {
    id: 'workers',
    method: 'GET',
    path: '/api/v1/workers',
    summary: 'List Workers',
    description: 'Returns status, health score, and job count for every active worker in the pool.',
    category: 'Workers',
    responseExample: `{
  "workers": [
    {
      "id": "worker-0",
      "status": "idle",
      "health_score": 100,
      "jobs_handled": 4821,
      "uptime": "2h14m"
    }
  ],
  "total": 10,
  "healthy": 10
}`,
    examples: {
      curl: `curl https://api.velocityllm.com/api/v1/workers \\
  -H "Authorization: Bearer $VELOCITY_API_KEY"`,
      python: `workers = client.workers.list()
for w in workers:
    print(w.id, w.status, w.health_score)`,
      javascript: `const { workers } = await client.workers.list();
workers.forEach(w => console.log(w.id, w.status));`,
      go: `workers, _ := client.Workers.List()
for _, w := range workers {
  fmt.Println(w.ID, w.Status)
}`,
    },
  },
  {
    id: 'keys-create',
    method: 'POST',
    path: '/api/v1/keys',
    summary: 'Create API Key',
    description: 'Creates a new scoped API key. The raw key is returned only once — store it securely.',
    category: 'API Keys',
    body: [
      { name: 'name', type: 'string', required: true, description: 'Human-readable label for this key.' },
      { name: 'scopes', type: 'string[]', required: false, description: 'Permissions: completions, analytics, admin. Default: [completions].' },
      { name: 'expires_at', type: 'string', required: false, description: 'ISO-8601 expiry datetime. Omit for non-expiring key.' },
    ],
    responseExample: `{
  "id": "key_xyz789",
  "name": "Production Key",
  "key": "vel_sk_prod_...",
  "scopes": ["completions", "analytics"],
  "created_at": "2025-01-15T12:00:00Z"
}`,
    examples: {
      curl: `curl -X POST https://api.velocityllm.com/api/v1/keys \\
  -H "Authorization: Bearer $VELOCITY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production Key",
    "scopes": ["completions", "analytics"]
  }'`,
      python: `key = client.keys.create(
    name="Production Key",
    scopes=["completions", "analytics"],
)
print("Save this key:", key.key)`,
      javascript: `const key = await client.keys.create({
  name: 'Production Key',
  scopes: ['completions', 'analytics'],
});
console.log('Save:', key.key);`,
      go: `key, _ := client.Keys.Create(velocity.CreateKeyRequest{
  Name:   "Production Key",
  Scopes: []string{"completions", "analytics"},
})
fmt.Println("Save:", key.Key)`,
    },
  },
];

const changelog = [
  { version: 'v1.4.0', date: '2025-01-10', note: 'Added DB-backed time-series analytics with percentile bucketing.' },
  { version: 'v1.3.0', date: '2024-12-20', note: 'Streaming completions via SSE. Worker pool autoscaling.' },
  { version: 'v1.2.0', date: '2024-11-30', note: 'Webhook delivery with HMAC-SHA256 signatures.' },
  { version: 'v1.1.0', date: '2024-11-01', note: 'Multi-provider routing (OpenAI, Anthropic, Mistral, Groq).' },
  { version: 'v1.0.0', date: '2024-10-01', note: 'Initial release: completions API, caching, rate limiting.' },
];

const bestPractices = [
  { icon: <Shield className="w-5 h-5" />, title: 'Rotate Keys Regularly', body: 'Create scoped keys per service and rotate them every 90 days. Revoke keys immediately if compromised.' },
  { icon: <Zap className="w-5 h-5" />, title: 'Enable Caching', body: 'Set use_cache: true to serve repeated prompts from cache. This cuts cost by up to 40% on repetitive workloads.' },
  { icon: <Clock className="w-5 h-5" />, title: 'Handle Rate Limits', body: 'Implement exponential backoff on 429 responses. Use the Retry-After header to know when to retry.' },
  { icon: <Code2 className="w-5 h-5" />, title: 'Stream Long Outputs', body: 'For prompts that generate >500 tokens, use the streaming endpoint to begin rendering output immediately.' },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};

const categories = ['All', ...Array.from(new Set(endpoints.map(e => e.category)))];
const codeLanguages = ['curl', 'python', 'javascript', 'go'];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      size="small"
      variant="text"
      onClick={copy}
      sx={{ minWidth: 0, px: 1, py: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}
      startIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <Box
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: '4px',
        backgroundColor: METHOD_COLORS[method] + '22',
        color: METHOD_COLORS[method],
        fontWeight: 700,
        fontSize: '0.7rem',
        letterSpacing: '0.05em',
        minWidth: 48,
        textAlign: 'center',
      }}
    >
      {method}
    </Box>
  );
}

function EndpointDetail({ endpoint }: { endpoint: Endpoint }) {
  const [lang, setLang] = useState('curl');

  const allParams = [
    ...(endpoint.params || []).map(p => ({ ...p, in: 'query' })),
    ...(endpoint.body || []).map(p => ({ ...p, in: 'body' })),
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <MethodBadge method={endpoint.method} />
        <Typography
          sx={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600, color: 'text.primary' }}
        >
          {endpoint.path}
        </Typography>
      </Box>

      <Typography sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.7 }}>
        {endpoint.description}
      </Typography>

      {/* Parameters */}
      {allParams.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Parameters
          </Typography>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {allParams.map((p, i) => (
              <Box
                key={p.name}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'flex-start',
                  borderBottom: i < allParams.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                    {p.name}
                  </Typography>
                  {p.required && (
                    <Chip label="required" size="small" color="error" sx={{ fontSize: '0.65rem', height: 18 }} />
                  )}
                </Box>
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'primary.main', mr: 1 }}>
                  {p.type}
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', flex: 1 }}>
                  {p.description}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Code examples */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Example Request</Typography>
          <CopyButton text={endpoint.examples[lang]} />
        </Box>
        <Tabs
          value={lang}
          onChange={(_, v) => setLang(v)}
          sx={{ mb: 0, '& .MuiTab-root': { minWidth: 80, py: 0.5, fontSize: '0.8rem' } }}
        >
          {codeLanguages.map(l => <Tab key={l} label={l} value={l} />)}
        </Tabs>
        <Paper
          sx={{
            backgroundColor: '#0f172a',
            borderRadius: '0 0 8px 8px',
            p: 2,
            overflow: 'auto',
          }}
        >
          <Typography
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#e2e8f0',
              m: 0,
              whiteSpace: 'pre',
            }}
          >
            {endpoint.examples[lang]}
          </Typography>
        </Paper>
      </Box>

      {/* Response */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Example Response</Typography>
          <CopyButton text={endpoint.responseExample} />
        </Box>
        <Paper sx={{ backgroundColor: '#0f172a', borderRadius: 2, p: 2, overflow: 'auto' }}>
          <Typography
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#e2e8f0',
              m: 0,
              whiteSpace: 'pre',
            }}
          >
            {endpoint.responseExample}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState(endpoints[0].id);
  const [mainTab, setMainTab] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return endpoints.filter(e => {
      const matchCat = category === 'All' || e.category === category;
      const matchSearch = !q || e.path.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const selected = endpoints.find(e => e.id === selectedId) ?? endpoints[0];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <BookOpen className="w-6 h-6" style={{ color: '#3b82f6' }} />
          <Typography variant="h4">API Documentation</Typography>
        </Box>
        <Typography color="text.secondary">
          Interactive reference for the VelocityLLM REST API — v1.4.0
        </Typography>
      </Box>

      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 3 }}>
        <Tab label="Endpoint Reference" />
        <Tab label="Best Practices" />
        <Tab label="Changelog" />
      </Tabs>

      {/* ── Endpoint Reference ── */}
      {mainTab === 0 && (
        <Grid container spacing={2} sx={{ minHeight: 600 }}>
          {/* Left: endpoint list */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Card sx={{ position: { md: 'sticky' }, top: 80 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <TextField
                  placeholder="Search endpoints…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mb: 1.5 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search className="w-4 h-4" />
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Category filters */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                  {categories.map(cat => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="small"
                      onClick={() => setCategory(cat)}
                      color={category === cat ? 'primary' : 'default'}
                      sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>

                <Divider sx={{ mb: 1 }} />

                <List dense disablePadding>
                  {filtered.map(ep => (
                    <ListItemButton
                      key={ep.id}
                      selected={ep.id === selectedId}
                      onClick={() => setSelectedId(ep.id)}
                      sx={{ borderRadius: 1.5, mb: 0.5, px: 1 }}
                    >
                      <Box sx={{ mr: 1, flexShrink: 0 }}>
                        <MethodBadge method={ep.method} />
                      </Box>
                      <ListItemText
                        primary={ep.summary}
                        secondary={ep.path}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.72rem', fontFamily: 'monospace' }}
                      />
                      <ChevronRight className="w-3.5 h-3.5" style={{ flexShrink: 0, opacity: 0.4 }} />
                    </ListItemButton>
                  ))}
                  {filtered.length === 0 && (
                    <Typography sx={{ py: 2, textAlign: 'center', color: 'text.secondary', fontSize: '0.85rem' }}>
                      No endpoints match
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Right: endpoint detail */}
          <Grid size={{ xs: 12, md: 9 }}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <EndpointDetail key={selected.id} endpoint={selected} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Best Practices ── */}
      {mainTab === 1 && (
        <Grid container spacing={2}>
          {bestPractices.map(bp => (
            <Grid size={{ xs: 12, sm: 6 }} key={bp.title}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, color: 'primary.main' }}>
                    {bp.icon}
                    <Typography variant="h6">{bp.title}</Typography>
                  </Box>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>{bp.body}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {/* Authentication section */}
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Authentication</Typography>
                <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                  All API requests require a Bearer token in the <code>Authorization</code> header.
                  Create scoped keys on the API Keys page. Never expose keys client-side.
                </Typography>
                <Paper sx={{ backgroundColor: '#0f172a', borderRadius: 2, p: 2 }}>
                  <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#e2e8f0', m: 0 }}>
                    {`Authorization: Bearer vel_sk_prod_xxxxxxxxxxxxxxxxxxxx`}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Rate limiting section */}
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Rate Limiting</Typography>
                <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                  Rate limits are enforced per API key. When exceeded, the server returns{' '}
                  <code>429 Too Many Requests</code> with a <code>Retry-After</code> header
                  indicating when you can retry.
                </Typography>
                <Paper sx={{ backgroundColor: '#0f172a', borderRadius: 2, p: 2 }}>
                  <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#e2e8f0', m: 0 }}>
                    {`HTTP/1.1 429 Too Many Requests
Retry-After: 12
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705320072`}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Changelog ── */}
      {mainTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Changelog</Typography>
            {changelog.map((entry, i) => (
              <Box key={entry.version}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 2 }}>
                  <Chip label={entry.version} color="primary" size="small" sx={{ fontWeight: 700, mt: 0.25 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{entry.note}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{entry.date}</Typography>
                  </Box>
                </Box>
                {i < changelog.length - 1 && <Divider />}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
