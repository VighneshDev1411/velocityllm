'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import {
  GitMerge, Plus, Play, Trash2, Edit3, Save, BarChart3,
  CheckCircle, Clock, XCircle, Layers, Zap, MessageSquare,
  ArrowRight, Settings, Type, Filter, FileOutput, FileInput,
  Cpu, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { workflowAPI } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NodePosition { x: number; y: number; }

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: NodePosition;
  config: Record<string, string>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at?: string;
  duration_ms: number;
  results?: Record<string, any>;
  error?: string;
}

interface Stats {
  total_workflows: number;
  workflows_active: number;
  workflows_draft: number;
  workflows_archived: number;
  total_nodes: number;
  total_runs: number;
  runs_completed: number;
  runs_failed: number;
  runs_running: number;
  success_rate: number;
}

// ─── Node type definitions ──────────────────────────────────────────────────

const NODE_TYPES = [
  { type: 'input', label: 'Input', icon: FileInput, color: '#3b82f6' },
  { type: 'prompt', label: 'Prompt', icon: MessageSquare, color: '#8b5cf6' },
  { type: 'llm_call', label: 'LLM Call', icon: Cpu, color: '#f59e0b' },
  { type: 'condition', label: 'Condition', icon: Filter, color: '#ef4444' },
  { type: 'transform', label: 'Transform', icon: Settings, color: '#10b981' },
  { type: 'output', label: 'Output', icon: FileOutput, color: '#06b6d4' },
];

function getNodeMeta(type: string) {
  return NODE_TYPES.find((n) => n.type === type) || NODE_TYPES[0];
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        p: 2.5, borderRadius: 2,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px',
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color,
        }}>
          <Icon className="w-5 h-5" />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Status Chip ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const colorMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    active: 'success', draft: 'warning', archived: 'default',
    completed: 'success', running: 'info', pending: 'warning', failed: 'error',
  };
  return <Chip label={status} size="small" color={colorMap[status] || 'default'} variant="outlined" />;
}

// ─── Canvas Node Component ──────────────────────────────────────────────────

