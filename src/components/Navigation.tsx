'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const isActive = (path: string) => pathname === path

  const navItems = [
    { href: '/', label: 'Morning', icon: '🌅' },
    { href: '/flashcards', label: 'Flashcards', icon: '🧠' },
    { href: '/clips', label: 'Clips', icon: '📎' },
    { href: '/all-flashcards', label: 'All Flashcards', icon: '📚' },
    { href: '/insights', label: 'Insights', icon: '🎯' },
    { href: '/integrations', label: 'Integrations', icon: '🔌' },
  ]

  return (
    <nav className="bg-[#1A1A1A] border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-white">
              <span className="sm:hidden">FOS</span>
              <span className="hidden sm:inline">FounderOS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive(item.href)
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-neutral-300">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="btn-secondary text-sm px-3 py-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/auth">
                <button className="btn-primary text-sm px-4 py-2">
                  Sign In
                </button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors duration-200"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 fade-slide-in">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'bg-neutral-700 text-white'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Mobile Auth */}
            <div className="mt-4 pt-4 border-t border-neutral-800">
              {user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 text-sm text-neutral-300">
                    {user.email}
                  </div>
                  <button
                    onClick={() => {
                      signOut()
                      setIsOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors duration-200"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              ) : (
                <Link href="/auth" onClick={() => setIsOpen(false)}>
                  <button className="btn-primary w-full text-sm">
                    Sign In
                  </button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}