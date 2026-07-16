'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import {
  Zap, Shield, BarChart3, Rocket, ArrowRight, Activity, Layers, GitBranch,
} from 'lucide-react';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

// ── Small building blocks ──────────────────────────────────────────────────

function Eyebrow({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Typography sx={{
      fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.2em',
      textTransform: 'uppercase', color: 'primary.main', ...sx,
    }}>
      {children}
    </Typography>
  );
}

// A mock "console preview" card built from the real design tokens — the hero visual.
function ConsolePreview() {
  const stats = [
    { label: 'Requests', value: '12.4K', sub: '4.20 req/s', accent: '#adc6ff' },
    { label: 'Avg latency', value: '184ms', sub: 'P99 640ms', accent: '#53e16f' },
    { label: 'Error rate', value: '0.42%', sub: '12 errors', accent: '#ffb595' },
  ];
  const mix = [
    { name: 'gpt-4', pct: 52, color: '#adc6ff' },
    { name: 'claude-3-opus', pct: 33, color: '#53e16f' },
    { name: 'llama-3-70b', pct: 15, color: '#ffb595' },
  ];
  return (
    <Paper elevation={0} sx={{
      borderRadius: '12px', overflow: 'hidden', border: '1px solid',
      borderColor: 'rgba(65,71,85,0.3)', bgcolor: '#131313',
      boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    }}>
      {/* window bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25,
        borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#1c1b1b',
      }}>
        {['#ef4444', '#ffb595', '#53e16f'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, opacity: 0.8 }} />
        ))}
        <Typography sx={{ ml: 1, fontFamily: MONO, fontSize: '0.7rem', color: 'text.disabled' }}>
          velocityllm — dashboard
        </Typography>
      </Box>

      <Box sx={{ p: 2.5 }}>
        {/* stat tiles */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
          {stats.map((s) => (
            <Box key={s.label} sx={{
              p: 1.75, borderRadius: '8px', bgcolor: '#201f1f',
              boxShadow: `inset 3px 0 0 0 ${s.accent}`,
            }}>
              <Typography sx={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: '1.25rem', fontWeight: 700, color: 'text.primary', mt: 0.25 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: '0.625rem', color: 'rgba(229,226,225,0.4)' }}>
                {s.sub}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* model mix */}
        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: '#201f1f', border: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
            Model mix
          </Typography>
          {mix.map((m) => (
            <Box key={m.name} sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{m.name}</Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: '0.7rem', color: 'text.secondary' }}>{m.pct}%</Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: '4px', bgcolor: 'rgba(65,71,85,0.2)', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${m.pct}%`, bgcolor: m.color, borderRadius: '4px' }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const heroCtas = isAuthenticated ? (
    <Button component={Link} href="/dashboard" variant="contained" size="large"
      endIcon={<ArrowRight className="w-4 h-4" />}
      sx={{ px: 4, height: 48, fontSize: '0.95rem', boxShadow: '0 4px 14px 0 rgb(173 198 255 / 0.3)' }}>
      Go to dashboard
    </Button>
  ) : (
    <>
      <Button component={Link} href="/register" variant="contained" size="large"
        endIcon={<ArrowRight className="w-4 h-4" />}
        sx={{ px: 4, height: 48, fontSize: '0.95rem', boxShadow: '0 4px 14px 0 rgb(173 198 255 / 0.3)' }}>
        Get started free
      </Button>
      <Button component={Link} href="/login" variant="outlined" size="large"
        sx={{ px: 4, height: 48, fontSize: '0.95rem' }}>
        Sign in
      </Button>
    </>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#131313', position: 'relative', overflowX: 'hidden' }}>
      {/* ambient glow */}
      <Box sx={{
        position: 'absolute', top: -240, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 600, pointerEvents: 'none',
        background: 'radial-gradient(closest-side, rgba(173,198,255,0.14), transparent)',
      }} />

      {/* ─── Nav ─── */}
      <Box component="nav" sx={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: 'rgba(19,19,19,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Box sx={{
                width: 30, height: 30, borderRadius: '6px',
                background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ color: '#131313', fontWeight: 800, fontSize: '0.85rem', fontFamily: MONO }}>V</Typography>
              </Box>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>
                VelocityLLM
              </Typography>
            </Link>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isAuthenticated ? (
                <Button component={Link} href="/dashboard" variant="contained" size="small">Dashboard</Button>
              ) : (
                <>
                  <Button component={Link} href="/login" sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                    Login
                  </Button>
                  <Button component={Link} href="/register" variant="contained" size="small">Sign up</Button>
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ─── Hero ─── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 13 }, pb: { xs: 6, md: 9 }, position: 'relative' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 820, mx: 'auto' }}>
          <Eyebrow sx={{ mb: 2.5 }}>Production-grade LLM inference</Eyebrow>
          <Typography variant="h1" sx={{
            fontSize: { xs: '2.75rem', md: '4rem' }, fontWeight: 800, lineHeight: 1.05,
            letterSpacing: '-0.04em', mb: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #adc6ff 60%, #4b8eff 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Ship LLM apps that stay fast under load
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.05rem', md: '1.2rem' }, color: 'text.secondary',
            maxWidth: 620, mx: 'auto', lineHeight: 1.7, mb: 4.5,
          }}>
            A high-performance inference engine with multi-level caching, real-time streaming,
            model routing, and full observability — built to run in production.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            {heroCtas}
          </Box>

          {/* stats strip (mono data) */}
          <Box sx={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: { xs: 3, md: 6 },
            mt: 6,
          }}>
            {[
              { v: '640', u: ' req/s', l: 'Sustained throughput' },
              { v: '184', u: 'ms', l: 'P99 latency' },
              { v: '99.9', u: '%', l: 'Uptime' },
              { v: '0.4', u: '%', l: 'Error rate' },
            ].map((s) => (
              <Box key={s.l} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontFamily: MONO, fontSize: '1.5rem', fontWeight: 700, color: 'text.primary' }}>
                  {s.v}<Box component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>{s.u}</Box>
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>{s.l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* console preview */}
        <Box sx={{ maxWidth: 720, mx: 'auto', mt: { xs: 6, md: 8 } }}>
          <ConsolePreview />
        </Box>
      </Container>

      {/* ─── Features ─── */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Eyebrow sx={{ mb: 1.5 }}>Why VelocityLLM</Eyebrow>
          <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.25rem' }, letterSpacing: '-0.02em' }}>
            Everything you need to run models in production
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {[
            { icon: <Zap className="w-6 h-6" style={{ color: '#adc6ff' }} />, accent: '#adc6ff', title: 'Lightning fast', description: 'Multi-level caching (L1 memory + L2 Redis) and semantic caching cut latency and cost on repeat traffic.' },
            { icon: <Shield className="w-6 h-6" style={{ color: '#4b8eff' }} />, accent: '#4b8eff', title: 'Enterprise security', description: 'JWT auth, role-based access control, API keys, and comprehensive audit logging out of the box.' },
            { icon: <BarChart3 className="w-6 h-6" style={{ color: '#53e16f' }} />, accent: '#53e16f', title: 'Real-time monitoring', description: 'Live dashboards for throughput, latency percentiles, cost, and per-model traffic.' },
            { icon: <Rocket className="w-6 h-6" style={{ color: '#ffb595' }} />, accent: '#ffb595', title: 'Built for scale', description: 'Worker pools, request batching, backpressure, and intelligent load balancing.' },
            { icon: <Layers className="w-6 h-6" style={{ color: '#adc6ff' }} />, accent: '#adc6ff', title: 'Model routing', description: 'Route and chain across GPT-4, Claude, and Llama with fallbacks and conditional steps.' },
            { icon: <Activity className="w-6 h-6" style={{ color: '#53e16f' }} />, accent: '#53e16f', title: 'Real-time streaming', description: 'Token-by-token responses over SSE and WebSockets with graceful cancellation.' },
            { icon: <GitBranch className="w-6 h-6" style={{ color: '#ffb595' }} />, accent: '#ffb595', title: 'Prompt management', description: 'Versioned prompt templates with A/B testing and context-window management.' },
            { icon: <Shield className="w-6 h-6" style={{ color: '#4b8eff' }} />, accent: '#4b8eff', title: 'Full observability', description: 'Health probes, metrics collection, and request-level tracing across the cluster.' },
          ].map((f, idx) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={idx}>
              <Paper elevation={0} sx={{
                p: 3, height: '100%', borderRadius: '8px',
                border: '1px solid', borderColor: 'divider',
                boxShadow: `inset 3px 0 0 0 ${f.accent}`,
                transition: 'background-color 0.2s ease',
                '&:hover': { backgroundColor: '#2a2a2a' },
              }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '8px', mb: 1.75,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid', borderColor: 'divider',
                }}>
                  {f.icon}
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.primary', mb: 0.75 }}>
                  {f.title}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
                  {f.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── Code / quickstart ─── */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
        <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Eyebrow sx={{ mb: 1.5 }}>Quickstart</Eyebrow>
            <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.6rem', md: '2rem' }, letterSpacing: '-0.02em', mb: 2 }}>
              One endpoint. Any model.
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', color: 'text.secondary', lineHeight: 1.7, mb: 3 }}>
              Send a prompt and stream the response. Caching, routing, and metrics are handled
              for you — no extra wiring.
            </Typography>
            <Button component={Link} href="/register" variant="outlined" endIcon={<ArrowRight className="w-4 h-4" />}>
              Start building
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper elevation={0} sx={{
              borderRadius: '8px', border: '1px solid', borderColor: 'divider',
              bgcolor: '#0e0e0e', overflow: 'hidden',
            }}>
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#1c1b1b' }}>
                <Typography sx={{ fontFamily: MONO, fontSize: '0.7rem', color: 'text.disabled' }}>request.sh</Typography>
              </Box>
              <Box component="pre" sx={{
                m: 0, p: 2.5, fontFamily: MONO, fontSize: '0.8rem', lineHeight: 1.8,
                color: 'text.secondary', overflowX: 'auto',
              }}>
{`curl `}<Box component="span" sx={{ color: 'text.primary' }}>https://api.velocityllm.dev/v1/chat</Box>{` \\
  -H `}<Box component="span" sx={{ color: '#53e16f' }}>{`"Authorization: Bearer $KEY"`}</Box>{` \\
  -d `}<Box component="span" sx={{ color: '#ffb595' }}>{`'{ "model": "gpt-4", "stream": true,
       "message": "Summarize the load test." }'`}</Box>{`

`}<Box component="span" sx={{ color: 'text.disabled' }}>{`# → streams tokens · X-Cache: HIT on repeats`}</Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* ─── CTA band ─── */}
      {/* <Box sx={{ background: 'linear-gradient(135deg, #adc6ff, #4b8eff)', py: { xs: 7, md: 9 } }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, color: '#131313', mb: 1.5, letterSpacing: '-0.02em' }}>
            Ready to get started?
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', color: 'rgba(19,19,19,0.72)', mb: 3.5 }}>
            Deploy production-grade LLM infrastructure in minutes.
          </Typography>
          {!isAuthenticated && (
            <Button component={Link} href="/register" variant="contained" size="large"
              endIcon={<ArrowRight className="w-4 h-4" />}
              sx={{ px: 4, height: 48, fontSize: '0.95rem', backgroundColor: '#131313', color: '#e5e2e1', '&:hover': { backgroundColor: '#201f1f' } }}>
              Create free account
            </Button>
          )}
        </Container>
      </Box> */}

      {/* ─── Footer ─── */}
      <Box component="footer" sx={{ bgcolor: '#0e0e0e', borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Grid container spacing={{ xs: 5, md: 6 }}>
            {/* Brand */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '6px', background: 'linear-gradient(135deg, #adc6ff, #4b8eff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#131313', fontWeight: 800, fontSize: '0.8rem', fontFamily: MONO }}>V</Typography>
                </Box>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>VelocityLLM</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.7, maxWidth: 300, mb: 2.5 }}>
                Production-grade LLM inference — caching, routing, streaming, and full observability in one engine.
              </Typography>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5,
                borderRadius: '2px', bgcolor: 'rgba(83,225,111,0.1)', border: '1px solid rgba(83,225,111,0.2)',
              }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#53e16f',
                  animation: 'fpulse 2s infinite', '@keyframes fpulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                <Typography sx={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.15em', color: '#53e16f', textTransform: 'uppercase' }}>
                  All systems operational
                </Typography>
              </Box>
            </Grid>

            {/* Link columns */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={4}>
                {[
                  { title: 'Product', links: [['Dashboard', '/dashboard'], ['Playground', '/playground'], ['Chat', '/chat'], ['API Keys', '/keys']] },
                  { title: 'Developers', links: [['API Docs', '/docs'], ['System Status', '/status'], ['Help Center', '/help']] },
                  { title: 'Account', links: [['Sign in', '/login'], ['Create account', '/register']] },
                ].map((col) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={col.title}>
                    <Typography sx={{
                      fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                      color: 'text.disabled', mb: 2,
                    }}>
                      {col.title}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      {col.links.map(([label, href]) => (
                        <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                          <Typography sx={{
                            fontSize: '0.85rem', color: 'text.secondary', transition: 'color 0.15s',
                            '&:hover': { color: 'primary.main' },
                          }}>
                            {label}
                          </Typography>
                        </Link>
                      ))}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>

        {/* Bottom bar */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <Container maxWidth="lg" sx={{ py: 2.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontFamily: MONO, color: 'text.disabled', fontSize: '0.75rem' }}>
                © 2026 VelocityLLM · Production-grade LLM inference
              </Typography>
              <Box sx={{ display: 'flex', gap: 3 }}>
                {[['Status', '/status'], ['Docs', '/docs'], ['Help', '/help']].map(([label, href]) => (
                  <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                      {label}
                    </Typography>
                  </Link>
                ))}
              </Box>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
