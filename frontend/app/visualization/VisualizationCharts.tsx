'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import MuiTooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { BarChart2, FileDown, Image as ImageIcon } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#adc6ff', '#4b8eff', '#53e16f', '#ffb595', '#ef4444', '#ffb595', '#adc6ff', '#84cc16'];
const PROVIDER_COLORS: Record<string, string> = {
  openai: '#53e16f',
  anthropic: '#ffb595',
  google: '#adc6ff',
  cohere: '#4b8eff',
  local: '#c1c6d7',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// --- Export utilities ---

async function exportChartAsPNG(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: null, useCORS: true });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function exportDashboardAsPDF() {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const panels = ['viz-radar', 'viz-treemap', 'viz-heatmap', 'viz-bars'];
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  for (let i = 0; i < panels.length; i++) {
    const el = document.getElementById(panels[i]);
    if (!el) continue;
    if (i > 0) pdf.addPage();
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height / canvas.width) * imgW;
    const finalH = Math.min(imgH, pageH - margin * 2);
    pdf.addImage(imgData, 'PNG', margin, margin, imgW, finalH);
  }
  pdf.save(`velocityllm-visualization-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// --- Data transformations ---

function buildRadarData(models: any[]): { metric: string; [key: string]: any }[] {
  if (!models?.length) return [];
  const metrics = [
    { key: 'speed', label: 'Speed', extract: (m: any) => m.avg_latency_ms || 0, invert: true },
    { key: 'reliability', label: 'Reliability', extract: (m: any) => parseFloat(m.success_rate || '0') },
    { key: 'efficiency', label: 'Efficiency', extract: (m: any) => {
      const cost = parseFloat(m.avg_cost_per_request?.replace?.('$', '') || m.avg_cost_per_request || '0');
      return cost;
    }, invert: true },
    { key: 'volume', label: 'Volume', extract: (m: any) => m.request_count || m.requests || 0 },
    { key: 'throughput', label: 'Throughput', extract: (m: any) => m.tokens_per_second || m.request_count || 0 },
  ];
  const topModels = models.slice(0, 5);
  return metrics.map(({ label, extract, invert }) => {
    const values = topModels.map(extract);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const row: any = { metric: label };
    topModels.forEach((m, idx) => {
      const raw = extract(m);
      let normalized = ((raw - min) / range) * 80 + 20;
      if (invert) normalized = 120 - normalized;
      row[m.model_name || m.model || `model-${idx}`] = Math.round(normalized);
    });
    return row;
  });
}

function buildTreemapData(costBreakdown: any): any[] {
  if (!costBreakdown) return [];
  const items = Array.isArray(costBreakdown) ? costBreakdown : costBreakdown?.models || costBreakdown?.breakdown || [];
  if (!items.length) return [];
  const byProvider: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const provider = item.provider || 'unknown';
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(item);
  });
  return Object.entries(byProvider).map(([provider, models]) => ({
    name: provider,
    children: models.map((m: any) => ({
      name: m.model || m.model_name || 'unknown',
      size: parseFloat(m.total_cost?.toString().replace('$', '') || m.cost || '0') || 0.01,
      provider,
    })),
  }));
}

function buildHeatmapData(timeSeries: any): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const requests = timeSeries?.requests || [];
  requests.forEach((point: any) => {
    const d = new Date(point.time || point.timestamp);
    if (isNaN(d.getTime())) return;
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour] += point.requests || point.count || 1;
  });
  return grid;
}

// --- Sub-components ---

function ChartPanel({ id, title, children, loading }: { id: string; title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <Paper id={id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChart2 style={{ width: 16, height: 16, color: '#adc6ff' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
        </Box>
        <MuiTooltip title="Export as PNG">
          <IconButton size="small" onClick={() => exportChartAsPNG(id, `velocityllm-${id}`)} sx={{ color: 'text.secondary', '&:hover': { color: '#adc6ff' } }}>
            <ImageIcon style={{ width: 16, height: 16 }} />
          </IconButton>
        </MuiTooltip>
      </Box>
      {loading ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: '#adc6ff' }} />
        </Box>
      ) : children}
    </Paper>
  );
}

function HeatmapGrid({ data }: { data: number[][] }) {
  const cellSize = 28;
  const labelW = 36;
  const labelH = 20;
  const gap = 2;
  const width = labelW + 24 * (cellSize + gap);
  const height = labelH + 7 * (cellSize + gap);
  const allValues = data.flat();
  const maxVal = Math.max(...allValues, 1);
  const getColor = (val: number) => {
    if (val === 0) return '#1c1b1b';
    const intensity = Math.min(val / maxVal, 1);
    const r = Math.round(28 + intensity * (173 - 28));
    const g = Math.round(27 + intensity * (198 - 27));
    const b = Math.round(27 + intensity * (255 - 27));
    return `rgb(${r},${g},${b})`;
  };
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={width} height={height + 10} viewBox={`0 0 ${width} ${height + 10}`}>
        {HOURS.map((h) => (
          h % 3 === 0 && (
            <text key={`h-${h}`} x={labelW + h * (cellSize + gap) + cellSize / 2} y={14} textAnchor="middle" fontSize={10} fill="#c1c6d7">
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </text>
          )
        ))}
        {DAYS.map((day, di) => (
          <g key={day}>
            <text x={0} y={labelH + di * (cellSize + gap) + cellSize / 2 + 4} fontSize={10} fill="#c1c6d7">{day}</text>
            {HOURS.map((h) => (
              <rect key={`${di}-${h}`} x={labelW + h * (cellSize + gap)} y={labelH + di * (cellSize + gap)} width={cellSize} height={cellSize} rx={4} fill={getColor(data[di]?.[h] || 0)}>
                <title>{`${day} ${h}:00 — ${data[di]?.[h] || 0} requests`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
    </Box>
  );
}

function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, provider } = props;
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={PROVIDER_COLORS[provider?.toLowerCase()] || '#c1c6d7'} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>
        {name?.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '...' : name}
      </text>
      {height > 40 && (
        <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9}>{provider}</text>
      )}
    </g>
  );
}

// --- Main component ---

interface VisualizationChartsProps {
  summary: any;
  costBreakdown: any;
  costLoading: boolean;
  summaryLoading: boolean;
  timeSeries: any;
  tsLoading: boolean;
}

export default function VisualizationCharts({ summary, costBreakdown, costLoading, summaryLoading, timeSeries, tsLoading }: VisualizationChartsProps) {
  const theme = useTheme();
  const tooltipStyle = {
    backgroundColor: '#201f1f',
    border: '1px solid rgba(65,71,85,0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#e5e2e1',
  };
  const [exporting, setExporting] = useState(false);

  const models: any[] = summary?.models || [];
  const topModels = models.slice(0, 5);
  const modelNames = topModels.map((m: any) => m.model_name || m.model || 'unknown');

  const radarData = buildRadarData(models);
  const treemapData = buildTreemapData(costBreakdown);
  const heatmapData = buildHeatmapData(timeSeries);

  const barData = topModels.map((m: any) => ({
    name: (m.model_name || m.model || 'unknown').replace(/^.*\//, ''),
    latency: m.avg_latency_ms || 0,
    cost: parseFloat(m.total_cost?.toString().replace('$', '') || '0') * 100,
    requests: m.request_count || m.requests || 0,
  }));

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try { await exportDashboardAsPDF(); } finally { setExporting(false); }
  }, []);

  return (
    <>
      {/* Export Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDown style={{ width: 16, height: 16 }} />}
          onClick={handleExportPDF}
          disabled={exporting}
          sx={{ fontSize: '0.8rem', fontWeight: 500, textTransform: 'none', borderRadius: '8px', backgroundColor: '#adc6ff', '&:hover': { backgroundColor: '#8baee0' } }}
        >
          {exporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Radar Chart */}
        <ChartPanel id="viz-radar" title="Model Comparison Radar" loading={summaryLoading}>
          {radarData.length === 0 ? (
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>No model data available for radar chart</Typography>
            </Box>
          ) : (
            <Box sx={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="rgba(65,71,85,0.2)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#c1c6d7' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11, fill: '#c1c6d7' }} />
                  {modelNames.map((name, idx) => (
                    <Radar key={name} name={name} dataKey={name} stroke={CHART_COLORS[idx % CHART_COLORS.length]} fill={CHART_COLORS[idx % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </ChartPanel>

        {/* Treemap + Bar Chart */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartPanel id="viz-treemap" title="Cost Allocation Treemap" loading={costLoading}>
              {treemapData.length === 0 ? (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>No cost data available</Typography>
                </Box>
              ) : (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} stroke="#fff" content={<CustomTreemapContent />} />
                  </ResponsiveContainer>
                </Box>
              )}
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                  <Box key={provider} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: color }} />
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'capitalize' }}>{provider}</Typography>
                  </Box>
                ))}
              </Box>
            </ChartPanel>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartPanel id="viz-bars" title="Model Performance Comparison" loading={summaryLoading}>
              {barData.length === 0 ? (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>No model data available</Typography>
                </Box>
              ) : (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="latency" name="Latency (ms)" fill="#adc6ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost" name="Cost (x100)" fill="#53e16f" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="requests" name="Requests" fill="#ffb595" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartPanel>
          </Grid>
        </Grid>

        {/* Heatmap */}
        <ChartPanel id="viz-heatmap" title="Usage Heatmap (Day x Hour)" loading={tsLoading}>
          {heatmapData.flat().every((v) => v === 0) ? (
            <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>No time-series data available for heatmap</Typography>
            </Box>
          ) : (
            <>
              <HeatmapGrid data={heatmapData} />
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Less</Typography>
                {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                  <Box key={intensity} sx={{
                    width: 14, height: 14, borderRadius: '2px',
                    backgroundColor: intensity === 0 ? '#1c1b1b' : `rgb(${Math.round(28 + intensity * (173 - 28))},${Math.round(27 + intensity * (198 - 27))},${Math.round(27 + intensity * (255 - 27))})`,
                  }} />
                ))}
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>More</Typography>
              </Box>
            </>
          )}
        </ChartPanel>
      </Box>
    </>
  );
}
