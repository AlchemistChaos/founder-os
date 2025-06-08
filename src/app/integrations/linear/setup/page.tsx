import { LinearSetupGuide } from '@/components/LinearSetupGuide'

export default function LinearSetupPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <LinearSetupGuide />
    </div>
  )
}

export const metadata = {
  title: 'Linear OAuth Setup Guide - FounderOS',
  description: 'Step-by-step guide to configure Linear integration with OAuth 2.0'
} 