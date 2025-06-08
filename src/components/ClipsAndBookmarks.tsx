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
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">📎 Clips & Bookmarks</h1>
        <p className="text-sm md:text-lg text-gray-600">
          {clips.length} saved items • {typeCounts.flashcard} flashcards
        </p>
      </div>

      {/* Add New Clip */}
      <Card title="Add New Clip">
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-4">
          <Button variant="primary" className="text-xs sm:text-sm">Clip Current Page</Button>
          <Button variant="outline" className="text-xs sm:text-sm">Add Manual Entry</Button>
          <Button variant="outline" className="text-xs sm:text-sm">Import from URL</Button>
          <Button variant="outline" className="text-xs sm:text-sm">Bulk Import</Button>
        </div>
      </Card>

      {/* Filters */}
      <Card title="Filter & Sort">
        <div className="space-y-4">

          {/* Type Filters */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filter by type:</p>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {(Object.keys(typeCounts) as FilterType[]).map((type) => (
                <Button
                  key={type}
                  onClick={() => setFilter(type)}
                  variant={filter === type ? 'primary' : 'outline'}
                  size="sm"
                  className="text-xs sm:text-sm whitespace-nowrap"
                >
                  <span className="mr-1">
                    {type === 'all' ? '📂' : type === 'flashcard' ? '🧠' : getTypeIcon(type)}
                  </span>
                  <span className="hidden sm:inline">{type} </span>
                  ({typeCounts[type]})
                </Button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Filter by tags:</p>
              <div className="flex flex-wrap gap-1">
                {allTags.slice(0, 10).map((tag) => (
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
                {allTags.length > 10 && (
                  <span className="text-xs text-gray-500 px-2 py-1">
                    +{allTags.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sort */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Sort by:</p>
            <div className="grid grid-cols-2 sm:flex gap-2">
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
                  className="text-xs sm:text-sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Clips Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredAndSortedClips.map((clip) => (
          <div key={clip.id} className="cursor-pointer" onClick={() => openClipDetails(clip)}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <div className="space-y-3 md:space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-base md:text-lg flex-shrink-0">{getTypeIcon(clip.type)}</span>
                  <span className="text-xs md:text-sm text-gray-500 truncate">{clip.source_name}</span>
                </div>
                {clip.is_flashcard && (
                  <span className="text-base md:text-lg flex-shrink-0" title="Flashcard">🧠</span>
                )}
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm md:text-base leading-tight">
                  {clip.title}
                </h3>
                {clip.type === 'meeting' && (
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500">
                    {clip.meeting_date && (
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span className="hidden xs:inline">{new Date(clip.meeting_date).toLocaleDateString()}</span>
                      </span>
                    )}
                    {clip.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{clip.duration_minutes}m</span>
                      </span>
                    )}
                    {clip.participants && (
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        <span>{clip.participants.length}</span>
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs md:text-sm text-gray-600 line-clamp-3 mb-3 leading-relaxed">
                  {clip.content}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {clip.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                  {clip.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                      +{clip.tags.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(clip.created_at).toLocaleDateString()}</span>
                  {clip.type === 'meeting' && (
                    <span className="text-blue-600 font-medium">View Details</span>
                  )}
                </div>
              </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {filteredAndSortedClips.length === 0 && (
        <Card className="text-center py-8 md:py-12">
          <div className="text-4xl md:text-6xl mb-4">📎</div>
          <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">No clips found</h3>
          <p className="text-sm md:text-base text-gray-600 mb-4">
            {clips.length === 0 
              ? "Start by adding your first clip or bookmark"
              : "Try adjusting your filters to see more results"
            }
          </p>
          <Button variant="primary" className="text-sm md:text-base">
            Add Your First Clip
          </Button>
        </Card>
      )}

      {/* Modal for clip details */}
      {showModal && selectedClip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 line-clamp-1 pr-4">
                {selectedClip.title}
              </h2>
              <button 
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light flex-shrink-0"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex px-4 md:px-6 overflow-x-auto">
                  {[
                    { id: 'content', label: 'Content', icon: '📄' },
                    { id: 'insights', label: 'Insights', icon: '🧠' },
                    { id: 'actions', label: 'Actions', icon: '⚡' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'content' | 'insights' | 'actions')}
                      className={`flex items-center space-x-2 px-3 md:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-4 md:p-6">
                {activeTab === 'content' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <span>{getTypeIcon(selectedClip.type)}</span>
                        <span className="capitalize">{selectedClip.type}</span>
                      </span>
                      <span>•</span>
                      <span>{selectedClip.source_name}</span>
                      {selectedClip.source_url && (
                        <>
                          <span>•</span>
                          <a 
                            href={selectedClip.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            Open Original
                          </a>
                        </>
                      )}
                    </div>

                    {selectedClip.type === 'meeting' && (
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
                          {selectedClip.meeting_date && (
                            <div>
                              <span className="font-medium text-gray-700">Date:</span>
                              <div className="text-gray-600">{new Date(selectedClip.meeting_date).toLocaleDateString()}</div>
                            </div>
                          )}
                          {selectedClip.duration_minutes && (
                            <div>
                              <span className="font-medium text-gray-700">Duration:</span>
                              <div className="text-gray-600">{selectedClip.duration_minutes} minutes</div>
                            </div>
                          )}
                          {selectedClip.participants && (
                            <div>
                              <span className="font-medium text-gray-700">Participants:</span>
                              <div className="text-gray-600">{selectedClip.participants.length} people</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="prose prose-sm md:prose max-w-none">
                      <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                        {selectedClip.content}
                      </div>
                    </div>

                    {selectedClip.tags && selectedClip.tags.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedClip.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'insights' && (
                  <div className="space-y-4">
                    {selectedClip.type === 'meeting' ? (
                      loadingInsights ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-gray-500 text-sm md:text-base">Generating insights...</p>
                        </div>
                      ) : insights.length > 0 ? (
                        <div className="space-y-4">
                          {insights.map((insight, index) => (
                            <div key={index} className="p-3 md:p-4 bg-amber-50 rounded-lg border border-amber-200">
                              <p className="text-amber-900 text-sm md:text-base font-medium mb-2">{insight.insight_text}</p>
                              <p className="text-amber-800 text-xs md:text-sm">{insight.context}</p>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200">
                                <span className="text-xs text-amber-700">
                                  {insight.category} • {insight.priority} priority
                                </span>
                                <Button size="sm" variant="outline" className="text-xs">
                                  Create Flashcard
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-3xl md:text-4xl mb-4">🧠</div>
                          <p className="text-gray-500 text-sm md:text-base">No AI insights found for this meeting.</p>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-3xl md:text-4xl mb-4">🔍</div>
                        <p className="text-gray-500 text-sm md:text-base">AI insights are only available for meeting clips.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <Button variant="outline" className="text-sm">
                        <span className="mr-2">🧠</span>
                        Create Flashcard
                      </Button>
                      <Button variant="outline" className="text-sm">
                        <span className="mr-2">📝</span>
                        Add Notes
                      </Button>
                      <Button variant="outline" className="text-sm">
                        <span className="mr-2">🏷️</span>
                        Edit Tags
                      </Button>
                      <Button variant="outline" className="text-sm">
                        <span className="mr-2">📤</span>
                        Share
                      </Button>
                      <Button variant="outline" className="text-sm">
                        <span className="mr-2">⭐</span>
                        Bookmark
                      </Button>
                      <Button variant="outline" className="text-sm text-red-600 border-red-300 hover:bg-red-50">
                        <span className="mr-2">🗑️</span>
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}