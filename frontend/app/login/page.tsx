'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { Github } from 'lucide-react';
import { API_ORIGIN } from '@/lib/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #131313 0%, #1c1b1b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ maxWidth: 440, width: '100%' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #adc6ff, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem' }}>V</Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Welcome back
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
            Sign in to your VelocityLLM account
          </Typography>
        </Box>

        {/* Form */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: '8px',
            border: '1px solid', borderColor: 'divider',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="you@example.com"
              sx={{ mb: 2.5 }}
            />

            <TextField
              label="Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="••••••••"
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isLoading}
              size="large"
              sx={{ py: 1.5, fontSize: '0.95rem' }}
            >
              {isLoading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Social login (Google/GitHub) temporarily disabled — flip false → true to re-enable */}
          {false && (
          <>
          <Divider sx={{ my: 3, fontSize: '0.8rem', color: 'text.disabled' }}>
            or continue with
          </Divider>

          {/* Social Login */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Button
              variant="outlined"
              href={`${API_ORIGIN}/api/v1/auth/oauth/redirect?provider=github`}
              component="a"
              sx={{
                color: 'text.primary',
                borderColor: 'divider',
                '&:hover': { borderColor: 'divider', backgroundColor: 'background.default' },
                textTransform: 'none',
                py: 1.25,
              }}
              startIcon={<Github className="w-5 h-5" />}
            >
              GitHub
            </Button>
            <Button
              variant="outlined"
              href={`${API_ORIGIN}/api/v1/auth/oauth/redirect?provider=google`}
              component="a"
              sx={{
                color: 'text.primary',
                borderColor: 'divider',
                '&:hover': { borderColor: 'divider', backgroundColor: 'background.default' },
                textTransform: 'none',
                py: 1.25,
              }}
              startIcon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            >
              Google
            </Button>
          </Box>
          </>
          )}

          {/* Sign up link */}
          <Typography sx={{ textAlign: 'center', mt: 3, fontSize: '0.875rem', color: 'text.secondary' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: '#adc6ff', fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </Typography>
        </Paper>

        <Typography sx={{ textAlign: 'center', mt: 3, fontSize: '0.8rem', color: 'text.disabled' }}>
          Production-Grade LLM Inference Engine
        </Typography>
      </Box>
    </Box>
  );
}
