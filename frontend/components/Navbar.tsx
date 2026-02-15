'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { LogOut, User } from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  // Don't show navbar on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  // Public landing page navbar
  if (pathname === '/') {
    return (
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  VelocityLLM
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition"
                  >
                    <User className="w-4 h-4" />
                    {user?.username}
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Dashboard navbar (protected routes)
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              href="/dashboard"
              className="flex items-center px-2 py-2 text-gray-900 hover:text-blue-600 font-semibold"
            >
              Dashboard
            </Link>
            <Link
              href="/workers"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Workers
            </Link>
            <Link
              href="/jobs"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Jobs
            </Link>
            <Link
              href="/streams"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Streams
            </Link>
            <Link
              href="/tokens"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Tokens
            </Link>
            <Link
              href="/playground"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Playground
            </Link>
            <Link
              href="/monitoring"
              className="flex items-center px-2 py-2 text-gray-700 hover:text-blue-600 ml-4"
            >
              Monitoring
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{user?.username || 'Profile'}</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
