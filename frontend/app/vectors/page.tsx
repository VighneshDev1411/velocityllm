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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import {
  Waypoints, Search, Trash2, Plus, FolderPlus, Database, Layers,
  BarChart3, Sparkles, FileText, X,
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  BarChart, Bar,
} from 'recharts';
import { vectorAPI, ragAPI } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  content: string;
  chunk_index: number;
  document_id: string;
  document_name: string;
  similarity: number;
}

interface ProjectionPoint {
  x: number;
  y: number;
  content: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  documents?: { id: string; name: string; chunk_count: number }[];
  created_at: string;
}

interface VectorStats {
  total_vectors: number;
  total_documents: number;
  total_collections: number;
  avg_token_count: number;
  embedding_dim: number;
  similarity_histogram: { label: string; count: number }[];
  pairs_sampled: number;
}

interface Document {
  id: string;
  name: string;
  type: string;
  chunk_count: number;
  status: string;
}

// ─── Color palette for documents ─────────────────────────────────────────────

const DOC_COLORS = [
  '#adc6ff', '#ef4444', '#53e16f', '#ffb595', '#4b8eff',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#4b8eff',
];

function getDocColor(docId: string, docColorMap: Record<string, string>): string {
  if (!docColorMap[docId]) {
    docColorMap[docId] = DOC_COLORS[Object.keys(docColorMap).length % DOC_COLORS.length];
  }
  return docColorMap[docId];
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VectorDBPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // Semantic Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCollection, setSearchCollection] = useState<string>('');
  const [totalSearched, setTotalSearched] = useState(0);

  // Projection state
  const [projectionData, setProjectionData] = useState<ProjectionPoint[]>([]);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [projectionCollection, setProjectionCollection] = useState<string>('');

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState('#adc6ff');
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [addDocDialogOpen, setAddDocDialogOpen] = useState(false);
  const [selectedCollectionForDoc, setSelectedCollectionForDoc] = useState<string>('');

  // Stats state
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Shared
  const docColorMap: Record<string, string> = {};

  // ─── Data loading ────────────────────────────────────────────────────────

  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const res = await vectorAPI.listCollections();
      setCollections(res.data?.data?.collections || []);
    } catch { /* ignore */ }
    setCollectionsLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await vectorAPI.getStats();
      setStats(res.data?.data || null);
    } catch { /* ignore */ }
    setStatsLoading(false);
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await ragAPI.listDocuments(100, 0);
      setAllDocuments(res.data?.data?.documents || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCollections();
    loadDocuments();
  }, [loadCollections, loadDocuments]);

  useEffect(() => {
    if (activeTab === 3) loadStats();
  }, [activeTab, loadStats]);

  // ─── Search ──────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await vectorAPI.search(
        searchQuery,
        searchCollection || undefined,
        20,
      );
      const data = res.data?.data;
      setSearchResults(data?.results || []);
      setTotalSearched(data?.total_searched || 0);
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  };

  // ─── Projection ──────────────────────────────────────────────────────────

  const loadProjection = async () => {
    setProjectionLoading(true);
    try {
      const res = await vectorAPI.projection(
        projectionCollection || undefined,
        500,
      );
      setProjectionData(res.data?.data?.points || []);
    } catch { setProjectionData([]); }
    setProjectionLoading(false);
  };

  useEffect(() => {
    if (activeTab === 1) loadProjection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Collection CRUD ─────────────────────────────────────────────────────

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      await vectorAPI.createCollection(newCollectionName, newCollectionDesc, newCollectionColor);
      setCreateDialogOpen(false);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setNewCollectionColor('#adc6ff');
      loadCollections();
    } catch { /* ignore */ }
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      await vectorAPI.deleteCollection(id);
      loadCollections();
    } catch { /* ignore */ }
  };

  const handleAddDocToCollection = async (docId: string) => {
    if (!selectedCollectionForDoc) return;
    try {
      await vectorAPI.addDocToCollection(selectedCollectionForDoc, docId);
      loadCollections();
      setAddDocDialogOpen(false);
    } catch { /* ignore */ }
  };

  const handleRemoveDocFromCollection = async (collectionId: string, docId: string) => {
    try {
      await vectorAPI.removeDocFromCollection(collectionId, docId);
      loadCollections();
    } catch { /* ignore */ }
  };

  // ─── Stat card helper ────────────────────────────────────────────────────

  const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) => (
    <Paper sx={{ p: 2.5, flex: 1, minWidth: 180, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ p: 1, borderRadius: '8px', backgroundColor: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Paper>
  );

  // ─── Tab 0: Semantic Search ──────────────────────────────────────────────

  const renderSearchTab = () => (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          label="Semantic search query"
          placeholder="Search your knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Collection</InputLabel>
          <Select
            value={searchCollection}
            label="Collection"
            onChange={(e) => setSearchCollection(e.target.value)}
          >
            <MenuItem value="">All Documents</MenuItem>
            {collections.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={searchLoading || !searchQuery.trim()}
          startIcon={searchLoading ? <CircularProgress size={16} /> : <Search className="w-4 h-4" />}
          sx={{ minWidth: 120, textTransform: 'none' }}
        >
          Search
        </Button>
      </Box>

      {searchResults.length > 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {searchResults.length} results from {totalSearched} vectors
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {searchResults.map((r, i) => (
          <Paper key={i} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip label={r.document_name} size="small" sx={{ backgroundColor: 'rgba(173,198,255,0.15)', color: '#adc6ff' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Chunk #{r.chunk_index}
                </Typography>
              </Box>
              <Chip
                label={`${(r.similarity * 100).toFixed(1)}%`}
                size="small"
                sx={{
                  backgroundColor: r.similarity > 0.8 ? 'rgba(83,225,111,0.15)' : r.similarity > 0.5 ? 'rgba(255,181,149,0.15)' : 'rgba(239,68,68,0.15)',
                  color: r.similarity > 0.8 ? '#53e16f' : r.similarity > 0.5 ? '#ffb595' : '#f87171',
                  fontWeight: 600,
                }}
              />
            </Box>
            {/* Similarity bar */}
            <LinearProgress
              variant="determinate"
              value={r.similarity * 100}
              sx={{
                mb: 1.5,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.05)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  background: r.similarity > 0.8 ? 'linear-gradient(90deg, #53e16f, #6ee882)' :
                    r.similarity > 0.5 ? 'linear-gradient(90deg, #ffb595, #ffc7ab)' :
                    'linear-gradient(90deg, #ef4444, #f87171)',
                },
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: 1.6 }}>
              {r.content}
            </Typography>
          </Paper>
        ))}

        {searchResults.length === 0 && !searchLoading && (
          <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <Search className="w-10 h-10" style={{ color: '#666', margin: '0 auto 12px' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Enter a query to search your vector store semantically
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );

  // ─── Tab 1: Embedding Explorer ───────────────────────────────────────────

  const renderExplorerTab = () => {
    // Build unique doc list for legend
    const uniqueDocs: Record<string, string> = {};
    projectionData.forEach((p) => {
      if (!uniqueDocs[p.document_id]) {
        uniqueDocs[p.document_id] = p.document_name;
        getDocColor(p.document_id, docColorMap);
      }
    });

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Collection</InputLabel>
              <Select
                value={projectionCollection}
                label="Collection"
                onChange={(e) => setProjectionCollection(e.target.value)}
              >
                <MenuItem value="">All Documents</MenuItem>
                {collections.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={loadProjection}
              disabled={projectionLoading}
              sx={{ textTransform: 'none' }}
            >
              {projectionLoading ? <CircularProgress size={16} /> : 'Refresh'}
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {projectionData.length} vectors projected (384D to 2D)
          </Typography>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {Object.entries(uniqueDocs).map(([docId, docName]) => (
            <Chip
              key={docId}
              label={docName}
              size="small"
              sx={{
                backgroundColor: `${getDocColor(docId, docColorMap)}20`,
                color: getDocColor(docId, docColorMap),
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          ))}
        </Box>

        <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {projectionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : projectionData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Sparkles className="w-10 h-10" style={{ color: '#666', margin: '0 auto 12px' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No vectors to visualize. Upload documents in Knowledge Base first.
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="x" name="x" domain={[0, 1]} tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis type="number" dataKey="y" name="y" domain={[0, 1]} tick={{ fontSize: 10, fill: '#888' }} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as ProjectionPoint;
                      return (
                        <Paper sx={{ p: 1.5, maxWidth: 300, backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#60a5fa' }}>{d.document_name}</Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', mb: 0.5 }}>Chunk #{d.chunk_index}</Typography>
                          <Typography variant="caption" sx={{ color: '#ccc', lineHeight: 1.4 }}>{d.content}</Typography>
                        </Paper>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter data={projectionData} isAnimationActive={false}>
                  {projectionData.map((point, idx) => (
                    <Cell key={idx} fill={getDocColor(point.document_id, docColorMap)} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Box>
    );
  };

  // ─── Tab 2: Collections ──────────────────────────────────────────────────

  const renderCollectionsTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Collections</Typography>
        <Button
          variant="contained"
          startIcon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          New Collection
        </Button>
      </Box>

      {collectionsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : collections.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <FolderPlus className="w-10 h-10" style={{ color: '#666', margin: '0 auto 12px' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No collections yet. Create one to organize your documents.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {collections.map((col) => (
            <Paper key={col.id} sx={{ p: 2.5, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: col.color }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{col.name}</Typography>
                  <Chip
                    label={`${col.documents?.length || 0} docs`}
                    size="small"
                    sx={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Add document">
                    <IconButton
                      size="small"
                      onClick={() => { setSelectedCollectionForDoc(col.id); setAddDocDialogOpen(true); }}
                      sx={{ color: '#60a5fa' }}
                    >
                      <Plus className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete collection">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteCollection(col.id)}
                      sx={{ color: '#f87171' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {col.description && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  {col.description}
                </Typography>
              )}

              {col.documents && col.documents.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {col.documents.map((doc) => (
                    <Chip
                      key={doc.id}
                      label={doc.name}
                      size="small"
                      icon={<FileText className="w-3 h-3" />}
                      onDelete={() => handleRemoveDocFromCollection(col.id, doc.id)}
                      sx={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    />
                  ))}
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Collection</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            size="small"
          />
          <TextField
            fullWidth
            label="Description"
            value={newCollectionDesc}
            onChange={(e) => setNewCollectionDesc(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
            size="small"
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1, alignSelf: 'center' }}>Color:</Typography>
            {DOC_COLORS.slice(0, 6).map((c) => (
              <IconButton
                key={c}
                onClick={() => setNewCollectionColor(c)}
                sx={{
                  width: 32, height: 32,
                  backgroundColor: c,
                  border: newCollectionColor === c ? '2px solid #fff' : '2px solid transparent',
                  '&:hover': { backgroundColor: c, opacity: 0.8 },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Add Document to Collection Dialog */}
      <Dialog open={addDocDialogOpen} onClose={() => setAddDocDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Document to Collection</DialogTitle>
        <DialogContent>
          {allDocuments.filter((d) => d.status === 'ready').length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
              No ready documents. Upload documents in Knowledge Base first.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              {allDocuments
                .filter((d) => d.status === 'ready')
                .map((doc) => (
                  <Paper
                    key={doc.id}
                    sx={{
                      p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.03)',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                    }}
                    onClick={() => handleAddDocToCollection(doc.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileText className="w-4 h-4" style={{ color: '#60a5fa' }} />
                      <Typography variant="body2">{doc.name}</Typography>
                    </Box>
                    <Chip label={`${doc.chunk_count} chunks`} size="small" sx={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  </Paper>
                ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDocDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  // ─── Tab 3: Stats ────────────────────────────────────────────────────────

  const renderStatsTab = () => (
    <Box>
      {statsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : stats ? (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
            <StatCard label="Total Vectors" value={stats.total_vectors.toLocaleString()} icon={Database} color="#adc6ff" />
            <StatCard label="Documents" value={stats.total_documents} icon={FileText} color="#53e16f" />
            <StatCard label="Collections" value={stats.total_collections} icon={Layers} color="#4b8eff" />
            <StatCard label="Embedding Dim" value={stats.embedding_dim} icon={Sparkles} color="#ffb595" />
            <StatCard label="Avg Tokens/Chunk" value={Math.round(stats.avg_token_count)} icon={BarChart3} color="#ec4899" />
          </Box>

          {stats.similarity_histogram && stats.similarity_histogram.length > 0 && (
            <Paper sx={{ p: 3, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Similarity Distribution
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                Pairwise cosine similarity across {stats.pairs_sampled.toLocaleString()} sample pairs
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.similarity_histogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#ccc' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="count" fill="#adc6ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No vector stats available. Upload documents first.
          </Typography>
        </Paper>
      )}
    </Box>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{
          p: 1.5, borderRadius: '8px',
          background: 'linear-gradient(135deg, #4b8eff, #adc6ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Waypoints className="w-6 h-6" style={{ color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Vector Database</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Semantic search, embedding visualization, and collection management
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minHeight: 42 },
          '& .MuiTabs-indicator': { backgroundColor: '#adc6ff' },
        }}
      >
        <Tab icon={<Search className="w-4 h-4" />} iconPosition="start" label="Semantic Search" />
        <Tab icon={<Sparkles className="w-4 h-4" />} iconPosition="start" label="Embedding Explorer" />
        <Tab icon={<Layers className="w-4 h-4" />} iconPosition="start" label="Collections" />
        <Tab icon={<BarChart3 className="w-4 h-4" />} iconPosition="start" label="Stats" />
      </Tabs>

      {/* Tab content */}
      {activeTab === 0 && renderSearchTab()}
      {activeTab === 1 && renderExplorerTab()}
      {activeTab === 2 && renderCollectionsTab()}
      {activeTab === 3 && renderStatsTab()}
    </Box>
  );
}
