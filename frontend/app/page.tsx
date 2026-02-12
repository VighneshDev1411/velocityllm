'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Shield, BarChart3, Rocket, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              VelocityLLM
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Production-Grade LLM Inference Engine
          </p>
          <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
            High-performance, scalable infrastructure for deploying and managing Large Language Models in production environments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg shadow-lg hover:shadow-xl"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-4 bg-white text-gray-800 rounded-lg hover:bg-gray-50 transition font-semibold text-lg border-2 border-gray-200"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
          Why VelocityLLM?
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-blue-600" />}
            title="Lightning Fast"
            description="Optimized inference engine with advanced caching and multi-level optimization strategies."
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-purple-600" />}
            title="Enterprise Security"
            description="JWT authentication, role-based access control, and comprehensive audit logging."
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8 text-green-600" />}
            title="Real-time Monitoring"
            description="Live dashboards with worker metrics, streaming stats, and performance analytics."
          />
          <FeatureCard
            icon={<Rocket className="w-8 h-8 text-orange-600" />}
            title="Production Ready"
            description="Built for scale with worker pools, request batching, and intelligent load balancing."
          />
        </div>
      </div>

      {/* Features List */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Advanced Features
              </h3>
              <ul className="space-y-4">
                <Feature text="Multi-level caching (L1 memory + L2 Redis)" />
                <Feature text="Semantic caching with embedding similarity" />
                <Feature text="Multi-model orchestration & chaining" />
                <Feature text="Prompt template management & A/B testing" />
                <Feature text="Context window & token management" />
                <Feature text="Real-time streaming with SSE" />
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Developer Experience
              </h3>
              <ul className="space-y-4">
                <Feature text="RESTful API with comprehensive documentation" />
                <Feature text="Worker pool with auto-scaling" />
                <Feature text="Request batching & optimization" />
                <Feature text="Comprehensive metrics & analytics" />
                <Feature text="Role-based access control" />
                <Feature text="Modern React dashboard" />
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Deploy production-grade LLM infrastructure in minutes.
          </p>
          {!isAuthenticated && (
            <Link
              href="/register"
              className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-semibold text-lg shadow-lg"
            >
              Create Free Account
            </Link>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2026 VelocityLLM. Production-Grade LLM Inference Engine.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <span className="text-gray-700">{text}</span>
    </li>
  );
}
