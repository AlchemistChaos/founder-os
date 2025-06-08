# Linear API Integration Setup

## Overview

FounderOS integrates with Linear using their GraphQL API to automatically sync issues, comments, and project data into your daily entries. This integration runs **automatically twice daily** and provides a manual sync option.

## Automatic Sync Schedule

- **Morning Sync**: 8:30 AM daily
- **Evening Sync**: 9:30 PM daily
- **Manual Sync**: Available via UI button in /integrations

## Quick Setup

1. **Get your Linear API key**:
   - Go to Linear Settings → API → Personal API keys
   - Create a new key with appropriate scopes
   - Copy the key (starts with `lin_api_`)

2. **Add to environment**:
   ```bash
   # Add to your .env.local file
   LINEAR_API_KEY=lin_api_your_key_here
   ```

3. **Test the integration**:
   ```bash
   node test-linear-sync-schedule.js
   ```

4. **Visit the integrations page** at `/integrations` to:
   - See the automatic sync status
   - Use the manual sync button
   - Monitor sync history

## API Endpoints

### Scheduled Sync
- **POST** `/api/integrations/linear/schedule`
  - Runs automatic sync for all users with Linear integrations
  - Called by Vercel cron jobs twice daily
  - Returns sync results for all users

### Manual Sync  
- **POST** `/api/integrations/linear/sync`
  - Triggers immediate sync for specific user
  - Used by the manual sync button
  - Requires `user_id` in request body

### Sync Schedule Info
- **GET** `/api/integrations/linear/schedule`
  - Returns next scheduled sync time
  - Shows sync schedule and timezone info
  - Used by UI to display countdown

### Test Connection
- **GET** `/api/integrations/linear/test`
  - Tests Linear API connection
  - Returns user info and recent issues
  - Useful for debugging

## Data Sync

The integration syncs:

- **Issues**: Title, description, status, priority, assignee
- **Comments**: Issue comments and updates
- **Projects**: Project information and cycles
- **Teams**: Team structure and membership

All data is processed into FounderOS entries with:
- Proper tagging by team and project
- Source URLs for easy navigation back to Linear
- Structured metadata for filtering and search

## UI Features

Visit `/integrations` to access:

1. **Sync Status Card**:
   - Shows if auto-sync is active
   - Displays next sync time
   - Shows last sync timestamp

2. **Manual Sync Button**:
   - Triggers immediate sync
   - Shows sync progress
   - Displays results

3. **Sync History**:
   - View recent sync activity
   - Monitor sync success/failure
   - Track synced item counts

## Production Deployment

For Vercel deployment, cron jobs are automatically configured:

```json
{
  "crons": [
    {
      "path": "/api/integrations/linear/schedule",
      "schedule": "30 8 * * *"
    },
    {
      "path": "/api/integrations/linear/schedule", 
      "schedule": "30 21 * * *"
    }
  ]
}
```

## Local Development

For local testing of scheduled syncs:

```bash
# Test sync schedule info
curl http://localhost:3000/api/integrations/linear/schedule

# Test manual sync  
curl -X POST http://localhost:3000/api/integrations/linear/sync \
  -H "Content-Type: application/json" \
  -d '{"user_id":"your-user-id"}'

# Run comprehensive tests
node test-linear-sync-schedule.js
```

## Troubleshooting

### Sync Not Running
1. Check LINEAR_API_KEY is set
2. Verify user has Linear integration record
3. Check console logs for errors
4. Test API connection manually

### Missing Data
1. Verify API key has correct scopes
2. Check team access permissions
3. Ensure issues exist in date range
4. Review sync logs for filtering

### Schedule Issues
1. Check timezone settings
2. Verify cron job configuration
3. Test schedule endpoint manually
4. Monitor Vercel function logs

## Environment Variables

```bash
# Required
LINEAR_API_KEY=lin_api_your_key_here

# Required for database
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url

# Optional for production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Security Notes

- API keys are stored in environment variables only
- No API keys are committed to git
- Scheduled sync uses service role for database access
- Manual sync requires user authentication
- All synced data respects Linear's permission model 