'use client'

import { useAuth } from '@/components/AuthProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface AuthGuardProps {
  children: React.ReactNode
  message?: string
}

export function AuthGuard({ children, message = 'Please sign in to view this content.' }: AuthGuardProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          <Link href="/auth">
            <Button variant="primary" className="w-full">
              Sign In
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return <>{children}</>
} 