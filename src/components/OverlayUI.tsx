import { useState } from 'react'
import type { SiteNode } from '../types/navigation'

interface OverlayUIProps {
  hoveredSite: SiteNode | null
  tooltipX: number
  tooltipY: number
}

export function OverlayUI({ hoveredSite, tooltipX, tooltipY }: OverlayUIProps) {
  const [avatarSrc, setAvatarSrc] = useState('/avatar.png')

  return (
    <section className="overlay-layer" aria-hidden>
      <header className="brand">
        <div className="brand-avatar-frame">
          <img
            className="brand-avatar"
            src={avatarSrc}
            alt="Wingflow avatar"
            onError={() => setAvatarSrc('/logo.svg')}
          />
        </div>
        <div className="brand-texts">
          <h1 className="brand-title">Orbnav</h1>
          <p className="brand-subtitle">Wingflow</p>
        </div>
      </header>
      <div
        className={`hover-tooltip ${hoveredSite ? 'visible' : ''}`}
        style={{ left: tooltipX, top: tooltipY }}
      >
        {hoveredSite?.name ?? ''}
      </div>
    </section>
  )
}
