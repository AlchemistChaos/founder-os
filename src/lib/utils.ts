import React from "react"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format text with proper bullet points for flashcards
export function formatTextWithBullets(text: string): string {
  if (!text) return text
  
  // Split into lines and process each line
  const lines = text.split('\n')
  const formattedLines = lines.map(line => {
    const trimmedLine = line.trim()
    
    // Skip empty lines
    if (!trimmedLine) return line
    
    // Check for various bullet point patterns
    const bulletPatterns = [
      /^[-•·*]\s+(.*)$/, // - • · * followed by space
      /^(\d+\.)\s+(.*)$/, // 1. 2. 3. etc.
      /^([a-zA-Z]\.)\s+(.*)$/, // a. b. c. etc.
      /^(\d+\))\s+(.*)$/, // 1) 2) 3) etc.
      /^([a-zA-Z]\))\s+(.*)$/, // a) b) c) etc.
    ]
    
    for (const pattern of bulletPatterns) {
      const match = trimmedLine.match(pattern)
      if (match) {
        // For numbered/lettered lists, keep the number/letter
        if (pattern === bulletPatterns[1] || pattern === bulletPatterns[2] || 
            pattern === bulletPatterns[3] || pattern === bulletPatterns[4]) {
          return `• ${match[2]}`
        } else {
          // For bullet points, ensure consistent bullet style
          return `• ${match[1]}`
        }
      }
    }
    
    return line
  })
  
  return formattedLines.join('\n')
}

// Convert formatted text to JSX with proper bullet point styling
export function renderFormattedText(text: string): React.ReactNode[] {
  if (!text) return [text]
  
  const formattedText = formatTextWithBullets(text)
  const lines = formattedText.split('\n')
  
  return lines.map((line, index) => {
    const trimmedLine = line.trim()
    
    // Check if this is a bullet point line
    if (trimmedLine.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start gap-2 mb-1">
          <span className="text-current mt-0.5 flex-shrink-0">•</span>
          <span className="flex-1">{trimmedLine.slice(2)}</span>
        </div>
      )
    }
    
    // Regular line (could be empty)
    return (
      <div key={index} className={trimmedLine ? "mb-1" : "mb-2"}>
        {trimmedLine || '\u00A0'}
      </div>
    )
  })
} 