#!/bin/bash

# Fireflies Sync Automation Script
# This script can be run via cron to automate daily syncing

# Configuration
APP_URL="http://localhost:3000"
CRON_SECRET="${CRON_SECRET:-dev-secret}"
LOG_FILE="$HOME/fireflies-sync.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to call API endpoint
call_api() {
    local endpoint="$1"
    local description="$2"
    
    log "🚀 Starting $description..."
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST "$APP_URL$endpoint" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -H "Content-Type: application/json")
    
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$http_code" -eq 200 ]; then
        log "✅ $description completed successfully"
        log "📊 Response: $body"
    else
        log "❌ $description failed with HTTP $http_code"
        log "📝 Error: $body"
        return 1
    fi
}

# Main execution
main() {
    log "🤖 Starting Fireflies automation..."
    
    # Sync Fireflies data
    if call_api "/api/cron/sync-fireflies" "Fireflies sync"; then
        log "✅ Fireflies sync successful"
    else
        log "❌ Fireflies sync failed"
        exit 1
    fi
    
    # Generate flashcards (optional, can be run less frequently)
    if [ "$1" = "--with-flashcards" ]; then
        log "🚀 Starting Flashcard generation..."
        
        # Use mock-token for flashcard generation (requires user auth)
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X POST "$APP_URL/api/generate-flashcards" \
            -H "Authorization: Bearer mock-token" \
            -H "Content-Type: application/json")
        
        http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        body=$(echo "$response" | sed -e 's/HTTPSTATUS\:.*//g')
        
        if [ "$http_code" -eq 200 ]; then
            log "✅ Flashcard generation completed successfully"
            log "📊 Response: $body"
        else
            log "⚠️  Flashcard generation failed (non-critical)"
            log "📝 Error: $body"
        fi
    fi
    
    log "🎉 Automation cycle completed"
}

# Execute main function
main "$@" 