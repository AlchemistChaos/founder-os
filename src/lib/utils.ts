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

// Convert formatted text to structured data for JSX rendering
export function parseFormattedText(text: string): Array<{ type: 'bullet' | 'text', content: string }> {
  if (!text) return [{ type: 'text', content: text }]
  
  const formattedText = formatTextWithBullets(text)
  const lines = formattedText.split('\n')
  
  return lines.map(line => {
    const trimmedLine = line.trim()
    
    // Check if this is a bullet point line
    if (trimmedLine.startsWith('• ')) {
      return { type: 'bullet', content: trimmedLine.slice(2) }
    }
    
    // Regular line
    return { type: 'text', content: trimmedLine || '' }
  })
}

 