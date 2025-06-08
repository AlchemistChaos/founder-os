// Test script for Linear webhook endpoint
const crypto = require('crypto')

const webhookUrl = 'http://localhost:3000/api/integrations/linear/webhook'
const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET || 'test_secret'

// Create a test Linear webhook payload
const testPayload = {
  action: 'create',
  type: 'Issue',
  webhookId: 'test-webhook-id',
  webhookTimestamp: Date.now(),
  createdAt: new Date().toISOString(),
  url: 'https://linear.app/test-issue',
  data: {
    id: 'test-issue-id',
    identifier: 'TEST-123',
    title: 'Test Issue from Webhook',
    description: 'This is a test issue created by webhook',
    state: {
      name: 'In Progress'
    },
    assignee: {
      name: 'Test User',
      email: 'test@example.com'
    },
    team: {
      name: 'Test Team'
    },
    labels: [],
    priority: 2,
    url: 'https://linear.app/test-issue'
  }
}

// Create HMAC signature
const rawBody = JSON.stringify(testPayload)
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex')

console.log('Testing Linear webhook endpoint...')
console.log('Payload:', JSON.stringify(testPayload, null, 2))
console.log('Signature:', signature)

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Linear-Signature': signature,
    'Linear-Delivery': 'test-delivery-id-123',
    'Linear-Event': 'issue'
  },
  body: rawBody
})
.then(response => response.json())
.then(data => {
  console.log('Webhook response:', data)
})
.catch(error => {
  console.error('Webhook test failed:', error)
}) 