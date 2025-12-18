"use client"

import { FullscreenButton } from "./fullscreen-button"

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FullscreenButton />
    </>
  )
}

