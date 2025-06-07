import { refreshAccessToken, updateIntegrationTokens } from './auth'
import { processIntegrationData } from './jobs'
import { GoogleDriveEvent, IntegrationData, SyncJob } from './types'

interface GoogleFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  createdTime: string
  webViewLink: string
  owners: Array<{
    displayName: string
    emailAddress: string
  }>
  lastModifyingUser: {
    displayName: string
    emailAddress: string
  }
  size?: string
  version?: string
}

interface GoogleDriveResponse {
  files: GoogleFile[]
  nextPageToken?: string
  incompleteSearch?: boolean
}

interface GoogleDocContent {
  title: string
  body: {
    content: Array<{
      paragraph?: {
        elements: Array<{
          textRun?: {
            content: string
          }
        }>
      }
    }>
  }
}

export async function makeGoogleAPICall(
  endpoint: string,
  accessToken: string,
  params: Record<string, any> = {}
): Promise<any> {
  const url = new URL(`https://www.googleapis.com/drive/v3/${endpoint}`)
  
  // Add parameters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function makeGoogleDocsAPICall(
  endpoint: string,
  accessToken: string,
  params: Record<string, any> = {}
): Promise<any> {
  const url = new URL(`https://docs.googleapis.com/v1/${endpoint}`)
  
  // Add parameters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(`Google Docs API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function getGoogleDriveFiles(
  accessToken: string,
  pageToken?: string,
  modifiedSince?: string
): Promise<{ files: GoogleFile[], nextPageToken?: string }> {
  const params: any = {
    pageSize: 100,
    fields: 'files(id,name,mimeType,modifiedTime,createdTime,webViewLink,owners,lastModifyingUser,size,version),nextPageToken',
    orderBy: 'modifiedTime desc'
  }

  if (pageToken) {
    params.pageToken = pageToken
  }

  // Filter for documents and recently modified files
  let q = "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation')"
  
  if (modifiedSince) {
    q += ` and modifiedTime > '${modifiedSince}'`
  }
  
  params.q = q

  const response: GoogleDriveResponse = await makeGoogleAPICall('files', accessToken, params)
  
  return {
    files: response.files,
    nextPageToken: response.nextPageToken
  }
}

export async function getGoogleDocContent(
  accessToken: string,
  documentId: string
): Promise<string> {
  try {
    const doc: GoogleDocContent = await makeGoogleDocsAPICall(
      `documents/${documentId}`,
      accessToken
    )

    // Extract text content from the document structure
    let content = doc.title + '\n\n'
    
    if (doc.body && doc.body.content) {
      for (const element of doc.body.content) {
        if (element.paragraph && element.paragraph.elements) {
          for (const textElement of element.paragraph.elements) {
            if (textElement.textRun && textElement.textRun.content) {
              content += textElement.textRun.content
            }
          }
        }
      }
    }

    return content.trim()
  } catch (error) {
    console.error(`Error fetching document content for ${documentId}:`, error)
    return '' // Return empty string if can't fetch content
  }
}

export async function getFileRevisions(
  accessToken: string,
  fileId: string
): Promise<any[]> {
  try {
    const response = await makeGoogleAPICall(
      `files/${fileId}/revisions`,
      accessToken,
      {
        fields: 'revisions(id,modifiedTime,lastModifyingUser)'
      }
    )
    
    return response.revisions || []
  } catch (error) {
    console.error(`Error fetching revisions for ${fileId}:`, error)
    return []
  }
}

