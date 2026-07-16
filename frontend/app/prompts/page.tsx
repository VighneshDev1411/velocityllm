'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import {
  BookTemplate, Search, Plus, Copy, Play, BarChart3, Tag,
  FileText, Clock, CheckCircle, XCircle, Eye, X, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { promptsAPI } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Variable {
  Name: string;
  Type: string;
  Required: boolean;
  DefaultValue: string;
  Description: string;
}

interface TemplateStats {
  UsageCount: number;
  SuccessCount: number;
  FailureCount: number;
  AvgResponseTime: number;
  LastUsed: string;
}

interface Template {
  ID: string;
  Name: string;
  Description: string;
  Content: string;
  Variables: Variable[];
  Version: string;
  CreatedAt: string;
  UpdatedAt: string;
  Category: string;
  Tags: string[];
  Stats: TemplateStats | null;
}

interface ManagerStats {
  total_templates: number;
  total_usage: number;
  avg_success_rate: number;
  categories: string[];
  templates: { id: string; name: string; usage: number; success_rate: number }[];
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '8px',
          backgroundColor: `${color}18`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color,
        }}>
          <Icon className="w-[18px] h-[18px]" />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'var(--font-mono), "JetBrains Mono", monospace' }}>{value}</Typography>
    </Paper>
  );
}

