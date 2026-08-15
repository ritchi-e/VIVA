import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string },
          ) => void
        }
      }
    }
  }
}

export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void
  disabled?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    if (!clientId || disabled) return
    const callback = (response: { credential: string }) => {
      if (response.credential) onCredential(response.credential)
    }

    const render = () => {
      if (!hostRef.current || !window.google?.accounts?.id) return
      hostRef.current.innerHTML = ''
      window.google.accounts.id.initialize({ client_id: clientId, callback })
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: 'outline',
        size: 'large',
        width: 336,
        text: 'continue_with',
      })
    }

    if (window.google?.accounts?.id) {
      render()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis="true"]')
    if (existing) {
      existing.addEventListener('load', render)
      return () => existing.removeEventListener('load', render)
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGis = 'true'
    script.addEventListener('load', render)
    document.head.appendChild(script)
    return () => script.removeEventListener('load', render)
  }, [clientId, disabled, onCredential])

  if (!clientId) return null

  return <div ref={hostRef} className="flex justify-center" />
}
