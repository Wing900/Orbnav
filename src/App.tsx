import { useCallback, useState } from 'react'
import { GalaxyCanvas } from './components/GalaxyCanvas'
import { OverlayUI } from './components/OverlayUI'
import { PreviewModal } from './components/PreviewModal'
import { sites } from './data/sites'
import type { HoverState, SiteNode } from './types/navigation'

function App() {
  const [hoverState, setHoverState] = useState<HoverState>({
    site: null,
    x: 0,
    y: 0,
  })
  const [focusSite, setFocusSite] = useState<SiteNode | null>(null)
  const [previewSite, setPreviewSite] = useState<SiteNode | null>(null)

  const handleNodeSelect = useCallback((site: SiteNode) => {
    setFocusSite(site)
  }, [])

  const handleFocusComplete = useCallback((site: SiteNode) => {
    setPreviewSite(site)
  }, [])

  const handleHoverChange = useCallback((hover: HoverState) => {
    setHoverState(hover)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewSite(null)
    setFocusSite(null)
  }, [])

  return (
    <main className="app-shell">
      <GalaxyCanvas
        sites={sites}
        focusSite={focusSite}
        onNodeSelect={handleNodeSelect}
        onHoverChange={handleHoverChange}
        onFocusComplete={handleFocusComplete}
      />
      <OverlayUI
        hoveredSite={hoverState.site}
        tooltipX={hoverState.x}
        tooltipY={hoverState.y}
      />
      <PreviewModal site={previewSite} onClose={handleClosePreview} />
    </main>
  )
}

export default App
