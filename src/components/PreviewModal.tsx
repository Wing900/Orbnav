import { useState } from 'react'
import type { SiteNode } from '../types/navigation'

interface PreviewModalProps {
  site: SiteNode | null
  onClose: () => void
}

interface PreviewFrameProps {
  site: SiteNode
}

function PreviewFrame({ site }: PreviewFrameProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="preview-content">
      <iframe
        className={`preview-frame ${isLoading ? 'is-loading' : 'is-ready'}`}
        src={site.url}
        title={site.name}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
      <div className={`frame-loader ${isLoading ? 'visible' : ''}`} aria-hidden={!isLoading}>
        <div className="loader-ring" />
        <p className="loader-text">Loading {site.name} ...</p>
      </div>
    </div>
  )
}

export function PreviewModal({ site, onClose }: PreviewModalProps) {
  return (
    <section
      className={`preview-modal ${site ? 'active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!site}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <article className="preview-card">
        <header className="preview-header">
          {site ? (
            <a
              className="preview-title-link"
              href={site.url}
              target="_blank"
              rel="noreferrer"
            >
              {site.name}
            </a>
          ) : (
            <span className="preview-title">Website Title</span>
          )}
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="关闭预览"
          >
            ×
          </button>
        </header>
        {site ? <PreviewFrame key={site.id} site={site} /> : <div className="preview-content" />}
      </article>
    </section>
  )
}
