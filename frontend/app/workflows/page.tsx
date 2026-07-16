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
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import {
  GitMerge, Plus, Play, Trash2, Edit3, Save, BarChart3,
  CheckCircle, Clock, XCircle, Layers, Zap, MessageSquare,
  Settings, Filter, FileOutput, FileInput,
  Cpu, X, Link2, Copy, Pencil,
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
  { type: 'input',     label: 'Input',     icon: FileInput,    color: '#adc6ff', desc: 'Accepts user input or data feed',                configFields: ['variable_name', 'default_value', 'input_type'] },
  { type: 'prompt',    label: 'Prompt',    icon: MessageSquare, color: '#4b8eff', desc: 'Template with variable interpolation',           configFields: ['template', 'system_prompt'] },
  { type: 'llm_call',  label: 'LLM Call',  icon: Cpu,          color: '#ffb595', desc: 'Send prompt to an LLM provider',                 configFields: ['model', 'temperature', 'max_tokens', 'top_p'] },
  { type: 'condition', label: 'Condition', icon: Filter,       color: '#ef4444', desc: 'Branch based on a condition',                    configFields: ['condition_expr', 'true_label', 'false_label'] },
  { type: 'transform', label: 'Transform', icon: Settings,     color: '#53e16f', desc: 'Parse, extract, or transform data',              configFields: ['transform_type', 'expression', 'output_key'] },
  { type: 'output',    label: 'Output',    icon: FileOutput,   color: '#06b6d4', desc: 'Final output or webhook delivery',               configFields: ['output_format', 'destination'] },
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
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '8px',
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

const PORT_RADIUS = 6;

function CanvasNode({
  node, selected, connecting, isEdgeSource, onSelect, onDragStart, onPortClick, hasInput, hasOutput,
}: {
  node: WorkflowNode;
  selected: boolean;
  connecting: boolean;
  isEdgeSource: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onPortClick: (nodeId: string, port: 'input' | 'output') => void;
  hasInput: boolean;
  hasOutput: boolean;
}) {
  const theme = useTheme();
  const meta = getNodeMeta(node.type);
  const Icon = meta.icon;
  const showOutputPort = node.type !== 'output';
  const showInputPort = node.type !== 'input';

  return (
    <Paper
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      elevation={selected ? 4 : 1}
      sx={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 180,
        p: 1.5,
        borderRadius: 2,
        cursor: 'grab',
        userSelect: 'none',
        border: selected ? `2px solid ${meta.color}` : isEdgeSource ? `2px dashed ${meta.color}` : `1px solid ${theme.palette.divider}`,
        backgroundColor: selected ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        '&:hover': { borderColor: meta.color, backgroundColor: 'rgba(255,255,255,0.06)' },
        transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
        zIndex: selected ? 10 : 1,
      }}
    >
      {/* Input Port */}
      {showInputPort && (
        <Tooltip title={connecting ? 'Click to connect here' : 'Input'} placement="left">
          <Box
            onClick={(e) => { e.stopPropagation(); onPortClick(node.id, 'input'); }}
            sx={{
              position: 'absolute', left: -PORT_RADIUS, top: '50%', transform: 'translateY(-50%)',
              width: PORT_RADIUS * 2, height: PORT_RADIUS * 2, borderRadius: '50%',
              backgroundColor: hasInput ? meta.color : '#2a2a2a',
              border: `2px solid ${hasInput ? meta.color : '#555'}`,
              cursor: connecting ? 'crosshair' : 'pointer',
              transition: 'all 0.15s',
              '&:hover': { backgroundColor: meta.color, transform: 'translateY(-50%) scale(1.3)' },
              zIndex: 20,
            }}
          />
        </Tooltip>
      )}

      {/* Output Port */}
      {showOutputPort && (
        <Tooltip title={connecting ? 'Source selected — click target input' : 'Click to start connection'} placement="right">
          <Box
            onClick={(e) => { e.stopPropagation(); onPortClick(node.id, 'output'); }}
            sx={{
              position: 'absolute', right: -PORT_RADIUS, top: '50%', transform: 'translateY(-50%)',
              width: PORT_RADIUS * 2, height: PORT_RADIUS * 2, borderRadius: '50%',
              backgroundColor: hasOutput ? meta.color : '#2a2a2a',
              border: `2px solid ${hasOutput ? meta.color : '#555'}`,
              cursor: 'crosshair',
              transition: 'all 0.15s',
              '&:hover': { backgroundColor: meta.color, transform: 'translateY(-50%) scale(1.3)' },
              zIndex: 20,
            }}
          />
        </Tooltip>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: '6px', flexShrink: 0,
          background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: meta.color,
        }}>
          <Icon className="w-4 h-4" />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            {node.type.replace('_', ' ')}
          </Typography>
        </Box>
      </Box>

      {/* Config indicator */}
      {Object.keys(node.config).length > 0 && (
        <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid rgba(65,71,85,0.15)' }}>
          <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
            {Object.keys(node.config).length} param{Object.keys(node.config).length !== 1 ? 's' : ''} configured
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// ─── Node Config Panel ──────────────────────────────────────────────────────

function NodeConfigPanel({
  node, onUpdate, onDelete, onDuplicate, onClose,
}: {
  node: WorkflowNode;
  onUpdate: (node: WorkflowNode) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const meta = getNodeMeta(node.type);
  const Icon = meta.icon;
  const [label, setLabel] = useState(node.label);
  const [config, setConfig] = useState<Record<string, string>>({ ...node.config });

  useEffect(() => {
    setLabel(node.label);
    setConfig({ ...node.config });
  }, [node.id]);

  const handleSave = () => {
    onUpdate({ ...node, label, config });
  };

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const renderConfigField = (field: string) => {
    switch (field) {
      case 'model':
        return (
          <FormControl fullWidth size="small" key={field}>
            <InputLabel>Model</InputLabel>
            <Select value={config.model || ''} label="Model" onChange={(e) => updateConfig('model', e.target.value)}>
              <MenuItem value="gpt-4o">GPT-4o</MenuItem>
              <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
              <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet</MenuItem>
              <MenuItem value="claude-haiku-4-5-20251001">Claude Haiku</MenuItem>
              <MenuItem value="gemini-1.5-pro">Gemini 1.5 Pro</MenuItem>
            </Select>
          </FormControl>
        );
      case 'temperature':
        return (
          <Box key={field}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
              Temperature: {config.temperature || '0.7'}
            </Typography>
            <Slider
              size="small"
              value={parseFloat(config.temperature || '0.7')}
              min={0} max={2} step={0.1}
              onChange={(_, v) => updateConfig('temperature', String(v))}
              sx={{ color: meta.color }}
            />
          </Box>
        );
      case 'max_tokens':
        return (
          <TextField
            key={field} label="Max Tokens" size="small" fullWidth type="number"
            value={config.max_tokens || ''} onChange={(e) => updateConfig('max_tokens', e.target.value)}
          />
        );
      case 'top_p':
        return (
          <Box key={field}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
              Top P: {config.top_p || '1.0'}
            </Typography>
            <Slider
              size="small"
              value={parseFloat(config.top_p || '1.0')}
              min={0} max={1} step={0.05}
              onChange={(_, v) => updateConfig('top_p', String(v))}
              sx={{ color: meta.color }}
            />
          </Box>
        );
      case 'template':
      case 'system_prompt':
        return (
          <TextField
            key={field}
            label={field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            size="small" fullWidth multiline rows={3}
            value={config[field] || ''}
            onChange={(e) => updateConfig(field, e.target.value)}
            sx={{ '& textarea': { fontFamily: 'var(--font-mono)', fontSize: '0.8rem' } }}
          />
        );
      case 'condition_expr':
      case 'expression':
        return (
          <TextField
            key={field}
            label={field === 'condition_expr' ? 'Condition Expression' : 'Expression'}
            size="small" fullWidth multiline rows={2}
            value={config[field] || ''}
            onChange={(e) => updateConfig(field, e.target.value)}
            sx={{ '& textarea': { fontFamily: 'var(--font-mono)', fontSize: '0.8rem' } }}
            placeholder={field === 'condition_expr' ? 'e.g. output.score > 0.8' : 'e.g. JSON.parse(input)'}
          />
        );
      case 'input_type':
        return (
          <FormControl fullWidth size="small" key={field}>
            <InputLabel>Input Type</InputLabel>
            <Select value={config.input_type || 'text'} label="Input Type" onChange={(e) => updateConfig('input_type', e.target.value)}>
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="file">File Upload</MenuItem>
              <MenuItem value="url">URL</MenuItem>
            </Select>
          </FormControl>
        );
      case 'transform_type':
        return (
          <FormControl fullWidth size="small" key={field}>
            <InputLabel>Transform Type</InputLabel>
            <Select value={config.transform_type || ''} label="Transform Type" onChange={(e) => updateConfig('transform_type', e.target.value)}>
              <MenuItem value="json_parse">JSON Parse</MenuItem>
              <MenuItem value="json_extract">JSON Extract (jq)</MenuItem>
              <MenuItem value="regex">Regex Extract</MenuItem>
              <MenuItem value="template">Template</MenuItem>
              <MenuItem value="concat">Concatenate</MenuItem>
            </Select>
          </FormControl>
        );
      case 'output_format':
        return (
          <FormControl fullWidth size="small" key={field}>
            <InputLabel>Output Format</InputLabel>
            <Select value={config.output_format || 'text'} label="Output Format" onChange={(e) => updateConfig('output_format', e.target.value)}>
              <MenuItem value="text">Plain Text</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="markdown">Markdown</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
            </Select>
          </FormControl>
        );
      default:
        return (
          <TextField
            key={field}
            label={field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            size="small" fullWidth
            value={config[field] || ''}
            onChange={(e) => updateConfig(field, e.target.value)}
          />
        );
    }
  };

  return (
    <Paper sx={{
      width: 280, p: 0, borderRadius: 2,
      border: '1px solid rgba(65,71,85,0.15)',
      backgroundColor: '#1c1b1b',
      display: 'flex', flexDirection: 'column',
      maxHeight: 550, overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(65,71,85,0.15)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: '6px', flexShrink: 0,
          background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color,
        }}>
          <Icon className="w-3.5 h-3.5" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
            {node.type.replace('_', ' ')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <X className="w-3.5 h-3.5" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ p: 2, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Node Label" size="small" fullWidth
          value={label} onChange={(e) => setLabel(e.target.value)}
        />

        <Divider sx={{ borderColor: 'rgba(65,71,85,0.15)' }} />

        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
          Configuration
        </Typography>

        {meta.configFields.map((f) => renderConfigField(f))}
      </Box>

      {/* Actions */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(65,71,85,0.15)', display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={handleSave} fullWidth startIcon={<Save className="w-3.5 h-3.5" />}>
          Apply
        </Button>
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></IconButton>
        </Tooltip>
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameDesc, setRenameDesc] = useState('');

  // Edge drawing — port-based
  const [edgeSource, setEdgeSource] = useState<string | null>(null);

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
      if (builderWorkflow?.id === id) setBuilderWorkflow(null);
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

  const handleRename = () => {
    if (!builderWorkflow || !renameName.trim()) return;
    setBuilderWorkflow({ ...builderWorkflow, name: renameName, description: renameDesc });
    setRenameOpen(false);
    showSnack('Name updated — click Save to persist');
  };

  // ── Builder: add / delete / duplicate node ──────────────────────────────

  const addNode = (type: string) => {
    if (!builderWorkflow) return;
    const meta = getNodeMeta(type);
    const id = `n${Date.now()}`;
    const existingCount = builderWorkflow.nodes.filter((n) => n.type === type).length;
    const newNode: WorkflowNode = {
      id,
      type,
      label: existingCount > 0 ? `${meta.label} ${existingCount + 1}` : meta.label,
      position: { x: 120 + Math.random() * 350, y: 80 + Math.random() * 350 },
      config: {},
    };
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: [...builderWorkflow.nodes, newNode],
    });
    setSelectedNode(id);
  };

  const deleteNode = (nodeId: string) => {
    if (!builderWorkflow) return;
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: builderWorkflow.nodes.filter((n) => n.id !== nodeId),
      edges: builderWorkflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    if (selectedNode === nodeId) setSelectedNode(null);
    if (edgeSource === nodeId) setEdgeSource(null);
  };

  const duplicateNode = (nodeId: string) => {
    if (!builderWorkflow) return;
    const original = builderWorkflow.nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const id = `n${Date.now()}`;
    const newNode: WorkflowNode = {
      ...original,
      id,
      label: `${original.label} (copy)`,
      position: { x: original.position.x + 30, y: original.position.y + 30 },
      config: { ...original.config },
    };
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: [...builderWorkflow.nodes, newNode],
    });
    setSelectedNode(id);
  };

  const updateNode = (updatedNode: WorkflowNode) => {
    if (!builderWorkflow) return;
    setBuilderWorkflow({
      ...builderWorkflow,
      nodes: builderWorkflow.nodes.map((n) => n.id === updatedNode.id ? updatedNode : n),
    });
  };

  const deleteEdge = (edgeId: string) => {
    if (!builderWorkflow) return;
    setBuilderWorkflow({
      ...builderWorkflow,
      edges: builderWorkflow.edges.filter((e) => e.id !== edgeId),
    });
  };

  // ── Builder: drag ─────────────────────────────────────────────────────

  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    if (edgeSource) return; // Don't drag while connecting
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

  // ── Builder: edge creation via port click ─────────────────────────────

  const handlePortClick = (nodeId: string, port: 'input' | 'output') => {
    if (!builderWorkflow) return;

    if (port === 'output') {
      // Start a new edge from this output
      setEdgeSource(nodeId);
      showSnack('Now click an input port on the target node', 'success');
    } else if (port === 'input' && edgeSource) {
      // Complete the edge
      if (edgeSource === nodeId) {
        setEdgeSource(null);
        return; // Can't connect to self
      }
      // Check for duplicate
      const exists = builderWorkflow.edges.some(
        (e) => e.source === edgeSource && e.target === nodeId
      );
      if (!exists) {
        const edgeId = `e${Date.now()}`;
        setBuilderWorkflow({
          ...builderWorkflow,
          edges: [...builderWorkflow.edges, { id: edgeId, source: edgeSource, target: nodeId }],
        });
        showSnack('Connected!');
      }
      setEdgeSource(null);
    }
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!builderWorkflow || tab !== 1) return;
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        e.preventDefault();
        deleteNode(selectedNode);
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setEdgeSource(null);
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedNode) {
        e.preventDefault();
        duplicateNode(selectedNode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [builderWorkflow, tab, selectedNode]);

  // ── Helpers ───────────────────────────────────────────────────────────

  const getNodeOutputPort = (node: WorkflowNode) => ({
    x: node.position.x + 180,
    y: node.position.y + 25,
  });

  const getNodeInputPort = (node: WorkflowNode) => ({
    x: node.position.x,
    y: node.position.y + 25,
  });

  const getWorkflowName = (id: string) => workflows.find((w) => w.id === id)?.name || id.slice(0, 8);

  const selectedNodeObj = builderWorkflow?.nodes.find((n) => n.id === selectedNode) || null;

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
          <Box sx={{ color: '#4b8eff' }}><GitMerge className="w-7 h-7" /></Box>
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
                  backgroundColor: 'rgba(255,255,255,0.02)',
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '1.05rem' }}>{builderWorkflow.name}</Typography>
                  <Tooltip title="Rename workflow">
                    <IconButton size="small" onClick={() => { setRenameName(builderWorkflow.name); setRenameDesc(builderWorkflow.description); setRenameOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </IconButton>
                  </Tooltip>
                  <StatusChip status={builderWorkflow.status} />
                  {edgeSource && (
                    <Chip
                      label="Connecting… click an input port"
                      color="warning"
                      size="small"
                      onDelete={() => setEdgeSource(null)}
                      icon={<Link2 className="w-3 h-3" />}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
                    {builderWorkflow.nodes.length}N &bull; {builderWorkflow.edges.length}E
                  </Typography>
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
                    width: 180, p: 1.5, borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: '#1c1b1b',
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', mb: 1.5, px: 0.5, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
                    Add Node
                  </Typography>
                  {NODE_TYPES.map((nt) => {
                    const NtIcon = nt.icon;
                    return (
                      <Tooltip key={nt.type} title={nt.desc} placement="right" arrow>
                        <Paper
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
                            width: 26, height: 26, borderRadius: '5px', flexShrink: 0,
                            background: `${nt.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Box sx={{ color: nt.color, display: 'flex' }}><NtIcon className="w-3 h-3" /></Box>
                          </Box>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{nt.label}</Typography>
                        </Paper>
                      </Tooltip>
                    );
                  })}

                  <Divider sx={{ my: 1.5, borderColor: 'rgba(65,71,85,0.15)' }} />

                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', mb: 1, px: 0.5, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
                    Shortcuts
                  </Typography>
                  <Box sx={{ px: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {[
                      { key: 'Del', desc: 'Delete node' },
                      { key: 'Esc', desc: 'Deselect / cancel' },
                      { key: '⌘D', desc: 'Duplicate node' },
                    ].map((s) => (
                      <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                          backgroundColor: 'rgba(255,255,255,0.06)', color: 'text.secondary', fontWeight: 600,
                        }}>
                          {s.key}
                        </Box>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{s.desc}</Typography>
                      </Box>
                    ))}
                  </Box>

                  <Divider sx={{ my: 1.5, borderColor: 'rgba(65,71,85,0.15)' }} />

                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', px: 0.5, lineHeight: 1.5 }}>
                    Click an <strong>output port</strong> (right circle) then click an <strong>input port</strong> (left circle) to connect nodes.
                  </Typography>
                </Paper>

                {/* Canvas */}
                <Paper
                  ref={canvasRef}
                  sx={{
                    flex: 1, height: 550, borderRadius: 2, position: 'relative', overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: '#1c1b1b',
                    backgroundImage: 'radial-gradient(circle, #2a2a2a 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                  onClick={() => { setSelectedNode(null); setEdgeSource(null); }}
                >
                  {/* SVG edges */}
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#adc6ff" fillOpacity={0.6} />
                      </marker>
                    </defs>
                    {builderWorkflow.edges.map((edge) => {
                      const srcNode = builderWorkflow.nodes.find((n) => n.id === edge.source);
                      const tgtNode = builderWorkflow.nodes.find((n) => n.id === edge.target);
                      if (!srcNode || !tgtNode) return null;
                      const src = getNodeOutputPort(srcNode);
                      const tgt = getNodeInputPort(tgtNode);
                      const dx = Math.abs(tgt.x - src.x) * 0.5;
                      return (
                        <g key={edge.id}>
                          {/* Wider invisible hitbox for clicking */}
                          <path
                            d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); showSnack('Edge removed'); }}
                          />
                          <path
                            d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                            fill="none"
                            stroke="#adc6ff"
                            strokeOpacity={0.4}
                            strokeWidth={2}
                            markerEnd="url(#arrowhead)"
                            style={{ pointerEvents: 'none' }}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Nodes */}
                  {builderWorkflow.nodes.map((node) => (
                    <CanvasNode
                      key={node.id}
                      node={node}
                      selected={selectedNode === node.id}
                      connecting={!!edgeSource}
                      isEdgeSource={edgeSource === node.id}
                      onSelect={() => setSelectedNode(node.id)}
                      onDragStart={(e) => handleNodeDragStart(node.id, e)}
                      onPortClick={handlePortClick}
                      hasOutput={builderWorkflow.edges.some((e) => e.source === node.id)}
                      hasInput={builderWorkflow.edges.some((e) => e.target === node.id)}
                    />
                  ))}

                  {builderWorkflow.nodes.length === 0 && (
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <Zap className="w-8 h-8" style={{ color: '#555', margin: '0 auto 12px' }} />
                      <Typography sx={{ color: 'text.secondary', mb: 0.5, fontWeight: 500 }}>
                        Empty Canvas
                      </Typography>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Click a node type from the palette to add it here
                      </Typography>
                    </Box>
                  )}
                </Paper>

                {/* Config Panel — shown when a node is selected */}
                {selectedNodeObj && (
                  <NodeConfigPanel
                    node={selectedNodeObj}
                    onUpdate={updateNode}
                    onDelete={() => deleteNode(selectedNodeObj.id)}
                    onDuplicate={() => duplicateNode(selectedNodeObj.id)}
                    onClose={() => setSelectedNode(null)}
                  />
                )}
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
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {run.status === 'completed' && <Box sx={{ color: '#53e16f', display: 'flex' }}><CheckCircle className="w-4 h-4" /></Box>}
                      {run.status === 'failed' && <Box sx={{ color: '#ef4444', display: 'flex' }}><XCircle className="w-4 h-4" /></Box>}
                      {(run.status === 'running' || run.status === 'pending') && <Box sx={{ color: '#adc6ff', display: 'flex' }}><Clock className="w-4 h-4" /></Box>}
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
            <StatCard icon={Layers} label="Total Workflows" value={stats.total_workflows} color="#4b8eff" />
            <StatCard icon={Zap} label="Active Workflows" value={stats.workflows_active} color="#53e16f" />
            <StatCard icon={Play} label="Total Runs" value={stats.total_runs} color="#adc6ff" />
            <StatCard icon={CheckCircle} label="Success Rate" value={`${stats.success_rate.toFixed(1)}%`} color="#ffb595" />
          </Box>

          <Paper sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Run Results</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Completed', value: stats.runs_completed, color: '#53e16f' },
                { name: 'Failed', value: stats.runs_failed, color: '#ef4444' },
                { name: 'Running', value: stats.runs_running, color: '#adc6ff' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#252525',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {[
                    { color: '#53e16f' },
                    { color: '#ef4444' },
                    { color: '#adc6ff' },
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
          <TextField label="Workflow Name" value={createName} onChange={(e) => setCreateName(e.target.value)} fullWidth autoFocus />
          <TextField label="Description" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createName.trim()}>
            Create & Open Builder
          </Button>
        </DialogActions>
      </Dialog>

      {/* ──────────── Rename Dialog ──────────── */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Workflow</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Workflow Name" value={renameName} onChange={(e) => setRenameName(e.target.value)} fullWidth autoFocus />
          <TextField label="Description" value={renameDesc} onChange={(e) => setRenameDesc(e.target.value)} fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRename} disabled={!renameName.trim()}>
            Update
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
