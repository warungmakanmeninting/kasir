"use client"

import { FullscreenButton } from "./fullscreen-button"
import { AIAssistant } from "./ai-assistant"

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AIAssistant />
      <FullscreenButton />
    </>
  )
}

