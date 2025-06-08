# Linear API Integration Setup Guide

This guide shows you how to set up Linear integration using the **API approach** (much simpler than webhooks!).

## ✅ Why API Instead of Webhooks?

- **Much simpler**: No public URLs needed
- **Easier development**: Test locally without ngrok
- **Better control**: You decide when to sync data
- **Simpler debugging**: Standard API calls instead of webhook security

## Step 1: Add Your API Key

Add this to your `.env` file:

```bash
# Linear API Integration  
LINEAR_API_KEY=your_linear_api_key_here
```

## Step 2: Test the Connection

Run the test script to verify everything works:

```bash
# Make sure your dev server is running
npm run dev

# In another terminal, test the API
node test-linear-api.js
```

You should see:
- ✅ Your Linear user info
- 🏢 Your teams
- 📋 Recent issues

## Step 3: Sync Your Data

### Manual Sync (for testing)

```bash
curl -X POST http://localhost:3000/api/integrations/linear/sync \
  -H "Content-Type: application/json" \
  -d '{"user_id": "your-user-id", "days": 7}'
```

### Check Sync Status

```bash
curl "http://localhost:3000/api/integrations/linear/sync?user_id=your-user-id"
```

## API Endpoints

### 🧪 Test Connection
**GET** `/api/integrations/linear/test`

Returns your user info, teams, and recent issues.

### 🔄 Sync Issues  
**POST** `/api/integrations/linear/sync`

```json
{
  "user_id": "your-supabase-user-id",
  "days": 7
}
```

Fetches issues from the last N days and stores them in your FounderOS database.

### 📊 Check Status
**GET** `/api/integrations/linear/sync?user_id=your-user-id`

Returns integration status and count of synced Linear entries.

## What Gets Synced

- **Issues**: Title, description, state, assignee, team, labels
- **Comments**: All comments on each issue  
- **Metadata**: Priority, creation/update dates, Linear URLs
- **Tags**: Automatically tagged by team, state, and labels

## Example Synced Entry

```json
{
  "type": "linear",
  "content": "# PROJ-123: Fix the login bug\n\nUsers can't log in with...",
  "metadata": {
    "linear_id": "abc123",
    "identifier": "PROJ-123", 
    "state": "In Progress",
    "assignee": "John Doe",
    "team": "Engineering",
    "priority": 2,
    "labels": ["bug", "urgent"],
    "url": "https://linear.app/issue/abc123"
  },
  "tags": ["linear", "proj", "in-progress", "bug", "urgent"],
  "source_url": "https://linear.app/issue/abc123"
}
```

## Automation Options

### Option 1: Manual Sync
Just run the sync API when you want to pull latest data.

### Option 2: Scheduled Sync  
Set up a cron job or scheduled function to sync every hour/day:

```javascript
// Run this on a schedule
await fetch('/api/integrations/linear/sync', {
  method: 'POST',
  body: JSON.stringify({ user_id: 'user-123', days: 1 })
})
```

### Option 3: UI Integration
Add a "Sync Linear" button to your FounderOS UI.

## Benefits vs Webhooks

| Feature | API Approach | Webhook Approach |
|---------|-------------|------------------|
| Setup complexity | ⭐ Simple | ⭐⭐⭐ Complex |
| Public URL needed | ❌ No | ✅ Yes |
| Real-time updates | ⭐⭐ Near real-time | ⭐⭐⭐ Real-time |
| Development ease | ⭐⭐⭐ Easy | ⭐ Hard |
| Security concerns | ⭐⭐⭐ Minimal | ⭐⭐ More complex |
| Testing | ⭐⭐⭐ Very easy | ⭐ Difficult |

## Next Steps

1. **Test the integration** with the test script
2. **Sync some data** using the sync endpoint  
3. **Check your FounderOS** to see Linear issues appear
4. **Set up automation** if you want regular syncing

This API approach is **much more practical** for development and gives you everything you need without the webhook complexity! 🚀 