function CanvasNode({
  node, selected, onSelect, onDragStart,
}: {
  node: WorkflowNode;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const theme = useTheme();
  const meta = getNodeMeta(node.type);
  const Icon = meta.icon;

  return (
    <Paper
      onClick={onSelect}
      onMouseDown={onDragStart}
      elevation={selected ? 4 : 1}
      sx={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 160,
        p: 1.5,
        borderRadius: 2,
        cursor: 'grab',
        userSelect: 'none',
        border: selected ? `2px solid ${meta.color}` : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
        '&:hover': { borderColor: meta.color },
        transition: 'border-color 0.15s, box-shadow 0.15s',
        zIndex: selected ? 10 : 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: '6px', flexShrink: 0,
          background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: meta.color,
        }}>
          <Icon className="w-3.5 h-3.5" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', textTransform: 'uppercase' }}>
            {node.type.replace('_', ' ')}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Builder state
  const [builderWorkflow, setBuilderWorkflow] = useState<Workflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  // Edge drawing
  const [edgeStart, setEdgeStart] = useState<string | null>(null);

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, message, severity });

  // ── Data fetching ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [wRes, rRes, sRes] = await Promise.all([
        workflowAPI.listWorkflows(),
        workflowAPI.listRuns(),
        workflowAPI.getStats(),
      ]);
      setWorkflows(wRes.data?.data || []);
      setRuns(rRes.data?.data || []);
      setStats(sRes.data?.data || null);
    } catch {
      showSnack('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Workflow CRUD ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      const res = await workflowAPI.createWorkflow({
        name: createName, description: createDesc, nodes: [], edges: [],
      });
      showSnack('Workflow created');
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      const wf = res.data?.data;
      if (wf) {
        setBuilderWorkflow(wf);
        setTab(1);
      }
      fetchAll();
    } catch { showSnack('Failed to create workflow', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await workflowAPI.deleteWorkflow(id);
      showSnack('Workflow deleted');
      fetchAll();
    } catch { showSnack('Failed to delete', 'error'); }
  };

  const handleExecute = async (id: string) => {
    try {
      await workflowAPI.executeWorkflow(id);
      showSnack('Execution started');
      setTimeout(fetchAll, 3000);
    } catch { showSnack('Execution failed', 'error'); }
  };

  const handleSaveBuilder = async () => {
    if (!builderWorkflow) return;
    try {
      await workflowAPI.updateWorkflow({
        id: builderWorkflow.id,
        name: builderWorkflow.name,
        description: builderWorkflow.description,
        nodes: builderWorkflow.nodes,
        edges: builderWorkflow.edges,
      });
      showSnack('Workflow saved');
      fetchAll();
    } catch { showSnack('Save failed', 'error'); }
  };

  // ── Builder: add node ─────────────────────────────────────────────────

  const addNode = (type: string) => {
    if (!builderWorkflow) return;
    const meta = getNodeMeta(type);
    const id = `n${Date.now()}`;
    const newNode: WorkflowNode = {
      id,
      type,
      label: meta.label,
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      config: {},
    };
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: [...builderWorkflow.nodes, newNode],
    });
    setSelectedNode(id);
  };

  const deleteSelectedNode = () => {
    if (!builderWorkflow || !selectedNode) return;
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: builderWorkflow.nodes.filter((n) => n.id !== selectedNode),
      edges: builderWorkflow.edges.filter((e) => e.source !== selectedNode && e.target !== selectedNode),
    });
    setSelectedNode(null);
  };

  // ── Builder: drag ─────────────────────────────────────────────────────

  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    const node = builderWorkflow?.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDragInfo({ nodeId, startX: e.clientX, startY: e.clientY, origX: node.position.x, origY: node.position.y });
  };

  useEffect(() => {
    if (!dragInfo) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!builderWorkflow || !dragInfo) return;
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;
      setBuilderWorkflow((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === dragInfo.nodeId
              ? { ...n, position: { x: Math.max(0, dragInfo.origX + dx), y: Math.max(0, dragInfo.origY + dy) } }
              : n
          ),
        };
      });
    };

    const handleMouseUp = () => setDragInfo(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo]);

  // ── Builder: edge creation by double-click ────────────────────────────

  const handleNodeDoubleClick = (nodeId: string) => {
    if (!builderWorkflow) return;
    if (!edgeStart) {
      setEdgeStart(nodeId);
      showSnack('Now double-click a target node to connect');
    } else {
      if (edgeStart !== nodeId) {
        const edgeId = `e${Date.now()}`;
        setBuilderWorkflow({
          ...builderWorkflow,
          edges: [...builderWorkflow.edges, { id: edgeId, source: edgeStart, target: nodeId }],
        });
      }
      setEdgeStart(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────

  const getNodeCenter = (node: WorkflowNode) => ({
    x: node.position.x + 80,
    y: node.position.y + 25,
  });

  const getWorkflowName = (id: string) => workflows.find((w) => w.id === id)?.name || id.slice(0, 8);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ color: '#8b5cf6' }}><GitMerge className="w-7 h-7" /></Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Workflow Builder</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Create visual multi-step LLM pipelines
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New Workflow
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Workflows" icon={<Layers className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Builder" icon={<Edit3 className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Runs" icon={<Play className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Stats" icon={<BarChart3 className="w-4 h-4" />} iconPosition="start" />
      </Tabs>

      {/* ──────────── TAB 0: Workflows List ──────────── */}
      {tab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {workflows.length === 0 ? (
            <Alert severity="info">No workflows yet. Create one to get started!</Alert>
          ) : (
            workflows.map((wf) => (
              <Paper
                key={wf.id}
                sx={{
                  p: 2.5, borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>{wf.name}</Typography>
                      <StatusChip status={wf.status} />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                      {wf.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {wf.nodes?.length || 0} nodes &bull; {wf.edges?.length || 0} edges
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Updated {new Date(wf.updated_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Edit in Builder">
                      <IconButton size="small" onClick={() => { setBuilderWorkflow(wf); setTab(1); }}>
                        <Edit3 className="w-4 h-4" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Execute">
                      <IconButton size="small" color="primary" onClick={() => handleExecute(wf.id)}>
                        <Play className="w-4 h-4" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(wf.id)}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* ──────────── TAB 1: Visual Builder ──────────── */}
      {tab === 1 && (
        <Box>
          {!builderWorkflow ? (
            <Alert severity="info">
              Select a workflow from the Workflows tab or create a new one to start building.
            </Alert>
          ) : (
            <>
              {/* Builder toolbar */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{builderWorkflow.name}</Typography>
                  <StatusChip status={builderWorkflow.status} />
                  {edgeStart && (
                    <Chip
                      label="Connecting... double-click target"
                      color="warning"
                      size="small"
                      onDelete={() => setEdgeStart(null)}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedNode && (
                    <Button size="small" color="error" variant="outlined" startIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={deleteSelectedNode}>
                      Delete Node
                    </Button>
                  )}
                  <Button size="small" variant="outlined" startIcon={<Play className="w-3.5 h-3.5" />} onClick={() => handleExecute(builderWorkflow.id)}>
                    Run
                  </Button>
                  <Button size="small" variant="contained" startIcon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveBuilder}>
                    Save
                  </Button>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Node palette */}
                <Paper
                  sx={{
                    width: 170, p: 1.5, borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa',
                  }}
                >
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', mb: 1, px: 0.5 }}>
                    Add Node
                  </Typography>
                  {NODE_TYPES.map((nt) => {
                    const Icon = nt.icon;
                    return (
                      <Paper
                        key={nt.type}
                        onClick={() => addNode(nt.type)}
                        sx={{
                          p: 1, mb: 0.75, borderRadius: 1.5, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 1,
                          border: `1px solid transparent`,
                          '&:hover': { borderColor: nt.color, backgroundColor: `${nt.color}08` },
                          transition: 'all 0.15s',
                        }}
                      >
                        <Box sx={{
                          width: 24, height: 24, borderRadius: '5px', flexShrink: 0,
                          background: `${nt.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Box sx={{ color: nt.color, display: 'flex' }}><Icon className="w-3 h-3" /></Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{nt.label}</Typography>
                      </Paper>
                    );
                  })}
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', mt: 1, px: 0.5 }}>
                    Double-click a node to start connecting, then double-click the target.
                  </Typography>
                </Paper>

                {/* Canvas */}
                <Paper
                  ref={canvasRef}
                  sx={{
                    flex: 1, height: 550, borderRadius: 2, position: 'relative', overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : '#fcfcfc',
                    backgroundImage: theme.palette.mode === 'dark'
                      ? 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)'
                      : 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                  onClick={() => { setSelectedNode(null); setEdgeStart(null); }}
                >
                  {/* SVG edges */}
                  <svg
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon
                          points="0 0, 10 3.5, 0 7"
                          fill={theme.palette.mode === 'dark' ? '#888' : '#999'}
                        />
                      </marker>
                    </defs>
                    {builderWorkflow.edges.map((edge) => {
                      const srcNode = builderWorkflow.nodes.find((n) => n.id === edge.source);
                      const tgtNode = builderWorkflow.nodes.find((n) => n.id === edge.target);
                      if (!srcNode || !tgtNode) return null;
                      const src = getNodeCenter(srcNode);
                      const tgt = getNodeCenter(tgtNode);
                      const midX = (src.x + tgt.x) / 2;
                      return (
                        <path
                          key={edge.id}
                          d={`M ${src.x} ${src.y} C ${midX} ${src.y}, ${midX} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                          fill="none"
                          stroke={theme.palette.mode === 'dark' ? '#555' : '#bbb'}
                          strokeWidth={2}
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>

                  {/* Nodes */}
                  {builderWorkflow.nodes.map((node) => (
                    <Box key={node.id} onDoubleClick={(e) => { e.stopPropagation(); handleNodeDoubleClick(node.id); }}>
                      <CanvasNode
                        node={node}
                        selected={selectedNode === node.id}
                        onSelect={() => { setSelectedNode(node.id); }}
                        onDragStart={(e) => { e.stopPropagation(); handleNodeDragStart(node.id, e); }}
                      />
                    </Box>
                  ))}

                  {builderWorkflow.nodes.length === 0 && (
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <Typography sx={{ color: 'text.secondary', mb: 1 }}>
                        Click a node type from the palette to add it to the canvas
                      </Typography>
                      <Box sx={{ color: '#999', transform: 'rotate(180deg)', display: 'inline-flex' }}><ArrowRight className="w-5 h-5" /></Box>
                    </Box>
                  )}
                </Paper>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* ──────────── TAB 2: Runs ──────────── */}
      {tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {runs.length === 0 ? (
            <Alert severity="info">No runs yet. Execute a workflow to see results here.</Alert>
          ) : (
            runs.map((run) => (
              <Paper
                key={run.id}
                sx={{
                  p: 2, borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {run.status === 'completed' && <Box sx={{ color: '#10b981', display: 'flex' }}><CheckCircle className="w-4 h-4" /></Box>}
                      {run.status === 'failed' && <Box sx={{ color: '#ef4444', display: 'flex' }}><XCircle className="w-4 h-4" /></Box>}
                      {(run.status === 'running' || run.status === 'pending') && <Box sx={{ color: '#3b82f6', display: 'flex' }}><Clock className="w-4 h-4" /></Box>}
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {getWorkflowName(run.workflow_id)}
                      </Typography>
                      <StatusChip status={run.status} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Started {new Date(run.started_at).toLocaleString()}
                      {run.duration_ms > 0 && ` \u2022 ${(run.duration_ms / 1000).toFixed(1)}s`}
                    </Typography>
                    {run.error && (
                      <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>
                        Error: {run.error}
                      </Typography>
                    )}
                  </Box>
                  {run.results && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {run.results.nodes_executed} nodes &bull; {run.results.tokens_used} tokens
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Box>
      )}

      {/* ──────────── TAB 3: Stats ──────────── */}
      {tab === 3 && stats && (
        <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
            <StatCard icon={Layers} label="Total Workflows" value={stats.total_workflows} color="#8b5cf6" />
            <StatCard icon={Zap} label="Active Workflows" value={stats.workflows_active} color="#10b981" />
            <StatCard icon={Play} label="Total Runs" value={stats.total_runs} color="#3b82f6" />
            <StatCard icon={CheckCircle} label="Success Rate" value={`${stats.success_rate.toFixed(1)}%`} color="#f59e0b" />
          </Box>

          <Paper sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Run Results</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Completed', value: stats.runs_completed, color: '#10b981' },
                { name: 'Failed', value: stats.runs_failed, color: '#ef4444' },
                { name: 'Running', value: stats.runs_running, color: '#3b82f6' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {[
                    { color: '#10b981' },
                    { color: '#ef4444' },
                    { color: '#3b82f6' },
                  ].map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
      )}

      {/* ──────────── Create Dialog ──────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Workflow</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Workflow Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Description"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createName.trim()}>
            Create & Open Builder
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
