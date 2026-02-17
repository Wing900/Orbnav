import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { HoverState, SiteNode } from '../types/navigation'

const BASE_CAMERA_POSITION = { x: 0, y: 0, z: 40 }
const BACKGROUND_COLOR = 0xfaf9f5
const FOCUS_DISTANCE = 8
const FOCUS_DURATION = 1.85
const DISTURB_RADIUS = 18
const DISTURB_INTENSITY = 0.62

type Disposable = { dispose: () => void }

type NodeMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> & {
  userData: { site: SiteNode }
}

type NodeGroup = THREE.Group & {
  userData: {
    baseY: number
    floatOffset: number
    floatSpeed: number
  }
}

interface NodeLabelItem {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  aspect: number
}

interface SceneRuntime {
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  nodeMeshById: Map<string, NodeMesh>
  focusLocked: boolean
  pendingFocusId: string | null
  cameraTween: gsap.core.Tween | null
  targetTween: gsap.core.Tween | null
  clearHover: () => void
}

interface GalaxyCanvasProps {
  sites: SiteNode[]
  focusSite: SiteNode | null
  onNodeSelect: (site: SiteNode) => void
  onHoverChange: (hover: HoverState) => void
  onFocusComplete: (site: SiteNode) => void
}

const createSoftParticleTexture = (): THREE.CanvasTexture => {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return new THREE.CanvasTexture(canvas)
  }

  const center = size / 2
  const gradient = context.createRadialGradient(center, center, 2, center, center, center)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.78)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const createNodeLabel = (
  text: string,
): { sprite: THREE.Sprite; material: THREE.SpriteMaterial; texture: THREE.CanvasTexture; aspect: number } => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const width = 512
  const height = 120

  canvas.width = width
  canvas.height = height

  if (context) {
    context.clearRect(0, 0, width, height)
    context.font = '600 48px "Cormorant Garamond", "Noto Serif SC", serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeStyle = 'rgba(250, 249, 245, 0.9)'
    context.lineWidth = 8
    context.strokeText(text, width / 2, height / 2 + 1)
    context.fillStyle = 'rgba(58, 54, 49, 0.96)'
    context.fillText(text, width / 2, height / 2 + 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.92,
  })

  const sprite = new THREE.Sprite(material)
  sprite.center.set(0.5, 0)
  const aspect = width / height
  sprite.scale.set(aspect * 1.1, 1.1, 1)

  return { sprite, material, texture, aspect }
}

