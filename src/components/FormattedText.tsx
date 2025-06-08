import React from 'react'
import { parseFormattedText } from '@/lib/utils'

interface FormattedTextProps {
  text: string
  className?: string
}

export function FormattedText({ text, className = '' }: FormattedTextProps) {
  const parsedContent = parseFormattedText(text)
  
  return (
    <div className={className}>
      {parsedContent.map((item, index) => {
        if (item.type === 'bullet') {
          return (
            <div key={index} className="flex items-start gap-2 mb-1">
              <span className="text-current mt-0.5 flex-shrink-0">•</span>
              <span className="flex-1">{item.content}</span>
            </div>
          )
        }
        
        // Regular text line
        return (
          <div key={index} className={item.content ? "mb-1" : "mb-2"}>
            {item.content || '\u00A0'}
          </div>
        )
      })}
    </div>
  )
} 