import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VelocityLLM Dashboard',
  description: 'Real-time monitoring and management for VelocityLLM inference system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/" className="flex items-center px-2 py-2 text-gray-900 hover:text-primary-600 font-semibold">
                  Dashboard
                </Link>
                <Link href="/workers" className="flex items-center px-2 py-2 text-gray-700 hover:text-primary-600 ml-4">
                  Workers
                </Link>
                <Link href="/jobs" className="flex items-center px-2 py-2 text-gray-700 hover:text-primary-600 ml-4">
                  Jobs
                </Link>
                <Link href="/streams" className="flex items-center px-2 py-2 text-gray-700 hover:text-primary-600 ml-4">
                  Streams
                </Link>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}