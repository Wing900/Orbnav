export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface SiteNode {
  id: string
  name: string
  url: string
  color: number
  position: Vec3
  category: string
  description?: string
}

export interface HoverState {
  site: SiteNode | null
  x: number
  y: number
}
