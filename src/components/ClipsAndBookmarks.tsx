'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface Clip {
  id: string
  title: string
  content: string
  source_url: string
  source_name: string
  tags: string[]
  type: 'article' | 'video' | 'tweet' | 'document' | 'note' | 'meeting'
  is_flashcard: boolean
  created_at: string
  thumbnail?: string
  // Meeting-specific fields
  participants?: Array<{name: string, email?: string}>
  duration_minutes?: number
  meeting_date?: string
  action_items?: string[]
  keywords?: string[]
}

type FilterType = 'all' | 'article' | 'video' | 'tweet' | 'document' | 'note' | 'meeting' | 'flashcard'
type SortType = 'newest' | 'oldest' | 'title' | 'source'

export function ClipsAndBookmarks() {
  const [clips, setClips] = useState<Clip[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('newest')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [insights, setInsights] = useState<any[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [activeTab, setActiveTab] = useState<'insights' | 'transcript'>('insights')

  useEffect(() => {
    // Fetch real meetings data
    const fetchMeetings = async () => {
      try {
        // Get auth headers similar to other components
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          console.log('No authentication session found for clips')
          setClips([])
          return
        }

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }

        const response = await fetch('/api/meetings', { headers })
        
        if (response.ok) {
          const data = await response.json()
          // Convert meetings to clips format
          const meetingClips = data.meetings?.map((meeting: any) => ({
            id: meeting.id,
            title: meeting.title,
            content: meeting.overview || 'Meeting overview not available',
            source_url: meeting.meeting_url || '#',
            source_name: meeting.source || 'Fireflies',
            tags: meeting.tags || ['meeting'],
            type: 'meeting' as const,
            is_flashcard: false,
            created_at: meeting.meeting_date,
            participants: meeting.participants || [],
            duration_minutes: meeting.duration_minutes,
            meeting_date: meeting.meeting_date,
            action_items: meeting.action_items || [],
            keywords: meeting.keywords || []
          })) || []
          
          setClips(meetingClips)
        }
      } catch (error) {
        console.error('Error fetching meetings:', error)
        setClips([])
      }
    }
    
    fetchMeetings()
  }, [])

  const filteredAndSortedClips = clips
    .filter(clip => {
      // Filter by type
      if (filter !== 'all') {
        if (filter === 'flashcard' && !clip.is_flashcard) return false
        if (filter !== 'flashcard' && clip.type !== filter) return false
      }
      
      // Filter by selected tags
      if (selectedTags.length > 0) {
        return selectedTags.every(tag => clip.tags.includes(tag))
      }
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        case 'source':
          return a.source_name.localeCompare(b.source_name)
        default:
          return 0
      }
    })

  const allTags = Array.from(new Set(clips.flatMap(clip => clip.tags)))
  const typeCounts = {
    all: clips.length,
    article: clips.filter(c => c.type === 'article').length,
    video: clips.filter(c => c.type === 'video').length,
    tweet: clips.filter(c => c.type === 'tweet').length,
    document: clips.filter(c => c.type === 'document').length,
    note: clips.filter(c => c.type === 'note').length,
    meeting: clips.filter(c => c.type === 'meeting').length,
    flashcard: clips.filter(c => c.is_flashcard).length
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return '📄'
      case 'video': return '🎥'
      case 'tweet': return '🐦'
      case 'document': return '📋'
      case 'note': return '📝'
      case 'meeting': return '🎙️'
      default: return '📎'
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const openClipDetails = async (clip: Clip) => {
    setSelectedClip(clip)
    setShowModal(true)
    setActiveTab('insights')
    setInsights([])
    
    // Generate insights for meetings
    if (clip.type === 'meeting') {
      setLoadingInsights(true)
      try {
        // Get auth headers
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          console.log('No authentication session found for insights')
          setLoadingInsights(false)
          return
        }

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }

        const response = await fetch(`/api/meetings/${clip.id}/insights`, { headers })
        
        if (response.ok) {
          const data = await response.json()
          setInsights(data.insights || [])
        }
      } catch (error) {
        console.error('Error fetching insights:', error)
      } finally {
        setLoadingInsights(false)
      }
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedClip(null)
    setInsights([])
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📎 Clips & Bookmarks</h1>
        <p className="text-lg text-gray-600">
          {clips.length} saved items • {typeCounts.flashcard} flashcards
        </p>
      </div>

      {/* Add New Clip */}
      <Card title="Add New Clip">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="primary">Clip Current Page</Button>
          <Button variant="outline">Add Manual Entry</Button>
          <Button variant="outline">Import from URL</Button>
          <Button variant="outline">Bulk Import</Button>
        </div>
      </Card>

      {/* Filters */}
      <Card title="Filter & Sort">
        <div className="space-y-4">

          {/* Type Filters */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filter by type:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(typeCounts) as FilterType[]).map((type) => (
                <Button
                  key={type}
                  onClick={() => setFilter(type)}
                  variant={filter === type ? 'primary' : 'outline'}
                  size="sm"
                >
                  {type === 'all' ? '📂' : type === 'flashcard' ? '🧠' : getTypeIcon(type)} {type} ({typeCounts[type]})
                </Button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filter by tags:</p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Sort by:</p>
            <div className="flex gap-2">
              {[
                { value: 'newest' as SortType, label: 'Newest' },
                { value: 'oldest' as SortType, label: 'Oldest' },
                { value: 'title' as SortType, label: 'Title' },
                { value: 'source' as SortType, label: 'Source' }
              ].map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  variant={sortBy === option.value ? 'primary' : 'outline'}
                  size="sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Clips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedClips.map((clip) => (
          <div key={clip.id} className="cursor-pointer" onClick={() => openClipDetails(clip)}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getTypeIcon(clip.type)}</span>
                  <span className="text-sm text-gray-500">{clip.source_name}</span>
                </div>
                {clip.is_flashcard && (
                  <span className="text-lg" title="Flashcard">🧠</span>
                )}
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {clip.title}
                </h3>
                {clip.type === 'meeting' && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                    {clip.meeting_date && (
                      <span>📅 {new Date(clip.meeting_date).toLocaleDateString()}</span>
                    )}
                    {clip.duration_minutes && (
                      <span>⏱️ {clip.duration_minutes}m</span>
                    )}
                    {clip.participants && (
                      <span>👥 {clip.participants.length}</span>
                    )}
                  </div>
                )}
                <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                  {clip.content}
                </p>
                {clip.type === 'meeting' && clip.participants && clip.participants.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Attendees:</p>
                    <div className="flex flex-wrap gap-1">
                      {clip.participants.slice(0, 3).map((participant, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {participant.name}
                        </span>
                      ))}
                      {clip.participants.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                          +{clip.participants.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {clip.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  {new Date(clip.created_at).toLocaleDateString()}
                </span>
                <div className="flex space-x-1">
                  {clip.source_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(clip.source_url, '_blank')}
                    >
                      🔗
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    ✏️
                  </Button>
                </div>
              </div>
            </div>
            </Card>
          </div>
        ))}
      </div>

      {filteredAndSortedClips.length === 0 && (
        <div className="text-center py-12">
          <p className="text-xl text-gray-500 mb-4">No clips found</p>
          <p className="text-gray-400">Try adjusting your filters</p>
        </div>
      )}

      {/* Bulk Actions */}
      {filteredAndSortedClips.length > 0 && (
        <Card title="Bulk Actions">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">Select All</Button>
            <Button variant="outline" size="sm">Add Tags to Selected</Button>
            <Button variant="outline" size="sm">Export Selected</Button>
            <Button variant="outline" size="sm">Delete Selected</Button>
          </div>
        </Card>
      )}

      {/* Meeting Details Modal */}
      {showModal && selectedClip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedClip.title}</h2>
                {selectedClip.type === 'meeting' && (
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>📅 {new Date(selectedClip.meeting_date!).toLocaleDateString()}</span>
                    <span>⏱️ {selectedClip.duration_minutes} min</span>
                    <span>👥 {selectedClip.participants?.length || 0} participants</span>
                    <span>📡 {selectedClip.source_name}</span>
                  </div>
                )}
              </div>
              <Button onClick={closeModal} variant="outline" size="sm">✕</Button>
            </div>

            {/* Participants */}
            {selectedClip.type === 'meeting' && selectedClip.participants && selectedClip.participants.length > 0 && (
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900 mb-2">Participants</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedClip.participants.map((participant, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {participant.name}
                      {participant.email && <span className="text-blue-600 ml-1">({participant.email})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            {selectedClip.type === 'meeting' && (
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'insights'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🔍 Key Insights
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'transcript'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📄 Full Content
                </button>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedClip.type === 'meeting' && activeTab === 'insights' && (
                <div>
                  {loadingInsights ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">Generating insights...</p>
                    </div>
                  ) : insights.length > 0 ? (
                    <div className="space-y-4">
                      {insights.map((insight, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-start justify-between mb-2">
                            <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full capitalize">
                              {insight.category}
                            </span>
                          </div>
                          <p className="text-gray-900 font-medium mb-2">{insight.insight}</p>
                          <p className="text-sm text-gray-600">{insight.relevance}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">No insights generated for this meeting.</p>
                    </div>
                  )}
                </div>
              )}

              {selectedClip.type === 'meeting' && activeTab === 'transcript' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Overview</h3>
                    <p className="text-gray-700 leading-relaxed">{selectedClip.content}</p>
                  </div>
                  
                  {selectedClip.action_items && selectedClip.action_items.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Action Items</h3>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700">
                          {Array.isArray(selectedClip.action_items) 
                            ? selectedClip.action_items.join('\n') 
                            : selectedClip.action_items
                          }
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedClip.keywords && selectedClip.keywords.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedClip.keywords.map((keyword, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedClip.type !== 'meeting' && (
                <div>
                  <p className="text-gray-700 leading-relaxed">{selectedClip.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}