"use client"

import React from "react"

/**
 * Simple markdown renderer for AI responses
 * Supports: **bold**, *italic*, `code`, newlines
 */
export function MarkdownRenderer({ content }: { content: string }) {
  // Split by newlines first to preserve line breaks
  const lines = content.split("\n")
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        if (line.trim() === "") {
          return <br key={`line-${lineIndex}`} />
        }
        
        const parts: React.ReactNode[] = []
        let lastIndex = 0
        let keyCounter = 0
        
        // Process markdown patterns: **bold**, *italic*, `code`
        // Use a single regex to find all patterns
        const pattern = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
        const matches: Array<{ start: number; end: number; text: string; type: 'bold' | 'italic' | 'code' }> = []
        
        let match
        while ((match = pattern.exec(line)) !== null) {
          const fullMatch = match[0]
          const innerText = fullMatch.slice(2, -2) // Remove ** or * or `
          const type = fullMatch.startsWith('**') ? 'bold' : fullMatch.startsWith('`') ? 'code' : 'italic'
          
          matches.push({
            start: match.index,
            end: match.index + fullMatch.length,
            text: innerText,
            type,
          })
        }
        
        // Remove overlapping matches (keep first occurrence)
        const filteredMatches: typeof matches = []
        for (const m of matches) {
          const overlaps = filteredMatches.some(
            (existing) => (m.start < existing.end && m.end > existing.start)
          )
          if (!overlaps) {
            filteredMatches.push(m)
          }
        }
        
        // Sort by start position
        filteredMatches.sort((a, b) => a.start - b.start)
        
        // Build parts
        if (filteredMatches.length === 0) {
          parts.push(<span key={`text-${lineIndex}-${keyCounter++}`}>{line}</span>)
        } else {
          filteredMatches.forEach((m, matchIndex) => {
            // Add text before match
            if (m.start > lastIndex) {
              parts.push(
                <span key={`text-${lineIndex}-${keyCounter++}`}>
                  {line.substring(lastIndex, m.start)}
                </span>
              )
            }
            
            // Add formatted match
            if (m.type === 'bold') {
              parts.push(<strong key={`bold-${lineIndex}-${keyCounter++}`}>{m.text}</strong>)
            } else if (m.type === 'italic') {
              parts.push(<em key={`italic-${lineIndex}-${keyCounter++}`}>{m.text}</em>)
            } else {
              parts.push(
                <code key={`code-${lineIndex}-${keyCounter++}`} className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono">
                  {m.text}
                </code>
              )
            }
            
            lastIndex = m.end
            
            // Add remaining text after last match
            if (matchIndex === filteredMatches.length - 1 && lastIndex < line.length) {
              parts.push(
                <span key={`text-${lineIndex}-${keyCounter++}`}>
                  {line.substring(lastIndex)}
                </span>
              )
            }
          })
        }
        
        return (
          <React.Fragment key={`line-${lineIndex}`}>
            {parts}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        )
      })}
    </>
  )
}
