'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import { useTheme } from '@mui/material/styles';
import {
  Library, Upload, Trash2, FileText, Search, Send, X, ChevronRight,
  Database, Layers, Clock, HardDrive,
} from 'lucide-react';
import api, { ragAPI, systemAPI } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  chunk_count: number;
  status: string;
  error?: string;
  created_at: string;
}

interface RetrievalResult {
  chunk_content: string;
  chunk_index: number;
  document_id: string;
  document_name: string;
  similarity: number;
}

interface RAGStats {
  total_documents: number;
  ready_documents: number;
  total_chunks: number;
  total_size: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const theme = useTheme();
  const isDark = true; // Kinetic Console: always dark

  // State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Query state
  const [query, setQuery] = useState('');
  const [queryModel, setQueryModel] = useState('claude-sonnet-4-20250514');
  const [querying, setQuerying] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);
  const [ragResponse, setRagResponse] = useState('');
  const [models, setModels] = useState<{ name: string; id: string }[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadType, setUploadType] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null); // for PDF uploads

  const responseRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        ragAPI.listDocuments(),
        ragAPI.getStats(),
      ]);
      setDocuments(docsRes.data?.data?.documents || []);
      setStats(statsRes.data?.data || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    systemAPI.listModels().then(res => {
      setModels(res.data?.data?.models || []);
    }).catch(() => {});
  }, [loadData]);

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadContent.trim() && !pendingFile) return;
    setUploading(true);
    try {
      if (pendingFile) {
        // PDF or binary file — send as multipart form data
        const formData = new FormData();
        formData.append('file', pendingFile);
        if (uploadName) formData.append('name', uploadName);
        await api.post('/api/v1/rag/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // PDFs can take longer
        });
      } else {
        // Text paste — send as JSON
        await ragAPI.uploadDocument({
          name: uploadName || 'Untitled Document',
          content: uploadContent,
          type: uploadType,
        });
      }
      setUploadOpen(false);
      setUploadName('');
      setUploadContent('');
      setPendingFile(null);
      loadData();
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  // ── Delete handler ─────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await ragAPI.deleteDocument(id);
      loadData();
    } catch {
      // ignore
    }
  };

  // ── File drop handler ──────────────────────────────────────────────────────

  const processFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    setUploadName(file.name);
    setUploadOpen(true);

    if (ext === 'pdf') {
      // PDF — store the file for multipart upload, don't try to read as text
      setPendingFile(file);
      setUploadContent(''); // clear text area
      setUploadType('pdf');
    } else {
      // Text-based file — read content
      setPendingFile(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadContent(ev.target?.result as string || '');
      };
      reader.readAsText(file);
      setUploadType(ext === 'md' || ext === 'markdown' ? 'markdown' : 'text');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── RAG Query (SSE streaming) ──────────────────────────────────────────────

  const handleQuery = async () => {
    if (!query.trim() || querying) return;
    setQuerying(true);
    setRetrievalResults([]);
    setRagResponse('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(`${API_BASE_URL}/api/v1/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: query,
          model: queryModel,
          document_ids: selectedDocs.length > 0 ? selectedDocs : undefined,
          top_k: 5,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const evt = JSON.parse(raw);
            if (evt.results && evt.retrieved !== undefined) {
              // Retrieval event: {results:[...], query, total, retrieved}
              setRetrievalResults(evt.results || []);
            } else if (evt.token !== undefined) {
              // Token event: {token:"...", index, timestamp}
              setRagResponse(prev => prev + evt.token);
            } else if (evt.response_length !== undefined) {
              // Complete event: {response_length, sources}
              // done
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      setRagResponse('Error: Failed to query. Make sure documents are uploaded and the LLM provider is configured.');
    } finally {
      setQuerying(false);
    }
  };

  // ── Formatted bytes ────────────────────────────────────────────────────────

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Library className="w-6 h-6" style={{ color: theme.palette.primary.main }} />
          <Typography variant="h5">Knowledge Base</Typography>
          <Chip
            label={`${stats?.total_documents || 0} docs`}
            size="small"
            color="primary"
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<Upload className="w-4 h-4" />}
          onClick={() => setUploadOpen(true)}
        >
          Upload Document
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        {[
          { label: 'Documents', value: stats?.total_documents || 0, icon: FileText, color: theme.palette.primary.main },
          { label: 'Ready', value: stats?.ready_documents || 0, icon: Database, color: theme.palette.success.main },
          { label: 'Chunks', value: stats?.total_chunks || 0, icon: Layers, color: theme.palette.secondary.main },
          { label: 'Total Size', value: formatBytes(stats?.total_size || 0), icon: HardDrive, color: theme.palette.info.main },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={1}
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: `${stat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{stat.value}</Typography>
              <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Two Column Layout: Documents + Query */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        {/* Left: Document List */}
        <Paper elevation={1} sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Documents</Typography>
          </Box>

          {/* Drop zone */}
          <Box
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            sx={{
              m: 2,
              p: 3,
              border: `2px dashed ${theme.palette.divider}`,
              borderRadius: 2,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              '&:hover': { borderColor: theme.palette.primary.main },
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-5 h-5" style={{ color: theme.palette.text.secondary, margin: '0 auto 8px' }} />
            <Typography variant="body2" color="text.secondary">
              Drop a file here or click to browse
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Supports PDF, TXT, MD, and CSV files
            </Typography>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.txt,.md,.text,.csv,.markdown"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Box>

          {/* Document list */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {documents.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="body2">
                  No documents uploaded yet
                </Typography>
              </Box>
            ) : (
              documents.map((doc) => (
                <Box
                  key={doc.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    '&:hover': { bgcolor: theme.palette.action.hover },
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setSelectedDocs(prev =>
                      prev.includes(doc.id) ? prev.filter(d => d !== doc.id) : [...prev, doc.id]
                    );
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '8px',
                      bgcolor: selectedDocs.includes(doc.id)
                        ? `${theme.palette.primary.main}20`
                        : `${theme.palette.text.secondary}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: selectedDocs.includes(doc.id)
                        ? `2px solid ${theme.palette.primary.main}`
                        : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <FileText
                      className="w-4 h-4"
                      style={{
                        color: selectedDocs.includes(doc.id)
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                      {doc.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {doc.chunk_count} chunks
                      </Typography>
                      <Typography variant="caption" color="text.disabled">|</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatBytes(doc.size)}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">|</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(doc.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={doc.status}
                    size="small"
                    color={doc.status === 'ready' ? 'success' : doc.status === 'error' ? 'error' : 'warning'}
                    sx={{ fontSize: '0.7rem' }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconButton>
                </Box>
              ))
            )}
          </Box>

          {selectedDocs.length > 0 && (
            <Box sx={{ p: 1.5, bgcolor: `${theme.palette.primary.main}08`, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" color="primary">
                {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} selected for query
              </Typography>
              <Button size="small" onClick={() => setSelectedDocs([])} sx={{ ml: 1, fontSize: '0.7rem' }}>
                Clear
              </Button>
            </Box>
          )}
        </Paper>

        {/* Right: Query Panel */}
        <Paper elevation={1} sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Search className="w-4 h-4" style={{ color: theme.palette.primary.main }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>RAG Query</Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={queryModel}
                label="Model"
                onChange={(e) => setQueryModel(e.target.value)}
              >
                {models.length > 0 ? (
                  models.map(m => (
                    <MenuItem key={m.id || m.name} value={m.name}>{m.name}</MenuItem>
                  ))
                ) : (
                  <MenuItem value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</MenuItem>
                )}
              </Select>
            </FormControl>
          </Box>

          {/* Query input */}
          <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder="Ask a question about your documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(); } }}
              size="small"
              multiline
              maxRows={3}
            />
            <IconButton
              onClick={handleQuery}
              disabled={querying || !query.trim()}
              color="primary"
              sx={{
                bgcolor: theme.palette.primary.main,
                color: '#fff',
                '&:hover': { bgcolor: theme.palette.primary.dark },
                '&.Mui-disabled': { bgcolor: theme.palette.action.disabledBackground },
                borderRadius: '10px',
                width: 42,
                height: 42,
              }}
            >
              {querying ? <CircularProgress size={18} color="inherit" /> : <Send className="w-4 h-4" />}
            </IconButton>
          </Box>

          {/* Results area */}
          <Box ref={responseRef} sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2, minHeight: 300 }}>
            {/* Retrieval results */}
            {retrievalResults.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                  Retrieved {retrievalResults.length} sources
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {retrievalResults.map((r, i) => (
                    <Chip
                      key={i}
                      label={`${r.document_name} #${r.chunk_index}`}
                      size="small"
                      variant="outlined"
                      icon={<ChevronRight className="w-3 h-3" />}
                      sx={{ fontSize: '0.7rem' }}
                      title={`Similarity: ${(r.similarity * 100).toFixed(1)}%\n\n${r.chunk_content.slice(0, 200)}...`}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Streaming response */}
            {(ragResponse || querying) && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                  Response
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {querying && !ragResponse && (
                    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
                  )}
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                  >
                    {ragResponse}
                    {querying && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 2,
                          height: 16,
                          bgcolor: theme.palette.primary.main,
                          ml: 0.5,
                          animation: 'blink 1s step-end infinite',
                          '@keyframes blink': {
                            '50%': { opacity: 0 },
                          },
                        }}
                      />
                    )}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Empty state */}
            {!ragResponse && !querying && retrievalResults.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <Search className="w-8 h-8" style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  Ask a question to search your knowledge base
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                  {documents.length > 0
                    ? `Searching across ${stats?.total_chunks || 0} chunks from ${documents.length} documents`
                    : 'Upload documents first to get started'}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload className="w-5 h-5" />
            Upload Document
          </Box>
          <IconButton size="small" onClick={() => setUploadOpen(false)}>
            <X className="w-4 h-4" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Document Name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={uploadType}
                label="Type"
                onChange={(e) => setUploadType(e.target.value)}
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="pdf">PDF</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {pendingFile ? (
            <Paper
              variant="outlined"
              sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              <FileText className="w-10 h-10" style={{ margin: '0 auto 12px', color: theme.palette.primary.main }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{pendingFile.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {formatBytes(pendingFile.size)} — PDF will be parsed on the server
              </Typography>
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() => { setPendingFile(null); setUploadContent(''); setUploadType('text'); }}
              >
                Remove
              </Button>
            </Paper>
          ) : (
            <>
              <TextField
                fullWidth
                label="Document Content"
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                multiline
                rows={12}
                placeholder="Paste your document content here, or drag & drop a PDF..."
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {uploadContent.length > 0
                  ? `${uploadContent.length.toLocaleString()} characters | ~${Math.ceil(uploadContent.length / 500)} chunks`
                  : 'Paste text or drag & drop a file (PDF, TXT, MD)'}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || (!uploadContent.trim() && !pendingFile)}
            startIcon={uploading ? <CircularProgress size={16} /> : <Upload className="w-4 h-4" />}
          >
            {uploading ? 'Processing...' : 'Upload & Index'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
