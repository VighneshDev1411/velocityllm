'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthFromTokens } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const provider = searchParams.get('provider');
    const action = searchParams.get('action');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }

    if (!accessToken || !refreshToken) {
      setStatus('error');
      setMessage('Missing authentication tokens');
      return;
    }

    // Use auth context to store tokens AND update React state
    setAuthFromTokens(accessToken, refreshToken)
      .then(() => {
        setStatus('success');
        const providerName = provider === 'github' ? 'GitHub' : 'Google';
        setMessage(
          action === 'register'
            ? `Account created with ${providerName}!`
            : `Signed in with ${providerName}!`
        );
        setTimeout(() => router.push('/dashboard'), 800);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Failed to complete authentication');
      });
  }, [searchParams, router, setAuthFromTokens]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-900 font-semibold">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-900 font-semibold">Authentication Failed</p>
            <p className="text-sm text-red-600 mt-2">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
