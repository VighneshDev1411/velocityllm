'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import LinearProgress from '@mui/material/LinearProgress';
import { StatusChip } from '@/components/StatusChip';
import { monoFontFamily } from '@/lib/theme';

const MODEL_COLORS = ['#adc6ff', '#53e16f', '#ffb595', '#8b5cf6', '#4b8eff'];

const mono = { fontFamily: monoFontFamily };

// ─── Normalizers (backend field names vary) ────────────────────────────────
function pick(obj: any, keys: string[], fallback: any = undefined) {
  for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  return fallback;
}

type StatusKind = 'healthy' | 'critical' | 'degraded';
function statusOf(raw: any): { label: string; kind: StatusKind } {
  const s = String(raw ?? 'success').toLowerCase();
  if (['error', 'failed', 'failure', '500', '429'].some((x) => s.includes(x)))
    return { label: 'Error', kind: 'critical' };
  if (['pending', 'timeout', 'degraded', 'warn'].some((x) => s.includes(x)))
    return { label: 'Degraded', kind: 'degraded' };
  return { label: 'Success', kind: 'healthy' };
}

function fmtCost(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return `$${n.toFixed(4)}`;
}
function fmtLatency(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return `${Math.round(n)}ms`;
}

function PanelCard({ title, children, sx }: { title: string; children: React.ReactNode; sx?: any }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: '8px', overflow: 'hidden', ...sx }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Box sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>{label}</Typography>
    </Box>
  );
}

export function RecentRequests({ data }: { data: any }) {
  const rows: any[] = Array.isArray(data) ? data : (data?.requests || data?.logs || []);
  return (
    <PanelCard title="Recent requests">
      {rows.length === 0 ? (
        <EmptyState label="No requests yet — send prompts via the Playground to populate this." />
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Model</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell align="right">Latency</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, 8).map((r, i) => {
                const id = String(pick(r, ['id', 'request_id', 'requestId', 'trace_id'], `req_${i}`));
                const model = pick(r, ['model', 'model_id', 'model_name'], '—');
                const tokens = pick(r, ['tokens', 'total_tokens', 'token_count'], null);
                const latency = pick(r, ['latency_ms', 'latency', 'duration_ms']);
                const cost = pick(r, ['cost', 'cost_usd', 'total_cost']);
                const st = statusOf(pick(r, ['status', 'state', 'status_code']));
                return (
                  <TableRow key={id + i}>
                    <TableCell sx={{ ...mono, color: 'text.secondary', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {id}
                    </TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{model}</TableCell>
                    <TableCell align="right" sx={mono}>{tokens != null ? Number(tokens).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right" sx={mono}>{fmtLatency(latency)}</TableCell>
                    <TableCell align="right" sx={mono}>{fmtCost(cost)}</TableCell>
                    <TableCell align="right"><StatusChip label={st.label} status={st.kind} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </PanelCard>
  );
}

export function ModelMix({ data }: { data: any }) {
  const raw: any[] = Array.isArray(data) ? data : (data?.models || data?.comparison || []);
  const items = raw
    .map((m) => ({
      name: pick(m, ['model', 'model_id', 'model_name', 'name'], 'unknown'),
      count: Number(pick(m, ['requests', 'request_count', 'count', 'total_requests'], 0)) || 0,
      pct: pick(m, ['percentage', 'percent', 'share']),
    }))
    .filter((m) => m.name && m.name !== 'unknown');

  const total = items.reduce((s, m) => s + m.count, 0);
  const withPct = items
    .map((m) => ({ ...m, pct: m.pct != null ? Number(m.pct) : total > 0 ? (m.count / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return (
    <PanelCard title="Model mix">
      {withPct.length === 0 ? (
        <EmptyState label="No model traffic yet." />
      ) : (
        <Box sx={{ px: 2.5, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {withPct.map((m, i) => (
            <Box key={m.name}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>{m.name}</Typography>
                <Typography sx={{ ...mono, fontSize: '0.75rem', color: 'text.secondary' }}>{m.pct.toFixed(1)}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(m.pct, 100)}
                sx={{
                  height: 8,
                  borderRadius: '4px',
                  backgroundColor: 'rgba(65,71,85,0.2)',
                  '& .MuiLinearProgress-bar': { backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length], borderRadius: '4px' },
                }}
              />
            </Box>
          ))}
        </Box>
      )}
    </PanelCard>
  );
}
