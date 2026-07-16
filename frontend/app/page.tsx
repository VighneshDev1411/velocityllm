'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import { Zap, Shield, BarChart3, Rocket, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0e0e0e 0%, #131313 50%, #131313 100%)' }}>
      {/* Navbar */}
      <Box
        component="nav"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(28,27,27,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(65,71,85,0.3)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>V</Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                VelocityLLM
              </Typography>
            </Link>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isAuthenticated ? (
                <>
                  <Button component={Link} href="/dashboard" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    Dashboard
                  </Button>
                </>
              ) : (
                <>
                  <Button component={Link} href="/login" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    Login
                  </Button>
                  <Button component={Link} href="/register" variant="contained" size="small">
                    Sign Up
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 10, md: 16 }, pb: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '3.75rem' },
              fontWeight: 800,
              mb: 3,
              color: 'text.primary',
            }}
          >
            VelocityLLM
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              color: 'text.secondary',
              mb: 2,
              fontWeight: 500,
            }}
          >
            Production-Grade LLM Inference Engine
          </Typography>
          <Typography
            sx={{
              fontSize: '1.1rem',
              color: 'text.secondary',
              mb: 5,
              maxWidth: 640,
              mx: 'auto',
              lineHeight: 1.7,
            }}
          >
            High-performance, scalable infrastructure for deploying and managing
            Large Language Models in production environments.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <Button
                component={Link}
                href="/dashboard"
                variant="contained"
                size="large"
                sx={{ px: 5, py: 1.75, fontSize: '1rem', boxShadow: '0 4px 14px 0 rgb(173 198 255 / 0.3)' }}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  component={Link}
                  href="/register"
                  variant="contained"
                  size="large"
                  sx={{ px: 5, py: 1.75, fontSize: '1rem', boxShadow: '0 4px 14px 0 rgb(173 198 255 / 0.3)' }}
                >
                  Get Started Free
                </Button>
                <Button
                  component={Link}
                  href="/login"
                  variant="outlined"
                  size="large"
                  sx={{
                    px: 5,
                    py: 1.75,
                    fontSize: '1rem',
                    borderColor: 'divider',
                    color: 'text.primary',
                    '&:hover': { borderColor: 'divider', backgroundColor: 'background.default' },
                  }}
                >
                  Sign In
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Typography
          variant="h3"
          sx={{
            textAlign: 'center',
            fontWeight: 700,
            color: 'text.primary',
            mb: 8,
            fontSize: { xs: '1.75rem', md: '2.25rem' },
          }}
        >
          Why VelocityLLM?
        </Typography>

        <Grid container spacing={3}>
          {[
            { icon: <Zap className="w-7 h-7" style={{ color: '#adc6ff' }} />, title: 'Lightning Fast', description: 'Optimized inference engine with advanced caching and multi-level optimization strategies.' },
            { icon: <Shield className="w-7 h-7" style={{ color: '#4b8eff' }} />, title: 'Enterprise Security', description: 'JWT authentication, role-based access control, and comprehensive audit logging.' },
            { icon: <BarChart3 className="w-7 h-7" style={{ color: '#53e16f' }} />, title: 'Real-time Monitoring', description: 'Live dashboards with worker metrics, streaming stats, and performance analytics.' },
            { icon: <Rocket className="w-7 h-7" style={{ color: '#ffb595' }} />, title: 'Production Ready', description: 'Built for scale with worker pools, request batching, and intelligent load balancing.' },
          ].map((feature, idx) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={idx}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 600, color: 'text.primary', mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.6 }}>
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features List */}
      <Box sx={{ backgroundColor: 'background.paper', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={8}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'text.primary', mb: 3 }}>
                Advanced Features
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, '& > li + li': { mt: 2 } }}>
                {[
                  'Multi-level caching (L1 memory + L2 Redis)',
                  'Semantic caching with embedding similarity',
                  'Multi-model orchestration & chaining',
                  'Prompt template management & A/B testing',
                  'Context window & token management',
                  'Real-time streaming with SSE',
                ].map((text, idx) => (
                  <Box component="li" key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <CheckCircle className="w-5 h-5" style={{ color: '#53e16f', flexShrink: 0, marginTop: 2 }} />
                    <Typography sx={{ color: 'text.primary', fontSize: '0.95rem' }}>{text}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'text.primary', mb: 3 }}>
                Developer Experience
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, '& > li + li': { mt: 2 } }}>
                {[
                  'RESTful API with comprehensive documentation',
                  'Worker pool with auto-scaling',
                  'Request batching & optimization',
                  'Comprehensive metrics & analytics',
                  'Role-based access control',
                  'Modern React dashboard',
                ].map((text, idx) => (
                  <Box component="li" key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <CheckCircle className="w-5 h-5" style={{ color: '#53e16f', flexShrink: 0, marginTop: 2 }} />
                    <Typography sx={{ color: 'text.primary', fontSize: '0.95rem' }}>{text}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
          py: { xs: 8, md: 10 },
        }}
      >
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, color: '#e5e2e1', mb: 2 }}>
            Ready to Get Started?
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', color: 'rgba(219,234,254,0.9)', mb: 4 }}>
            Deploy production-grade LLM infrastructure in minutes.
          </Typography>
          {!isAuthenticated && (
            <Button
              component={Link}
              href="/register"
              variant="contained"
              size="large"
              sx={{
                px: 5,
                py: 1.75,
                fontSize: '1rem',
                backgroundColor: 'background.paper',
                color: '#adc6ff',
                '&:hover': { backgroundColor: 'action.hover' },
                boxShadow: '0 4px 14px 0 rgb(0 0 0 / 0.15)',
              }}
            >
              Create Free Account
            </Button>
          )}
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          backgroundColor: 'text.primary',
          py: 4,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>
          &copy; 2026 VelocityLLM. Production-Grade LLM Inference Engine.
        </Typography>
      </Box>
    </Box>
  );
}
