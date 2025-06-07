'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Morning Review', icon: '🌅' },
  { href: '/nightly', label: 'Nightly Review', icon: '🌙' },
  { href: '/flashcards', label: 'Flashcards', icon: '🧠' },
  { href: '/clips', label: 'Clips', icon: '📎' },
  { href: '/integrations', label: 'Integrations', icon: '🔗' },
]

export function Navigation() {
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              href="/" 
              className="text-lg md:text-xl font-bold text-gray-900 flex items-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="mr-2">🧠</span>
              <span className="hidden sm:inline">Founder OS</span>
              <span className="sm:hidden">FOS</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:block">
            <div className="flex items-baseline space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-3">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs md:text-sm text-gray-700 hidden md:block max-w-[120px] truncate">
                      {user.email}
                    </span>
                    <button
                      onClick={signOut}
                      className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <span className="md:hidden">👋</span>
                      <span className="hidden md:inline">Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auth"
                    className="px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-md text-base font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile auth info */}
              {user && (
                <div className="px-3 py-3 border-t border-gray-200 mt-2">
                  <div className="text-sm text-gray-500 truncate">
                    Signed in as: {user.email}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}