// ─── Category Colors ─────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  development: '#adc6ff',
  'text-processing': '#4b8eff',
  translation: '#53e16f',
  general: '#ffb595',
  analysis: '#ef4444',
  creative: '#adc6ff',
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || '#c1c6d7';
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PromptLibraryPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Browse state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Create state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newVariables, setNewVariables] = useState<{ name: string; type: string; required: boolean; defaultValue: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Test state
  const [testTemplateId, setTestTemplateId] = useState('');
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [renderedPrompt, setRenderedPrompt] = useState('');
  const [rendering, setRendering] = useState(false);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // ─── Data Loading ────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      const res = await promptsAPI.listTemplates();
      const data = res.data?.data || [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await promptsAPI.getStats();
      setStats(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadTemplates(), loadStats()]);
      setLoading(false);
    };
    init();
  }, [loadTemplates, loadStats]);

  // ─── Filtered Templates ──────────────────────────────────────────────────

  const categories = [...new Set(templates.map(t => t.Category).filter(Boolean))];

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery ||
      t.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.Tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || t.Category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // ─── Create Template ─────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!newName || !newContent) {
      showSnackbar('Name and content are required', 'error');
      return;
    }
    setCreating(true);
    try {
      const id = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await promptsAPI.createTemplate({
        ID: id,
        Name: newName,
        Description: newDescription,
        Content: newContent,
        Category: newCategory || 'general',
        Tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        Variables: newVariables.map(v => ({
          Name: v.name,
          Type: v.type || 'string',
          Required: v.required,
          DefaultValue: v.defaultValue,
          Description: '',
        })),
        Version: '1.0.0',
      });
      showSnackbar('Template created successfully');
      setNewName(''); setNewDescription(''); setNewCategory('');
      setNewTags(''); setNewContent(''); setNewVariables([]);
      await loadTemplates();
      setTab(0);
    } catch (err: any) {
      showSnackbar(err.response?.data?.error || 'Failed to create template', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ─── Render Template ──────────────────────────────────────────────────────

  const handleRender = async () => {
    if (!testTemplateId) {
      showSnackbar('Select a template first', 'error');
      return;
    }
    setRendering(true);
    try {
      const res = await promptsAPI.renderTemplate(testTemplateId, testValues);
      setRenderedPrompt(res.data?.data?.rendered_prompt || '');
      showSnackbar('Template rendered');
    } catch (err: any) {
      showSnackbar(err.response?.data?.error || 'Render failed', 'error');
    } finally {
      setRendering(false);
    }
  };

  const selectedTestTemplate = templates.find(t => t.ID === testTemplateId);

  // When test template changes, reset values
  const handleTestTemplateChange = (id: string) => {
    setTestTemplateId(id);
    setRenderedPrompt('');
    const tmpl = templates.find(t => t.ID === id);
    if (tmpl?.Variables) {
      const vals: Record<string, string> = {};
      tmpl.Variables.forEach(v => { vals[v.Name] = v.DefaultValue || ''; });
      setTestValues(vals);
    } else {
      setTestValues({});
    }
  };

  // ─── Copy to clipboard ────────────────────────────────────────────────────

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSnackbar('Copied to clipboard');
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '8px',
          background: 'linear-gradient(135deg, #4b8eff, #4b8eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookTemplate className="w-6 h-6" style={{ color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Prompt Library</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Browse, create, test, and manage prompt templates
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Browse" icon={<Search className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Create" icon={<Plus className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Test" icon={<Play className="w-4 h-4" />} iconPosition="start" />
        <Tab label="Stats" icon={<BarChart3 className="w-4 h-4" />} iconPosition="start" />
      </Tabs>

      {/* ─── Tab 0: Browse ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <Box>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <Search className="w-4 h-4 mr-2" style={{ color: '#888' }} /> }}
              sx={{ minWidth: 260 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {filteredTemplates.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6, textAlign: 'center', borderRadius: 2,
                border: `1px solid rgba(255,255,255,0.08)`,
              }}
            >
              <BookTemplate className="w-12 h-12 mx-auto mb-2" style={{ color: '#888' }} />
              <Typography variant="h6" sx={{ color: 'text.secondary' }}>No templates found</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first template to get started'}
              </Typography>
              {!searchQuery && categoryFilter === 'all' && (
                <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setTab(1)}>
                  Create Template
                </Button>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
              {filteredTemplates.map(t => (
                <Paper
                  key={t.ID}
                  elevation={0}
                  sx={{
                    p: 2.5, borderRadius: 2, cursor: 'pointer',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    backgroundColor: selectedTemplate?.ID === t.ID
                      ? 'rgba(139,92,246,0.08)'
                      : ('rgba(255,255,255,0.02)'),
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: '#4b8eff',
                      backgroundColor: 'rgba(139,92,246,0.06)',
                    },
                  }}
                  onClick={() => setSelectedTemplate(selectedTemplate?.ID === t.ID ? null : t)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.Name}</Typography>
                    <Chip
                      label={t.Category}
                      size="small"
                      sx={{
                        backgroundColor: `${getCategoryColor(t.Category)}18`,
                        color: getCategoryColor(t.Category),
                        fontWeight: 600, fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, minHeight: 40 }}>
                    {t.Description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {(t.Tags || []).map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.68rem', height: 22 }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      v{t.Version} &middot; {(t.Variables || []).length} variable{(t.Variables || []).length !== 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t.Stats ? `${t.Stats.UsageCount} uses` : '0 uses'}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {/* Detail Panel */}
          {selectedTemplate && (
            <Paper
              elevation={0}
              sx={{
                mt: 3, p: 3, borderRadius: 2,
                border: `1px solid rgba(255,255,255,0.08)`,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{selectedTemplate.Name}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Play className="w-3.5 h-3.5" />}
                    onClick={() => { handleTestTemplateChange(selectedTemplate.ID); setTab(2); }}
                  >
                    Test
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => copyToClipboard(selectedTemplate.Content)}
                  >
                    Copy
                  </Button>
                  <IconButton size="small" onClick={() => setSelectedTemplate(null)}>
                    <X className="w-4 h-4" />
                  </IconButton>
                </Box>
              </Box>

              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {selectedTemplate.Description}
              </Typography>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Prompt Content</Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2, mb: 2, borderRadius: 1.5,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  fontFamily: 'monospace', fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap', lineHeight: 1.6,
                }}
              >
                {selectedTemplate.Content}
              </Paper>

              {(selectedTemplate.Variables || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Variables</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedTemplate.Variables.map(v => (
                      <Box
                        key={v.Name}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          p: 1.5, borderRadius: 1,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <Chip label={`{{${v.Name}}}`} size="small" sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {v.Type} {v.Required ? '(required)' : '(optional)'}
                        </Typography>
                        {v.DefaultValue && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Default: {v.DefaultValue}
                          </Typography>
                        )}
                        {v.Description && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
                            {v.Description}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* ─── Tab 1: Create ─────────────────────────────────────────────────── */}
      {tab === 1 && (
        <Box sx={{ maxWidth: 800 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3, borderRadius: 2,
              border: `1px solid rgba(255,255,255,0.08)`,
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5 }}>Create New Template</Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Template Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                fullWidth
                required
                placeholder="e.g., Bug Report Analyzer"
              />
              <TextField
                label="Description"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="What does this template do?"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Category"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  fullWidth
                  placeholder="e.g., development"
                />
                <TextField
                  label="Tags (comma-separated)"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  fullWidth
                  placeholder="e.g., code, analysis, bugs"
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Prompt Content
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  Use {'{{variable_name}}'} syntax for dynamic variables
                </Typography>
                <TextField
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  fullWidth
                  multiline
                  rows={8}
                  placeholder={`Analyze the following {{language}} code for bugs:\n\n{{code}}\n\nProvide a detailed report.`}
                  sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
                />
              </Box>

              {/* Variables */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Variables</Typography>
                  <Button
                    size="small"
                    startIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setNewVariables([...newVariables, { name: '', type: 'string', required: true, defaultValue: '' }])}
                  >
                    Add Variable
                  </Button>
                </Box>
                {newVariables.map((v, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="Name"
                      value={v.name}
                      onChange={e => {
                        const updated = [...newVariables];
                        updated[i].name = e.target.value;
                        setNewVariables(updated);
                      }}
                      sx={{ flex: 2 }}
                    />
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={v.type}
                        label="Type"
                        onChange={e => {
                          const updated = [...newVariables];
                          updated[i].type = e.target.value;
                          setNewVariables(updated);
                        }}
                      >
                        <MenuItem value="string">String</MenuItem>
                        <MenuItem value="number">Number</MenuItem>
                        <MenuItem value="boolean">Boolean</MenuItem>
                        <MenuItem value="list">List</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Required</InputLabel>
                      <Select
                        value={v.required ? 'yes' : 'no'}
                        label="Required"
                        onChange={e => {
                          const updated = [...newVariables];
                          updated[i].required = e.target.value === 'yes';
                          setNewVariables(updated);
                        }}
                      >
                        <MenuItem value="yes">Yes</MenuItem>
                        <MenuItem value="no">No</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Default"
                      value={v.defaultValue}
                      onChange={e => {
                        const updated = [...newVariables];
                        updated[i].defaultValue = e.target.value;
                        setNewVariables(updated);
                      }}
                      sx={{ flex: 1.5 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setNewVariables(newVariables.filter((_, j) => j !== i))}
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </Box>
                ))}
              </Box>

              {/* Preview */}
              {newContent && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Preview</Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2, borderRadius: 1.5,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      fontFamily: 'monospace', fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap', lineHeight: 1.6,
                    }}
                  >
                    {newContent}
                  </Paper>
                </Box>
              )}

              <Button
                variant="contained"
                onClick={handleCreateTemplate}
                disabled={creating || !newName || !newContent}
                startIcon={creating ? <CircularProgress size={16} /> : <Plus className="w-4 h-4" />}
                sx={{ alignSelf: 'flex-start', mt: 1 }}
              >
                {creating ? 'Creating...' : 'Create Template'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ─── Tab 2: Test ───────────────────────────────────────────────────── */}
      {tab === 2 && (
        <Box sx={{ maxWidth: 900 }}>
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Input Panel */}
            <Paper
              elevation={0}
              sx={{
                p: 3, flex: 1, borderRadius: 2,
                border: `1px solid rgba(255,255,255,0.08)`,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Template Playground</Typography>

              <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                <InputLabel>Select Template</InputLabel>
                <Select
                  value={testTemplateId}
                  label="Select Template"
                  onChange={e => handleTestTemplateChange(e.target.value)}
                >
                  {templates.map(t => (
                    <MenuItem key={t.ID} value={t.ID}>{t.Name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedTestTemplate && (selectedTestTemplate.Variables || []).length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Variables</Typography>
                  {selectedTestTemplate.Variables.map(v => (
                    <TextField
                      key={v.Name}
                      label={`${v.Name}${v.Required ? ' *' : ''}`}
                      value={testValues[v.Name] || ''}
                      onChange={e => setTestValues({ ...testValues, [v.Name]: e.target.value })}
                      fullWidth
                      size="small"
                      multiline={v.Type === 'string'}
                      rows={v.Name === 'code' || v.Name === 'text' ? 4 : 1}
                      placeholder={v.DefaultValue || `Enter ${v.Name}`}
                      helperText={v.Description}
                    />
                  ))}
                </Box>
              )}

              <Button
                variant="contained"
                onClick={handleRender}
                disabled={rendering || !testTemplateId}
                startIcon={rendering ? <CircularProgress size={16} /> : <Play className="w-4 h-4" />}
                fullWidth
              >
                {rendering ? 'Rendering...' : 'Render Template'}
              </Button>
            </Paper>

            {/* Output Panel */}
            <Paper
              elevation={0}
              sx={{
                p: 3, flex: 1, borderRadius: 2,
                border: `1px solid rgba(255,255,255,0.08)`,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Rendered Output</Typography>
                {renderedPrompt && (
                  <Tooltip title="Copy to clipboard">
                    <IconButton size="small" onClick={() => copyToClipboard(renderedPrompt)}>
                      <Copy className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {renderedPrompt ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2, borderRadius: 1.5,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    fontFamily: 'monospace', fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                    minHeight: 200,
                  }}
                >
                  {renderedPrompt}
                </Paper>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  <Eye className="w-10 h-10 mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <Typography variant="body2">
                    Select a template, fill in variables, and click Render
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* ─── Tab 3: Stats ──────────────────────────────────────────────────── */}
      {tab === 3 && (
        <Box>
          {/* Stat Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
            <StatCard icon={FileText} label="Total Templates" value={stats?.total_templates || templates.length} color="#4b8eff" />
            <StatCard icon={BarChart3} label="Total Usage" value={stats?.total_usage || 0} color="#adc6ff" />
            <StatCard
              icon={CheckCircle}
              label="Avg Success Rate"
              value={stats?.avg_success_rate != null ? `${(stats.avg_success_rate * 100).toFixed(0)}%` : 'N/A'}
              color="#53e16f"
            />
            <StatCard icon={Layers} label="Categories" value={stats?.categories?.length || categories.length} color="#ffb595" />
          </Box>

          {/* Usage Chart */}
          <Paper
            elevation={0}
            sx={{
              p: 3, borderRadius: 2,
              border: `1px solid rgba(255,255,255,0.08)`,
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Usage by Template</Typography>
            {templates.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={templates.map(t => ({
                    name: t.Name,
                    usage: t.Stats?.UsageCount || 0,
                    success: t.Stats?.SuccessCount || 0,
                    failure: t.Stats?.FailureCount || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#2a2a2a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="usage" fill="#4b8eff" name="Total Usage" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="success" fill="#53e16f" name="Success" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failure" fill="#ef4444" name="Failure" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <BarChart3 className="w-10 h-10 mx-auto mb-2" style={{ opacity: 0.3 }} />
                <Typography variant="body2">No usage data yet</Typography>
              </Box>
            )}
          </Paper>

          {/* Template List with Stats */}
          <Paper
            elevation={0}
            sx={{
              mt: 2, p: 3, borderRadius: 2,
              border: `1px solid rgba(255,255,255,0.08)`,
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Template Details</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {templates.map(t => (
                <Box
                  key={t.ID}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: 2, borderRadius: 1.5,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={t.Category}
                      size="small"
                      sx={{
                        backgroundColor: `${getCategoryColor(t.Category)}18`,
                        color: getCategoryColor(t.Category),
                        fontWeight: 600, fontSize: '0.7rem',
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.Name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>v{t.Version}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Uses</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.Stats?.UsageCount || 0}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Success</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#53e16f' }}>
                        {t.Stats?.SuccessCount || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Failed</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>
                        {t.Stats?.FailureCount || 0}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
