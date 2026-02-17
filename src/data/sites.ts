import type { SiteNode, Vec3 } from '../types/navigation'

const BASE_DOMAIN = '5051001.xyz'

interface SiteSeed {
  id: string
  name: string
  category: string
  description?: string
  subdomain?: string
  url?: string
  color?: number
}

const CATEGORY_BASE_HUE: Record<string, number> = {
  portal: 212,
  ai: 226,
  image: 24,
  tool: 268,
  service: 153,
  converter: 348,
  network: 42,
  math: 52,
  dev: 168,
}

const hashString = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const hslToHex = (hue: number, saturation: number, lightness: number): number => {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const hPrime = hue / 60
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1))

  let r = 0
  let g = 0
  let b = 0

  if (hPrime >= 0 && hPrime < 1) {
    r = chroma
    g = x
  } else if (hPrime < 2) {
    r = x
    g = chroma
  } else if (hPrime < 3) {
    g = chroma
    b = x
  } else if (hPrime < 4) {
    g = x
    b = chroma
  } else if (hPrime < 5) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  const match = l - chroma / 2
  const toByte = (channel: number): number =>
    Math.round((channel + match) * 255)

  const red = toByte(r)
  const green = toByte(g)
  const blue = toByte(b)

  return (red << 16) + (green << 8) + blue
}

const createUrl = (subdomain?: string): string => {
  if (!subdomain) {
    return `https://${BASE_DOMAIN}`
  }
  return `https://${subdomain}.${BASE_DOMAIN}`
}

const resolveUrl = (site: SiteSeed): string => {
  if (site.url) {
    return site.url
  }
  return createUrl(site.subdomain)
}

const resolveColor = (site: SiteSeed): number => {
  if (site.color !== undefined) {
    return site.color
  }

  const hash = hashString(`${site.category}:${site.id}`)
  const baseHue = CATEGORY_BASE_HUE[site.category] ?? (hash % 360)
  const hueOffset = (hash % 15) - 7
  const saturation = 34 + (Math.floor(hash / 19) % 15)
  const lightness = 58 + (Math.floor(hash / 37) % 11)

  return hslToHex((baseHue + hueOffset + 360) % 360, saturation, lightness)
}

const createOrbitPosition = (index: number, total: number): Vec3 => {
  const angle = (index / total) * Math.PI * 2
  const radius = index % 2 === 0 ? 14 : 20
  const verticalBand = (index % 3) - 1

  return {
    x: Math.cos(angle) * radius,
    y: verticalBand * 5,
    z: Math.sin(angle) * radius,
  }
}

const seeds: SiteSeed[] = [
  { id: 'root', name: 'www', category: 'portal', description: '根站入口。' },
  { id: 'nav', name: 'nav', subdomain: 'nav', category: 'portal', description: '导航入口。' },
  { id: 'chat', name: 'chat', subdomain: 'chat', category: 'ai', description: '对话与问答。' },
  { id: 'draw', name: 'draw', subdomain: 'draw', category: 'image', description: '绘图与图像生成。' },
  { id: 'ggbpuppy', name: 'ggbpuppy', subdomain: 'ggbpuppy', category: 'tool', description: '专用工具节点。' },
  { id: 'mambo', name: 'mambo', subdomain: 'mambo', category: 'service', description: '功能服务节点。' },
  { id: 'mdtoword', name: 'mdtoword', subdomain: 'mdtoword', category: 'converter', description: 'Markdown 转 Word。' },
  { id: 'proxy', name: 'proxy', subdomain: 'proxy', category: 'network', description: '代理与转发入口。' },
  { id: 'manimcat', name: 'manimcat', subdomain: 'manimcat', category: 'math', description: '可视化/动画相关节点。' },
  { id: 'pyweb', name: 'pyweb', subdomain: 'pyweb', category: 'dev', description: 'Python Web 相关节点。' },
]

export const sites: SiteNode[] = seeds.map((site, index) => ({
  id: site.id,
  name: site.name,
  url: resolveUrl(site),
  color: resolveColor(site),
  category: site.category,
  description: site.description,
  position: createOrbitPosition(index, seeds.length),
}))
