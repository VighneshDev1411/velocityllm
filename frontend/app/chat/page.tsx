'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import {
  Square, Plus, Trash2, Download, Edit3, Check, X,
  MessageSquare, Bot, User, Copy, ArrowUp,
} from 'lucide-react';
import api, { chatAPI } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model?: string;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  message_count: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

interface AvailableModel {
  name: string;
  id: string;
  provider: string;
}

const SUGGESTIONS = [
  'Explain async/await in JavaScript',
  'Write a Python sorting algorithm',
  'Design a REST API for a todo app',
  'How does a neural network learn?',
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load models ───────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/v1/models').then((res) => {
      const data = res.data?.data || [];
      const available = data
        .filter((m: any) => m.available !== false)
        .map((m: any) => ({ name: m.name, id: m.id || m.name, provider: m.provider }));
      setModels(available);
      if (available.length > 0 && !selectedModel) setSelectedModel(available[0].name);
    }).catch(() => {});
  }, []);

  // ── Load conversations ────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.listConversations(50);
      setConversations(res.data?.data?.conversations || []);
    } catch {} finally { setLoadingConvs(false); }
  }, []);
  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadConversation = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    try {
      const res = await chatAPI.getConversation(id);
      const conv = res.data?.data as Conversation;
      if (conv?.messages) setMessages(conv.messages);
      if (conv?.model) setSelectedModel(conv.model);
    } catch {}
  }, []);

  const createNewChat = useCallback(async () => {
    try {
      const res = await chatAPI.createConversation('New Chat', selectedModel);
      const conv = res.data?.data as Conversation;
      if (conv) {
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        setMessages([]);
        inputRef.current?.focus();
      }
    } catch {}
  }, [selectedModel]);

  // ── Auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  // ── Send message ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (overrideInput?: string) => {
    const msg = overrideInput || input;
    if (!msg.trim() || isStreaming) return;

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await chatAPI.createConversation('New Chat', selectedModel);
        const conv = res.data?.data as Conversation;
        if (conv) {
          convId = conv.id;
          setConversations((prev) => [conv, ...prev]);
          setActiveConvId(conv.id);
        }
      } catch { return; }
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msg.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/chat/conversations/${convId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            model: selectedModel,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 1.0,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token !== undefined) {
                fullText += data.token;
                setStreamText(fullText);
              }
            } catch {}
          }
        }
      }

      if (fullText) {
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`, role: 'assistant',
          content: fullText, created_at: new Date().toISOString(), model: selectedModel,
        }]);
      }

      const convTitle = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId && c.title === 'New Chat'
            ? { ...c, title: convTitle, message_count: c.message_count + 2 }
            : c.id === convId ? { ...c, message_count: c.message_count + 2 } : c,
        ),
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (streamText) {
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`, role: 'assistant',
            content: streamText, created_at: new Date().toISOString(),
          }]);
        }
      } else {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`, role: 'assistant',
          content: `Error: ${err.message}`, created_at: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamText('');
      abortRef.current = null;
    }
  }, [input, isStreaming, activeConvId, selectedModel, streamText]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); }, []);

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await chatAPI.renameConversation(id, renameValue.trim());
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: renameValue.trim() } : c)));
    } catch {}
    setRenamingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await chatAPI.deleteConversation(deleteId);
      setConversations((prev) => prev.filter((c) => c.id !== deleteId));
      if (activeConvId === deleteId) { setActiveConvId(null); setMessages([]); }
    } catch {}
    setDeleteId(null);
  };

  const handleExport = () => {
    const conv = conversations.find((c) => c.id === activeConvId);
    const content = messages.map((m) => `### ${m.role === 'user' ? 'You' : 'Assistant'}\n${m.content}`).join('\n\n---\n\n');
    const md = `# ${conv?.title || 'Chat'}\n\nModel: ${selectedModel}\nDate: ${new Date().toLocaleDateString()}\n\n---\n\n${content}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(conv?.title || 'chat').replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ═══ SIDEBAR ═══ */}
      <Box sx={{
        width: 280, minWidth: 280,
        borderRight: '1px solid', borderColor: 'divider',
        display: 'flex', flexDirection: 'column',
        bgcolor: '#0f172a',
      }}>
        {/* New Chat */}
        <Box sx={{ p: 1.5 }}>
          <Button
            fullWidth
            onClick={createNewChat}
            startIcon={<Plus className="w-4 h-4" />}
            sx={{
              py: 1, justifyContent: 'flex-start', px: 2,
              color: '#cbd5e1', bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(148,163,184,0.12)',
              borderRadius: 2, fontWeight: 500, fontSize: '0.875rem',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            New chat
          </Button>
        </Box>

        {/* Conversation List */}
        <Box sx={{
          flex: 1, overflow: 'auto', px: 0.75,
          '&::-webkit-scrollbar': { width: 0 },
        }}>
          {loadingConvs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={20} sx={{ color: '#475569' }} />
            </Box>
          ) : conversations.length === 0 ? (
            <Typography sx={{ p: 3, color: '#475569', fontSize: '0.85rem', textAlign: 'center' }}>
              No conversations yet
            </Typography>
          ) : (
            <List dense disablePadding>
              {conversations.map((conv) => {
                const active = conv.id === activeConvId;
                return (
                  <ListItemButton
                    key={conv.id}
                    selected={active}
                    onClick={() => loadConversation(conv.id)}
                    sx={{
                      borderRadius: 2, mb: 0.25, py: 0.75, px: 1.5,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(255,255,255,0.08)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      },
                      '&:not(.Mui-selected):hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    }}
                  >
                    {renamingId === conv.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                        <TextField
                          size="small" value={renameValue} autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(conv.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          sx={{ '& input': { fontSize: '0.8rem', py: 0.25, px: 0.5, color: '#e2e8f0' } }}
                        />
                        <IconButton size="small" onClick={() => handleRename(conv.id)} sx={{ color: '#53e16f' }}>
                          <Check className="w-3 h-3" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setRenamingId(null)} sx={{ color: '#64748b' }}>
                          <X className="w-3 h-3" />
                        </IconButton>
                      </Box>
                    ) : (
                      <>
                        <ListItemText
                          primary={conv.title}
                          primaryTypographyProps={{
                            fontSize: '0.85rem', noWrap: true,
                            fontWeight: active ? 500 : 400,
                            color: active ? '#e2e8f0' : '#94a3b8',
                          }}
                        />
                        {active && (
                          <Box sx={{
                            display: 'flex', gap: 0.25,
                            opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 },
                            transition: 'opacity 0.15s',
                          }}>
                            <IconButton size="small" onClick={(e) => {
                              e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title);
                            }} sx={{ color: '#64748b', '&:hover': { color: '#e2e8f0' } }}>
                              <Edit3 className="w-3 h-3" />
                            </IconButton>
                            <IconButton size="small" onClick={(e) => {
                              e.stopPropagation(); setDeleteId(conv.id);
                            }} sx={{ color: '#64748b', '&:hover': { color: '#ef4444' } }}>
                              <Trash2 className="w-3 h-3" />
                            </IconButton>
                          </Box>
                        )}
                      </>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Box>
      </Box>

      {/* ═══ MAIN CHAT ═══ */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>

        {/* Top Bar */}
        <Box sx={{
          px: 2.5, py: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper',
        }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {activeConvId
              ? conversations.find((c) => c.id === activeConvId)?.title || 'Chat'
              : 'New chat'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Select
              size="small"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              sx={{
                minWidth: 160, fontSize: '0.8rem',
                '& .MuiSelect-select': { py: 0.5, px: 1 },
              }}
            >
              {models.map((m) => (
                <MenuItem key={m.name} value={m.name} sx={{ fontSize: '0.8rem' }}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>

            {activeConvId && messages.length > 0 && (
              <Tooltip title="Export as Markdown">
                <IconButton size="small" onClick={handleExport} sx={{ color: 'text.secondary' }}>
                  <Download className="w-4 h-4" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Messages */}
        <Box sx={{
          flex: 1, overflow: 'auto', py: 3,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(148,163,184,0.1)', borderRadius: 3 },
        }}>
          {!activeConvId && messages.length === 0 ? (
            /* ─── Empty State ─── */
            <Box sx={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2, px: 2,
            }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: '8px',
                bgcolor: 'rgba(173,198,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquare className="w-6 h-6" style={{ color: '#adc6ff' }} />
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'text.primary' }}>
                What can I help with?
              </Typography>
              <Box sx={{
                display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center',
                maxWidth: 560,
              }}>
                {SUGGESTIONS.map((s) => (
                  <Box
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    sx={{
                      px: 2, py: 1, borderRadius: 6,
                      border: '1px solid', borderColor: 'divider',
                      cursor: 'pointer', fontSize: '0.85rem', color: 'text.secondary',
                      transition: 'background 0.15s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {s}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            /* ─── Messages ─── */
            <Box sx={{ maxWidth: 720, mx: 'auto', px: 3 }}>
              {messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  copied={copiedId === msg.id}
                  onCopy={() => copyMessage(msg.id, msg.content)}
                />
              ))}

              {/* Streaming */}
              {isStreaming && streamText && (
                <MessageRow
                  message={{ id: 'streaming', role: 'assistant', content: streamText, created_at: new Date().toISOString(), model: selectedModel }}
                  isStreaming
                  copied={false}
                  onCopy={() => copyMessage('streaming', streamText)}
                />
              )}

              {/* Thinking indicator */}
              {isStreaming && !streamText && (
                <Box sx={{ py: 2, px: 2, mx: -2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <ChatAvatar role="assistant" />
                    <Box sx={{ pt: 0.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#a78bfa', mb: 0.75 }}>
                        VelocityLLM
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                        {[0, 1, 2].map((i) => (
                          <Box key={i} sx={{
                            width: 6, height: 6, borderRadius: '50%', bgcolor: '#8b5cf6',
                            animation: 'dotPulse 1.4s ease-in-out infinite',
                            animationDelay: `${i * 0.16}s`,
                            '@keyframes dotPulse': {
                              '0%, 80%, 100%': { opacity: 0.2, transform: 'scale(0.8)' },
                              '40%': { opacity: 1, transform: 'scale(1)' },
                            },
                          }} />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              <div ref={messagesEndRef} />
            </Box>
          )}
        </Box>

        {/* Input Area */}
        <Box sx={{ px: 3, pb: 2, pt: 1, position: 'sticky', bottom: 0, background: 'rgba(57,57,57,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(65,71,85,0.15)' }}>
          <Box sx={{ maxWidth: 720, mx: 'auto' }}>
            <Box sx={{
              display: 'flex', alignItems: 'flex-end', gap: 1,
              p: 1, borderRadius: 3,
              border: '1px solid', borderColor: 'divider',
              bgcolor: 'rgba(32,31,31,0.7)',
              transition: 'border-color 0.15s',
              '&:focus-within': { borderColor: 'primary.main' },
            }}>
              <TextField
                inputRef={inputRef}
                multiline maxRows={6} fullWidth
                placeholder="Message VelocityLLM..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                variant="standard"
                slotProps={{
                  input: {
                    disableUnderline: true,
                    sx: { fontSize: '0.95rem', px: 1 },
                  },
                }}
              />

              {isStreaming ? (
                <IconButton onClick={stopStreaming} size="small" sx={{
                  bgcolor: '#ef4444', color: '#fff', borderRadius: 2,
                  width: 32, height: 32,
                  '&:hover': { bgcolor: '#dc2626' },
                }}>
                  <Square className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} />
                </IconButton>
              ) : (
                <IconButton onClick={() => sendMessage()} disabled={!input.trim()} size="small" sx={{
                  bgcolor: input.trim() ? '#adc6ff' : 'action.disabledBackground',
                  color: input.trim() ? '#131313' : 'text.disabled',
                  borderRadius: 2, width: 32, height: 32,
                  '&:hover': { bgcolor: input.trim() ? '#8baee6' : 'action.disabledBackground' },
                }}>
                  <ArrowUp className="w-4 h-4" />
                </IconButton>
              )}
            </Box>

            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textAlign: 'center', mt: 0.75 }}>
              {selectedModel} &middot; Enter to send, Shift+Enter for new line
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Delete conversation?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            This will permanently delete this conversation and all messages.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Avatar — 28px, rounded, with a letter initial
// ---------------------------------------------------------------------------

function ChatAvatar({ role }: { role: string }) {
  const isUser = role === 'user';
  return (
    <Box sx={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      bgcolor: isUser ? '#53e16f' : '#8b5cf6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isUser
        ? <User className="w-3.5 h-3.5" style={{ color: '#fff' }} />
        : <Bot className="w-3.5 h-3.5" style={{ color: '#fff' }} />}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MessageRow — clean card style with hover actions
// ---------------------------------------------------------------------------

function MessageRow({
  message,
  isStreaming = false,
  copied,
  onCopy,
}: {
  message: Message;
  isStreaming?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const isUser = message.role === 'user';
  const [hovered, setHovered] = useState(false);
  const monoFont = 'var(--font-mono), "JetBrains Mono", monospace';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Box sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        {/* Assistant model caption (mono kicker) */}
        {!isUser && message.model && (
          <Typography sx={{
            fontSize: '0.625rem', fontFamily: monoFont, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'text.disabled', mb: 0.5, ml: 0.25,
          }}>
            {message.model}
          </Typography>
        )}

        {/* Bubble — user: accent bg + dark text; assistant: surface bg + 1px border */}
        <Box sx={{
          borderRadius: '8px',
          padding: '10px 14px',
          bgcolor: isUser ? '#adc6ff' : '#201f1f',
          color: isUser ? '#131313' : 'text.primary',
          border: isUser ? 'none' : '1px solid',
          borderColor: 'divider',
          fontSize: '0.875rem', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          '& code': {
            fontSize: '0.8rem',
            bgcolor: isUser ? 'rgba(19,19,19,0.12)' : 'rgba(65,71,85,0.25)',
            px: 0.75, py: 0.25, borderRadius: '4px',
            fontFamily: monoFont,
          },
        }}>
          <FormattedContent content={message.content} />
          {isStreaming && (
            <Box component="span" sx={{
              display: 'inline-block', width: '2px', height: '1.1em',
              bgcolor: isUser ? '#131313' : '#adc6ff', ml: '2px', verticalAlign: 'text-bottom',
              animation: 'cBlink 1s step-end infinite',
              '@keyframes cBlink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }} />
          )}
        </Box>

        {/* Action bar — appears on hover */}
        <Box sx={{
          display: 'flex', gap: 0.25, mt: 0.5,
          opacity: hovered && !isStreaming ? 1 : 0,
          transition: 'opacity 0.12s',
        }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
            <IconButton size="small" onClick={onCopy} sx={{
              width: 26, height: 26, borderRadius: '4px',
              color: copied ? '#53e16f' : 'text.disabled',
              '&:hover': { bgcolor: 'rgba(229,226,225,0.06)', color: 'text.primary' },
            }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// FormattedContent — renders markdown-like code blocks
// ---------------------------------------------------------------------------

function FormattedContent({ content }: { content: string }) {
  // Split on code fences ```...```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          // Extract language hint from first line
          const newlineIdx = inner.indexOf('\n');
          const lang = newlineIdx > 0 && newlineIdx < 20 ? inner.slice(0, newlineIdx).trim() : '';
          const code = lang ? inner.slice(newlineIdx + 1) : inner;

          return (
            <Box key={i} sx={{
              my: 1.5, borderRadius: 2, overflow: 'hidden',
              border: '1px solid', borderColor: 'divider',
            }}>
              {/* Code header */}
              {lang && (
                <Box sx={{
                  px: 1.5, py: 0.5,
                  bgcolor: 'rgba(148,163,184,0.06)',
                  borderBottom: '1px solid', borderColor: 'divider',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, textTransform: 'lowercase' }}>
                    {lang}
                  </Typography>
                </Box>
              )}
              {/* Code body */}
              <Box
                component="pre"
                sx={{
                  m: 0, px: 2, py: 1.5,
                  bgcolor: 'rgba(0,0,0,0.2)',
                  overflowX: 'auto',
                  fontSize: '0.84rem', lineHeight: 1.6,
                  fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
                  color: '#e2e8f0',
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(148,163,184,0.15)', borderRadius: 2 },
                }}
              >
                {code}
              </Box>
            </Box>
          );
        }

        // Regular text — render inline code with backticks
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <Typography key={i} component="span" sx={{
            fontSize: 'inherit', lineHeight: 'inherit',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {inlineParts.map((p, j) => {
              if (p.startsWith('`') && p.endsWith('`')) {
                return (
                  <Box key={j} component="code" sx={{
                    fontSize: '0.85rem',
                    bgcolor: 'rgba(148,163,184,0.1)',
                    px: 0.75, py: 0.15, borderRadius: 1,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}>
                    {p.slice(1, -1)}
                  </Box>
                );
              }
              return <span key={j}>{p}</span>;
            })}
          </Typography>
        );
      })}
    </>
  );
}
