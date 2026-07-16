'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Button from '@mui/material/Button';
import { HelpCircle, BookOpen, MessageCircleQuestion, GraduationCap, Search, ChevronDown, ThumbsUp, Clock, Tag } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const MONO = '"JetBrains Mono", monospace';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const difficultyColor = (d: string) => {
  switch (d) { case 'beginner': return '#22c55e'; case 'intermediate': return '#f59e0b'; case 'advanced': return '#ef4444'; default: return '#6b7280'; }
};

const categoryColor = (c: string) => {
  switch (c) { case 'getting-started': return '#22c55e'; case 'api': return '#4b8eff'; case 'platform': return '#adc6ff'; case 'deployment': return '#f97316'; case 'security': return '#ef4444'; default: return '#6b7280'; }
};

export default function HelpPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({ queryKey: ['help-stats'], queryFn: () => fetcher(`${API}/api/v1/help/stats`) });
  const { data: guidesData } = useQuery({ queryKey: ['help-guides'], queryFn: () => fetcher(`${API}/api/v1/help/guides`), enabled: tab === 0 });
  const { data: faqsData } = useQuery({ queryKey: ['help-faqs'], queryFn: () => fetcher(`${API}/api/v1/help/faqs`), enabled: tab === 1 });
  const { data: tutorialsData } = useQuery({ queryKey: ['help-tutorials'], queryFn: () => fetcher(`${API}/api/v1/help/tutorials`), enabled: tab === 2 });
  const { data: searchData } = useQuery({ queryKey: ['help-search', search], queryFn: () => fetcher(`${API}/api/v1/help/search?q=${encodeURIComponent(search)}`), enabled: search.length >= 2 });

  const voteMut = useMutation({
    mutationFn: (id: string) => fetch(`${API}/api/v1/help/faqs/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['help-faqs'] }),
  });

  const stats = statsData?.data;
  const guides = guidesData?.data?.guides || [];
  const faqs = faqsData?.data?.faqs || [];
  const tutorials = tutorialsData?.data?.tutorials || [];
  const searchResults = searchData?.data;

  const kpis = stats ? [
    { label: 'Guides', value: stats.guides, color: '#4b8eff', icon: BookOpen },
    { label: 'FAQs', value: stats.faqs, color: '#22c55e', icon: MessageCircleQuestion },
    { label: 'Tutorials', value: stats.tutorials, color: '#adc6ff', icon: GraduationCap },
  ] : [];

  return (
    <Box>
      <PageHeader title="Help Center" subtitle="Guides, FAQs, and tutorials to get you started" />

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Grid key={k.label} size={{ xs: 4 }}>
              <Card sx={{ backgroundColor: '#0d1117', border: '1px solid #1e2736', borderLeft: `3px solid ${k.color}` }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ color: k.color, display: 'flex' }}><Icon className="w-3.5 h-3.5" /></Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: MONO, textTransform: 'uppercase' }}>{k.label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO }}>{k.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Search */}
      <Card sx={{ backgroundColor: '#0d1117', border: '1px solid #1e2736', mb: 3 }}>
        <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
          <TextField
            placeholder="Search guides, FAQs, and tutorials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><Box sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}><Search className="w-4 h-4" /></Box></InputAdornment>,
              sx: { fontFamily: MONO, fontSize: '0.8rem', backgroundColor: '#141922', '& fieldset': { borderColor: '#1e2736' } },
            }}
          />
          {searchResults && search.length >= 2 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, mb: 1 }}>{searchResults.total} results for "{search}"</Typography>
              {(searchResults.guides || []).map((g: any) => (
                <Box key={g.id} sx={{ py: 1, px: 1.5, mb: 0.5, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label="Guide" size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: 'rgba(75,142,255,0.15)', color: '#4b8eff' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#e5e2e1', fontFamily: MONO }}>{g.title}</Typography>
                  </Box>
                </Box>
              ))}
              {(searchResults.faqs || []).map((f: any) => (
                <Box key={f.id} sx={{ py: 1, px: 1.5, mb: 0.5, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label="FAQ" size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#e5e2e1', fontFamily: MONO }}>{f.question}</Typography>
                  </Box>
                </Box>
              ))}
              {(searchResults.tutorials || []).map((t: any) => (
                <Box key={t.id} sx={{ py: 1, px: 1.5, mb: 0.5, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label="Tutorial" size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: 'rgba(167,139,250,0.15)', color: '#adc6ff' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#e5e2e1', fontFamily: MONO }}>{t.title}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card sx={{ backgroundColor: '#0d1117', border: '1px solid #1e2736' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #1e2736', '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', minHeight: 42 }, '& .Mui-selected': { color: '#4b8eff' }, '& .MuiTabs-indicator': { backgroundColor: '#4b8eff' } }}>
          <Tab label="Guides" />
          <Tab label="FAQs" />
          <Tab label="Tutorials" />
        </Tabs>

        <CardContent>
          {/* Guides */}
          {tab === 0 && (
            <Grid container spacing={2}>
              {guides.map((g: any) => (
                <Grid key={g.id} size={{ xs: 12, md: selectedGuide === g.id ? 12 : 6 }}>
                  <Box
                    onClick={() => setSelectedGuide(selectedGuide === g.id ? null : g.id)}
                    sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: `1px solid ${selectedGuide === g.id ? '#4b8eff' : '#1e2736'}`, cursor: 'pointer', transition: 'border-color 0.2s', '&:hover': { borderColor: '#4b8eff40' } }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip label={g.category} size="small" sx={{ height: 20, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: `${categoryColor(g.category)}15`, color: categoryColor(g.category) }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}><Clock className="w-3 h-3" /></Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{g.read_time}</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO, mb: 0.5 }}>{g.title}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: MONO, mb: 1 }}>{g.summary}</Typography>
                    {selectedGuide === g.id && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #1e2736' }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontFamily: MONO, lineHeight: 1.8 }}>{g.content}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {(g.tags || []).map((t: string) => (
                        <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: '0.5rem', fontFamily: MONO, backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          {/* FAQs */}
          {tab === 1 && (
            <Box>
              {faqs.sort((a: any, b: any) => b.votes - a.votes).map((f: any) => (
                <Accordion key={f.id} sx={{ backgroundColor: '#141922', border: '1px solid #1e2736', mb: 1, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: '0 0 8px 0' } }}>
                  <AccordionSummary expandIcon={<Box sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}><ChevronDown className="w-4 h-4" /></Box>}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <Box sx={{ color: '#4b8eff', display: 'flex' }}><HelpCircle className="w-4 h-4" /></Box>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO, flex: 1 }}>{f.question}</Typography>
                      <Chip label={f.category} size="small" sx={{ height: 18, fontSize: '0.5rem', fontFamily: MONO, backgroundColor: 'rgba(75,142,255,0.1)', color: '#4b8eff', mr: 1 }} />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: MONO, lineHeight: 1.8, mb: 1.5 }}>{f.answer}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button size="small" startIcon={<ThumbsUp className="w-3 h-3" />} onClick={() => voteMut.mutate(f.id)}
                        sx={{ fontSize: '0.6rem', fontFamily: MONO, textTransform: 'none', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#22c55e' } }}>
                        Helpful ({f.votes})
                      </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}

          {/* Tutorials */}
          {tab === 2 && (
            <Grid container spacing={2}>
              {tutorials.map((t: any) => (
                <Grid key={t.id} size={{ xs: 12, md: selectedTutorial === t.id ? 12 : 6 }}>
                  <Box
                    onClick={() => setSelectedTutorial(selectedTutorial === t.id ? null : t.id)}
                    sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: `1px solid ${selectedTutorial === t.id ? '#adc6ff' : '#1e2736'}`, cursor: 'pointer', transition: 'border-color 0.2s', '&:hover': { borderColor: '#adc6ff40' } }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip label={t.difficulty} size="small" sx={{ height: 20, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: `${difficultyColor(t.difficulty)}15`, color: difficultyColor(t.difficulty) }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}><Clock className="w-3 h-3" /></Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{t.est_time}</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO, mb: 0.5 }}>{t.title}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: MONO, mb: 1 }}>{t.description}</Typography>

                    {selectedTutorial === t.id && t.steps && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #1e2736' }}>
                        {t.steps.map((s: any, i: number) => (
                          <Box key={i} sx={{ mb: 2, pl: 2, borderLeft: '2px solid #1e2736' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b8eff', fontFamily: MONO, mb: 0.5 }}>Step {i + 1}: {s.title}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontFamily: MONO, mb: s.code ? 1 : 0 }}>{s.content}</Typography>
                            {s.code && (
                              <Box sx={{ p: 1.5, backgroundColor: '#0d1117', borderRadius: 1, border: '1px solid #1e2736', mt: 0.5 }}>
                                <Typography component="pre" sx={{ fontSize: '0.65rem', color: '#22c55e', fontFamily: MONO, m: 0, whiteSpace: 'pre-wrap' }}>{s.code}</Typography>
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {(t.tags || []).map((tag: string) => (
                        <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: '0.5rem', fontFamily: MONO, backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