export function GalaxyCanvas({
  sites,
  focusSite,
  onNodeSelect,
  onHoverChange,
  onFocusComplete,
}: GalaxyCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(BACKGROUND_COLOR)
    scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, 0.014)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )
    camera.position.set(
      BASE_CAMERA_POSITION.x,
      BASE_CAMERA_POSITION.y,
      BASE_CAMERA_POSITION.z,
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.rotateSpeed = 0.62
    controls.zoomSpeed = 0.8
    controls.panSpeed = 0.72
    controls.minDistance = 10
    controls.maxDistance = 110
    controls.target.set(0, 0, 0)
    controls.update()

    const disposableResources: Disposable[] = []
    const starSprite = createSoftParticleTexture()
    disposableResources.push(starSprite)

    const galaxyGeometry = new THREE.BufferGeometry()
    const galaxyCount = 3000
    const galaxyPositions = new Float32Array(galaxyCount * 3)
    const galaxyColors = new Float32Array(galaxyCount * 3)
    const galaxyColor = new THREE.Color(0x777777)
    const galaxyPhase = new Float32Array(galaxyCount)
    const galaxySpeed = new Float32Array(galaxyCount)
    const galaxyAmplitude = new Float32Array(galaxyCount)
    const galaxyTwist = new Float32Array(galaxyCount)
    const galaxyPulse = new Float32Array(galaxyCount)

    for (let index = 0; index < galaxyCount * 3; index += 3) {
      const radius = Math.random() * 46
      const theta = Math.random() * Math.PI * 2
      const ySpread = (Math.random() - 0.5) * 11 * (1 - radius / 46)

      galaxyPositions[index] = radius * Math.cos(theta)
      galaxyPositions[index + 1] = ySpread
      galaxyPositions[index + 2] = radius * Math.sin(theta)

      galaxyColors[index] = galaxyColor.r
      galaxyColors[index + 1] = galaxyColor.g
      galaxyColors[index + 2] = galaxyColor.b
    }

    for (let index = 0; index < galaxyCount; index += 1) {
      galaxyPhase[index] = Math.random() * Math.PI * 2
      galaxySpeed[index] = 0.25 + Math.random() * 1.2
      galaxyAmplitude[index] = 0.08 + Math.random() * 0.34
      galaxyTwist[index] = 0.0018 + Math.random() * 0.009
      galaxyPulse[index] = 0.004 + Math.random() * 0.018
    }

    const galaxyBasePositions = galaxyPositions.slice()

    galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3))
    galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3))

    const galaxyMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: starSprite,
      alphaTest: 0.15,
      depthWrite: false,
      transparent: true,
      opacity: 0.62,
    })

    const galaxyField = new THREE.Points(galaxyGeometry, galaxyMaterial)
    scene.add(galaxyField)
    disposableResources.push(galaxyGeometry, galaxyMaterial)
    const galaxyPositionAttr = galaxyGeometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute

    const deepGeometry = new THREE.BufferGeometry()
    const deepCount = 2200
    const deepPositions = new Float32Array(deepCount * 3)
    const deepColors = new Float32Array(deepCount * 3)

    for (let index = 0; index < deepCount; index += 1) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 58 + Math.random() * 140
      const cursor = index * 3

      deepPositions[cursor] = radius * Math.sin(phi) * Math.cos(theta)
      deepPositions[cursor + 1] = radius * Math.cos(phi)
      deepPositions[cursor + 2] = radius * Math.sin(phi) * Math.sin(theta)

      const tone = 0.6 + Math.random() * 0.25
      deepColors[cursor] = tone
      deepColors[cursor + 1] = tone
      deepColors[cursor + 2] = tone
    }

    deepGeometry.setAttribute('position', new THREE.BufferAttribute(deepPositions, 3))
    deepGeometry.setAttribute('color', new THREE.BufferAttribute(deepColors, 3))

    const deepMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      map: starSprite,
      alphaTest: 0.15,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    })
    const deepStars = new THREE.Points(deepGeometry, deepMaterial)
    scene.add(deepStars)
    disposableResources.push(deepGeometry, deepMaterial)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.42)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.92)
    keyLight.position.set(14, 18, 16)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
    fillLight.position.set(-16, -6, -10)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.32)
    rimLight.position.set(0, 8, -20)
    scene.add(ambientLight, keyLight, fillLight, rimLight)

    const nodesGroup = new THREE.Group()
    const nodeMeshes: NodeMesh[] = []
    const nodeLabels: NodeLabelItem[] = []
    const nodeMeshById = new Map<string, NodeMesh>()
    const sitePoints: THREE.Vector3[] = []

    const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32)
    const ringGeometry = new THREE.RingGeometry(1.2, 1.25, 64)
    disposableResources.push(sphereGeometry, ringGeometry)

    for (const site of sites) {
      const group = new THREE.Group() as NodeGroup
      group.position.set(site.position.x, site.position.y, site.position.z)
      group.userData = {
        baseY: site.position.y,
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: 1 + Math.random() * 0.5,
      }

      const sphereMaterial = new THREE.MeshStandardMaterial({
        color: site.color,
        roughness: 0.47,
        metalness: 0.1,
      })
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial) as NodeMesh
      sphere.userData = { site }
      disposableResources.push(sphereMaterial)

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x7f786d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.24,
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      disposableResources.push(ringMaterial)

      const label = createNodeLabel(site.name)
      label.sprite.position.set(0, 1.25, 0)
      group.add(label.sprite)
      nodeLabels.push({
        sprite: label.sprite,
        material: label.material,
        aspect: label.aspect,
      })
      disposableResources.push(label.texture, label.material)

      group.add(sphere)
      group.add(ring)
      nodesGroup.add(group)
      nodeMeshes.push(sphere)
      nodeMeshById.set(site.id, sphere)
      sitePoints.push(new THREE.Vector3(site.position.x, site.position.y, site.position.z))
    }

    scene.add(nodesGroup)

    const curveSegments: THREE.Vector3[] = []
    for (let index = 0; index < sitePoints.length; index += 1) {
      const from = sitePoints[index]
      const candidates = sitePoints
        .map((point, pointIndex) => ({ point, pointIndex }))
        .filter(({ pointIndex }) => pointIndex > index)
        .map(({ point, pointIndex }) => ({
          point,
          pointIndex,
          distance: from.distanceToSquared(point),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2)

      for (const candidate of candidates) {
        const to = sitePoints[candidate.pointIndex]
        const distance = Math.sqrt(candidate.distance)
        const midpoint = from.clone().add(to).multiplyScalar(0.5)
        const curveNormal = midpoint.clone().normalize()

        if (curveNormal.lengthSq() < 0.0001) {
          curveNormal.set(0, 1, 0)
        }

        const control = midpoint.addScaledVector(curveNormal, 0.2 * distance + 1.2)
        const curve = new THREE.QuadraticBezierCurve3(from, control, to)
        const sampledPoints = curve.getPoints(14)

        for (let pointIndex = 0; pointIndex < sampledPoints.length - 1; pointIndex += 1) {
          curveSegments.push(sampledPoints[pointIndex], sampledPoints[pointIndex + 1])
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curveSegments)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x746e63,
      transparent: true,
      opacity: 0.18,
    })
    const constellation = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(constellation)
    disposableResources.push(lineGeometry, lineMaterial)

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2(2, 2)
    const pointerClient = { x: 0, y: 0 }
    const clock = new THREE.Clock()
    const disturbTarget = new THREE.Vector3(0, 0, 0)
    const disturbCurrent = new THREE.Vector3(0, 0, 0)
    const disturbProject = new THREE.Vector3()
    const disturbDirection = new THREE.Vector3()
    const tempLabelWorld = new THREE.Vector3()

    let currentHovered: NodeMesh | null = null
    let pointerDown = false
    let dragDistance = 0
    let disturbWeightTarget = 0
    let disturbWeight = 0
    const pointerDownAt = { x: 0, y: 0 }
    const dragThreshold = 8

    const setHovered = (nextHovered: NodeMesh | null) => {
      if (currentHovered === nextHovered) {
        return
      }

      if (currentHovered) {
        gsap.to(currentHovered.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.25,
          overwrite: true,
        })
      }

      currentHovered = nextHovered

      if (currentHovered) {
        gsap.to(currentHovered.scale, {
          x: 1.45,
          y: 1.45,
          z: 1.45,
          duration: 0.25,
          overwrite: true,
        })
        renderer.domElement.style.cursor = 'pointer'
        onHoverChange({
          site: currentHovered.userData.site,
          x: pointerClient.x,
          y: pointerClient.y,
        })
        return
      }

      renderer.domElement.style.cursor = 'default'
      onHoverChange({ site: null, x: 0, y: 0 })
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1
      pointerClient.x = event.clientX
      pointerClient.y = event.clientY

      if (pointerDown) {
        const dx = event.clientX - pointerDownAt.x
        const dy = event.clientY - pointerDownAt.y
        dragDistance = Math.max(dragDistance, Math.hypot(dx, dy))
      }

      disturbProject.set(pointerNdc.x, pointerNdc.y, 0.5).unproject(camera)
      disturbDirection.copy(disturbProject).sub(camera.position).normalize()
      const targetDistance = camera.position.distanceTo(controls.target)
      disturbTarget.copy(camera.position).addScaledVector(disturbDirection, targetDistance)
      disturbWeightTarget = 1

      if (currentHovered) {
        onHoverChange({
          site: currentHovered.userData.site,
          x: pointerClient.x,
          y: pointerClient.y,
        })
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true
      pointerDownAt.x = event.clientX
      pointerDownAt.y = event.clientY
      dragDistance = 0
    }

    const onPointerUp = () => {
      pointerDown = false
    }

    const onPointerLeave = () => {
      pointerDown = false
      disturbWeightTarget = 0
      pointerNdc.set(2, 2)
    }

    const onClick = () => {
      if (dragDistance > dragThreshold) {
        dragDistance = 0
        return
      }

      const runtime = runtimeRef.current
      if (!runtime || runtime.focusLocked || !currentHovered) {
        return
      }

      dragDistance = 0
      onNodeSelect(currentHovered.userData.site)
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }

    const onControlStart = () => {
      setHovered(null)
    }

    controls.addEventListener('start', onControlStart)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', onResize)

    runtimeRef.current = {
      camera,
      renderer,
      controls,
      nodeMeshById,
      focusLocked: false,
      pendingFocusId: null,
      cameraTween: null,
      targetTween: null,
      clearHover: () => setHovered(null),
    }

    let frameId = 0

    const animate = () => {
      frameId = window.requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const elapsed = clock.elapsedTime
      const runtime = runtimeRef.current
      const isFocused = Boolean(runtime?.focusLocked)
      const disturbBlend = Math.min(1, delta * 6)

      if (isFocused) {
        disturbWeightTarget = 0
      }
      disturbWeight += (disturbWeightTarget - disturbWeight) * disturbBlend
      disturbCurrent.lerp(disturbTarget, disturbBlend)

      for (let index = 0; index < galaxyCount; index += 1) {
        const cursor = index * 3
        const baseX = galaxyBasePositions[cursor]
        const baseY = galaxyBasePositions[cursor + 1]
        const baseZ = galaxyBasePositions[cursor + 2]
        const radius = Math.hypot(baseX, baseZ)
        const phase = galaxyPhase[index]
        const speed = galaxySpeed[index]

        const swirl =
          Math.sin(elapsed * speed + phase + radius * 0.22) * galaxyTwist[index]
        const swirlCos = Math.cos(swirl)
        const swirlSin = Math.sin(swirl)
        const pulse =
          1 +
          Math.sin(elapsed * (speed * 0.72) + phase * 1.7 + radius * 0.08) *
            galaxyPulse[index]

        const x = (baseX * swirlCos - baseZ * swirlSin) * pulse
        const z = (baseX * swirlSin + baseZ * swirlCos) * pulse
        const y =
          baseY +
          Math.sin(elapsed * (speed * 1.38) + phase + radius * 0.19) *
            galaxyAmplitude[index]

        let disturbedX = x
        let disturbedY = y
        let disturbedZ = z

        if (disturbWeight > 0.001) {
          const dx = disturbedX - disturbCurrent.x
          const dy = disturbedY - disturbCurrent.y
          const dz = disturbedZ - disturbCurrent.z
          const distSq = dx * dx + dy * dy + dz * dz
          const radiusSq = DISTURB_RADIUS * DISTURB_RADIUS

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq) + 0.0001
            const falloff = 1 - dist / DISTURB_RADIUS
            const force = falloff * falloff * DISTURB_INTENSITY * disturbWeight
            const wave = Math.sin(elapsed * 2.15 + phase + radius * 0.11)

            disturbedX += (-dz / dist) * force
            disturbedZ += (dx / dist) * force
            disturbedY += wave * force * 0.78
          }
        }

        galaxyPositions[cursor] = disturbedX
        galaxyPositions[cursor + 1] = disturbedY
        galaxyPositions[cursor + 2] = disturbedZ
      }
      galaxyPositionAttr.needsUpdate = true

      galaxyField.rotation.y = elapsed * 0.03
      deepStars.rotation.y = elapsed * -0.016

      if (!isFocused) {
        constellation.rotation.y = elapsed * 0.05
        nodesGroup.rotation.y = elapsed * 0.03

        for (const child of nodesGroup.children as NodeGroup[]) {
          child.position.y =
            child.userData.baseY +
            Math.sin(elapsed * child.userData.floatSpeed + child.userData.floatOffset) * 0.35

          const ring = child.children[1]
          ring.rotation.z = elapsed * 0.2
        }

        raycaster.setFromCamera(pointerNdc, camera)
        const intersects = raycaster.intersectObjects(nodeMeshes, false)
        const nextHovered = (intersects[0]?.object as NodeMesh | undefined) ?? null
        setHovered(nextHovered)
      } else if (currentHovered) {
        setHovered(null)
      }

      for (const label of nodeLabels) {
        label.sprite.getWorldPosition(tempLabelWorld)
        const distance = camera.position.distanceTo(tempLabelWorld)
        const scale = THREE.MathUtils.clamp(3.1 - distance * 0.045, 0.72, 2.35)
        label.sprite.scale.set(label.aspect * scale, scale, 1)
        label.material.opacity = THREE.MathUtils.clamp(1.04 - distance * 0.012, 0.24, 0.95)
      }

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      const runtime = runtimeRef.current
      runtime?.cameraTween?.kill()
      runtime?.targetTween?.kill()

      controls.removeEventListener('start', onControlStart)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', onResize)

      window.cancelAnimationFrame(frameId)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.style.cursor = 'default'

      for (const resource of disposableResources) {
        resource.dispose()
      }

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }

      runtimeRef.current = null
    }
  }, [onFocusComplete, onHoverChange, onNodeSelect, sites])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) {
      return
    }

    runtime.cameraTween?.kill()
    runtime.targetTween?.kill()

    if (focusSite) {
      runtime.pendingFocusId = focusSite.id
      runtime.focusLocked = true
      runtime.clearHover()
      runtime.controls.enabled = false

      const targetNode = runtime.nodeMeshById.get(focusSite.id)
      const focusTarget = new THREE.Vector3(
        focusSite.position.x,
        focusSite.position.y,
        focusSite.position.z,
      )
      if (targetNode) {
        targetNode.updateWorldMatrix(true, false)
        targetNode.getWorldPosition(focusTarget)
      }

      const approachDirection = runtime.camera.position.clone().sub(focusTarget)
      if (approachDirection.lengthSq() < 0.0001) {
        approachDirection.set(0, 0, 1)
      }
      approachDirection.normalize()
      const destination = focusTarget
        .clone()
        .addScaledVector(approachDirection, FOCUS_DISTANCE)

      runtime.cameraTween = gsap.to(runtime.camera.position, {
        x: destination.x,
        y: destination.y,
        z: destination.z,
        duration: FOCUS_DURATION,
        ease: 'expo.inOut',
      })

      runtime.targetTween = gsap.to(runtime.controls.target, {
        x: focusTarget.x,
        y: focusTarget.y,
        z: focusTarget.z,
        duration: FOCUS_DURATION,
        ease: 'expo.inOut',
        onUpdate: () => {
          runtime.controls.update()
        },
        onComplete: () => {
          if (runtimeRef.current?.pendingFocusId === focusSite.id) {
            onFocusComplete(focusSite)
          }
        },
      })
      return
    }

    runtime.pendingFocusId = null
    runtime.focusLocked = false
    runtime.controls.enabled = true
    runtime.clearHover()
    onHoverChange({ site: null, x: 0, y: 0 })

    runtime.cameraTween = gsap.to(runtime.camera.position, {
      ...BASE_CAMERA_POSITION,
      duration: 2.1,
      ease: 'expo.out',
    })

    runtime.targetTween = gsap.to(runtime.controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: 2.1,
      ease: 'expo.out',
      onUpdate: () => {
        runtime.controls.update()
      },
    })
  }, [focusSite, onFocusComplete, onHoverChange])

  return <div className="canvas-container" ref={containerRef} />
}