export async function processGoogleFile(
  file: GoogleFile,
  accessToken: string
): Promise<IntegrationData> {
  let content = `Document: ${file.name}`
  
  // Get document content for Google Docs
  if (file.mimeType === 'application/vnd.google-apps.document') {
    const docContent = await getGoogleDocContent(accessToken, file.id)
    if (docContent) {
      content = docContent
    }
  }

  // Determine file type for tagging
  let fileType = 'document'
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    fileType = 'spreadsheet'
  } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
    fileType = 'presentation'
  }

  const tags = [
    'google',
    'docs',
    fileType,
    ...(file.owners[0]?.displayName ? [file.owners[0].displayName.toLowerCase().replace(/\s+/g, '-')] : [])
  ]

  return {
    id: `google_${file.id}`,
    type: 'doc',
    content,
    source_url: file.webViewLink,
    source_name: `Google ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`,
    metadata: {
      file_id: file.id,
      mime_type: file.mimeType,
      file_type: fileType,
      created_time: file.createdTime,
      modified_time: file.modifiedTime,
      size: file.size,
      version: file.version,
      owners: file.owners,
      last_modifying_user: file.lastModifyingUser
    },
    timestamp: file.modifiedTime,
    author: file.lastModifyingUser?.displayName || file.owners[0]?.displayName || 'Unknown',
    tags
  }
}

export async function processGoogleSync(job: SyncJob, integration: any): Promise<void> {
  try {
    let accessToken = integration.access_token

    // Check if token needs refresh
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at)
      const now = new Date()
      
      // Refresh token if it expires within 5 minutes
      if (expiresAt <= new Date(now.getTime() + 5 * 60000) && integration.refresh_token) {
        try {
          const tokenData = await refreshAccessToken('google', integration.refresh_token)
          await updateIntegrationTokens(integration.id, tokenData)
          accessToken = tokenData.access_token
        } catch (error) {
          console.error('Error refreshing Google token:', error)
          throw new Error('Failed to refresh Google token')
        }
      }
    }

    // For incremental sync, use last sync timestamp
    const modifiedSince = job.job_type === 'incremental_sync' && integration.last_sync_at
      ? integration.last_sync_at
      : undefined

    const syncStartTime = new Date().toISOString()
    let processedCount = 0
    let pageToken = job.job_type === 'incremental_sync' ? integration.sync_cursor : undefined
    let hasMore = true

    while (hasMore) {
      try {
        const { files, nextPageToken } = await getGoogleDriveFiles(
          accessToken,
          pageToken,
          modifiedSince
        )

        for (const file of files) {
          try {
            const integrationData = await processGoogleFile(file, accessToken)
            await processIntegrationData(integrationData, integration.user_id)
            processedCount++
          } catch (error) {
            console.error(`Error processing Google file ${file.name}:`, error)
            // Continue processing other files
          }
        }

        pageToken = nextPageToken
        hasMore = !!nextPageToken

        // Rate limiting: pause between requests
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error('Error fetching Google Drive files:', error)
        break
      }
    }

    // Update integration sync status
    const { createClient } = await import('@supabase/supabase-js')
    const { Database } = await import('@/lib/database.types')
    
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabaseAdmin
      .from('integrations')
      .update({
        last_sync_at: syncStartTime,
        sync_cursor: pageToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    console.log(`Google sync completed. Processed ${processedCount} files.`)

  } catch (error) {
    console.error('Error in Google sync:', error)
    throw error
  }
}

export async function setupGoogleDriveWatch(
  accessToken: string,
  channelId: string,
  webhookUrl: string
): Promise<any> {
  const response = await fetch('https://www.googleapis.com/drive/v3/changes/watch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      payload: true
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to set up Google Drive watch: ${response.statusText}`)
  }

  return response.json()
}

export async function handleGoogleDriveWebhook(
  event: GoogleDriveEvent,
  integration: any
): Promise<void> {
  try {
    // Get the changed file details
    const fileId = event.resourceId.replace('file:', '')
    
    const file: GoogleFile = await makeGoogleAPICall(
      `files/${fileId}`,
      integration.access_token,
      {
        fields: 'id,name,mimeType,modifiedTime,createdTime,webViewLink,owners,lastModifyingUser,size,version'
      }
    )

    const integrationData = await processGoogleFile(file, integration.access_token)
    
    // Add webhook-specific metadata
    integrationData.metadata.webhook_event = event
    integrationData.tags.push('webhook')

    await processIntegrationData(integrationData, integration.user_id)
    
    console.log(`Processed Google Drive webhook event for file: ${file.name}`)
  } catch (error) {
    console.error('Error processing Google Drive webhook event:', error)
    throw error
  }
}