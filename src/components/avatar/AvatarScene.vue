/**
 * ==================================================
 * ██╗     ██╗██╗   ██╗ █████╗ 
 * ██║     ██║╚██╗ ██╔╝██╔══██╗
 * ██║     ██║ ╚████╔╝ ███████║
 * ██║     ██║  ╚██╔╝  ██╔══██║
 * ███████╗██║   ██║   ██║  ██║
 * ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
 *        AI Assistant
 * ==================================================
 * Author / Creator : Mahmut Denizli (With help of LiyaAi)
 * License          : MIT
 * Connect          : liyalabs.com, info@liyalabs.com
 * ==================================================
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

interface Props {
  modelUrl?: string
  width?: number
  height?: number
  backgroundColor?: string
  isSpeaking?: boolean
  visemes?: Array<{ time: number; viseme: number; duration: number }>
  currentTime?: number
  // Animation configuration
  lipSyncSpeed?: number // 0.01-0.3, lower = smoother lips (default: 0.08)
  lipSyncIntensity?: number // 0.1-1.0, mouth opening intensity (default: 0.7)
  blinkSpeed?: number // 0.05-0.3, blink animation speed (default: 0.15)
  blinkIntervalMin?: number // ms, minimum time between blinks (default: 2000)
  blinkIntervalMax?: number // ms, maximum time between blinks (default: 5000)
  eyeMoveSpeed?: number // 0.01-0.2, eye movement smoothness (default: 0.08)
  eyeMoveIntervalMin?: number // ms, minimum time between eye movements (default: 800)
  eyeMoveIntervalMax?: number // ms, maximum time between eye movements (default: 2000)
  eyeMoveRange?: number // 0.1-0.5, how far eyes can look (default: 0.3)
  breathingSpeed?: number // 0.3-2.0, breathing animation speed (default: 0.8)
  breathingIntensity?: number // 0.01-0.1, chest/shoulder movement (default: 0.03)
  microExpressionSpeed?: number // 0.1-1.0, subtle expression changes (default: 0.3)
  microExpressionIntensity?: number // 0.01-0.15, intensity of micro expressions (default: 0.05)
  speakingBrowIntensity?: number // 0.05-0.3, eyebrow movement while speaking (default: 0.15)
  speakingSmileIntensity?: number // 0.0-0.2, smile while speaking (default: 0.1)
  handGestureSpeed?: number // 0.1-1.0, how fast the hand waves
  handGestureIntensity?: number // 0.01-0.4, rotation range for hands
}

const props = withDefaults(defineProps<Props>(), {
  modelUrl: '',
  width: 400,
  height: 500,
  backgroundColor: '#1a1a2e',
  isSpeaking: false,
  visemes: () => [],
  currentTime: 0,
  // Animation defaults - tuned for natural movement
  lipSyncSpeed: 0.02,  // Much slower, natural lip movement
  lipSyncIntensity: 0.5,  // Moderate mouth movement
  blinkSpeed: 0.25,  // Faster blink animation
  blinkIntervalMin: 1500,  // More frequent blinking
  blinkIntervalMax: 3500,
  eyeMoveSpeed: 0.12,  // Faster eye movement
  eyeMoveIntervalMin: 500,  // More frequent eye movement
  eyeMoveIntervalMax: 1500,
  eyeMoveRange: 0.4,  // Larger eye movement range
  breathingSpeed: 0.4,  // Slightly faster breathing
  breathingIntensity: 0.015,  // More visible breathing
  microExpressionSpeed: 0.4,  // More frequent micro expressions
  microExpressionIntensity: 0.08,  // More visible micro expressions
  speakingBrowIntensity: 0.05,
  speakingSmileIntensity: 0.2,
  handGestureSpeed: 0.5,
  handGestureIntensity: 0.2
})

const emit = defineEmits<{
  loaded: []
  error: [error: Error]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let model: THREE.Object3D | null = null
let mixer: THREE.AnimationMixer | null = null
let morphTargetMeshes: THREE.Mesh[] = []
let animationFrameId: number | null = null
let clock: THREE.Clock | null = null

// Safari detection for performance optimizations
const isSafari = typeof navigator !== 'undefined' && 
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

// Safari fix: Animation loop control flag
let isAnimating = false

// Store current morph values for smooth interpolation
let currentMorphValues: Record<string, number> = {}

// Eye and facial animation state
let lastBlinkTime = 0
let isBlinking = false
let blinkProgress = 0
let nextBlinkInterval = 3000 // Random interval between blinks
let eyeLookTarget = { x: 0, y: 0 }
let eyeLookCurrent = { x: 0, y: 0 }
let lastEyeMoveTime = 0
let nextEyeMoveInterval = 2000
let breathPhase = 0
let microExpressionPhase = 0
let handGesturePhase = 0

// Hand animation references
let leftHandBone: THREE.Object3D | null = null
let rightHandBone: THREE.Object3D | null = null
let leftHandBaseRotation: THREE.Quaternion | null = null
let rightHandBaseRotation: THREE.Quaternion | null = null

// Eye bone references for blinking (when morph targets not available)
let leftEyeBone: THREE.Object3D | null = null
let rightEyeBone: THREE.Object3D | null = null
let leftEyeBaseScale: THREE.Vector3 | null = null
let rightEyeBaseScale: THREE.Vector3 | null = null
let hasEyeBlinkMorphs = false

// Outfit mesh references for color changing
let outfitTopMesh: THREE.Mesh | null = null
let outfitBottomMesh: THREE.Mesh | null = null
let outfitFootwearMesh: THREE.Mesh | null = null

function applySize(width: number, height: number): void {
  if (containerRef.value) {
    containerRef.value.style.width = `${width}px`
    containerRef.value.style.height = `${height}px`
  }

  if (renderer) {
    renderer.setSize(width, height)
    // Safari fix: Lower pixel ratio to reduce GPU load (Retina can be 3x)
    const maxPixelRatio = isSafari ? 1.5 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
  }

  if (camera) {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
}

// Viseme to morph target mapping (Ready Player Me / ARKit compatible)
// Maps to ARKit blendshapes available in the avatar
const VISEME_MORPH_MAP: Record<number, string[]> = {
  0: [], // Silence - neutral (all closed)
  1: ['mouthClose', 'mouthPressLeft', 'mouthPressRight'], // p, b, m - lips together
  2: ['mouthFunnel', 'mouthLowerDownLeft', 'mouthLowerDownRight'], // f, v
  3: ['mouthLowerDownLeft', 'mouthLowerDownRight', 'tongueOut'], // th
  4: ['mouthLowerDownLeft', 'mouthLowerDownRight'], // t, d
  5: ['mouthLowerDownLeft', 'mouthLowerDownRight'], // k, g
  6: ['mouthFunnel', 'mouthShrugUpper'], // ch, j, sh
  7: ['mouthSmileLeft', 'mouthSmileRight', 'mouthLowerDownLeft', 'mouthLowerDownRight'], // s, z
  8: ['mouthLowerDownLeft', 'mouthLowerDownRight'], // n
  9: ['mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthRollLower'], // r
  10: ['mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight'], // a - wide open
  11: ['mouthSmileLeft', 'mouthSmileRight', 'mouthLowerDownLeft', 'mouthLowerDownRight'], // e
  12: ['mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight'], // i
  13: ['mouthFunnel', 'mouthLowerDownLeft', 'mouthLowerDownRight'], // o - rounded
  14: ['mouthPucker', 'mouthFunnel'], // u - pursed
}


function initScene() {
  if (!containerRef.value) return

  // Scene with transparent background
  scene = new THREE.Scene()
  // Don't set background color - let it be transparent
  // scene.background = new THREE.Color(props.backgroundColor)

  // Camera - focused on chest and above
  camera = new THREE.PerspectiveCamera(
    30,
    props.width / props.height,
    0.1,
    1000
  )
  camera.position.set(0, 1.48, 1.5)
  camera.lookAt(0, 1.4, 0)

  // Renderer - Safari/iOS optimized settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: !isSafari, // Safari: disable antialiasing for performance
    alpha: true,
    powerPreference: isSafari ? 'low-power' : 'high-performance',
    preserveDrawingBuffer: true // Required for iOS/Safari WebGL stability
  })
  applySize(props.width, props.height)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  containerRef.value.appendChild(renderer.domElement)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(2, 3, 2)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
  fillLight.position.set(-2, 2, 2)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0x6366f1, 0.3)
  rimLight.position.set(0, 2, -3)
  scene.add(rimLight)

  // Clock for animations
  clock = new THREE.Clock()

  // Load model if URL provided
  if (props.modelUrl) {
    loadModel(props.modelUrl)
  }

  // Start animation loop
  isAnimating = true
  animate()
}

function createDefaultAvatar() {
  if (!scene) return

  // Create a more detailed stylized head
  const headGroup = new THREE.Group()

  // Head sphere (slightly oval)
  const headGeometry = new THREE.SphereGeometry(0.35, 32, 32)
  headGeometry.scale(1, 1.1, 1)
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5d0c5,
    roughness: 0.6,
    metalness: 0.05
  })
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.y = 1.55
  headGroup.add(head)

  // Hair
  const hairGeometry = new THREE.SphereGeometry(0.38, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 })
  const hair = new THREE.Mesh(hairGeometry, hairMaterial)
  hair.position.set(0, 1.65, -0.02)
  hair.rotation.x = -0.2
  headGroup.add(hair)

  // Eyes - white part
  const eyeWhiteGeometry = new THREE.SphereGeometry(0.045, 16, 16)
  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
  
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial)
  leftEyeWhite.position.set(-0.1, 1.58, 0.28)
  headGroup.add(leftEyeWhite)

  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial)
  rightEyeWhite.position.set(0.1, 1.58, 0.28)
  headGroup.add(rightEyeWhite)

  // Eyes - pupils
  const pupilGeometry = new THREE.SphereGeometry(0.025, 16, 16)
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27 })
  
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial)
  leftPupil.position.set(-0.1, 1.58, 0.31)
  headGroup.add(leftPupil)

  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial)
  rightPupil.position.set(0.1, 1.58, 0.31)
  headGroup.add(rightPupil)

  // Eyebrows
  const eyebrowGeometry = new THREE.BoxGeometry(0.08, 0.015, 0.02)
  const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2314 })
  
  const leftEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial)
  leftEyebrow.position.set(-0.1, 1.66, 0.28)
  leftEyebrow.rotation.z = 0.1
  headGroup.add(leftEyebrow)

  const rightEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial)
  rightEyebrow.position.set(0.1, 1.66, 0.28)
  rightEyebrow.rotation.z = -0.1
  headGroup.add(rightEyebrow)

  // Nose
  const noseGeometry = new THREE.ConeGeometry(0.03, 0.08, 8)
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xebc4b8 })
  const nose = new THREE.Mesh(noseGeometry, noseMaterial)
  nose.position.set(0, 1.5, 0.32)
  nose.rotation.x = Math.PI / 2
  headGroup.add(nose)

  // Mouth - outer lips (will be animated)
  const mouthGeometry = new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI)
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0xcc7777 })
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial)
  mouth.position.set(0, 1.4, 0.3)
  mouth.rotation.x = Math.PI
  mouth.rotation.z = Math.PI
  mouth.name = 'mouth'
  headGroup.add(mouth)

  // Inner mouth (dark, visible when open)
  const innerMouthGeometry = new THREE.CircleGeometry(0.04, 16)
  const innerMouthMaterial = new THREE.MeshStandardMaterial({ color: 0x331111, side: THREE.DoubleSide })
  const innerMouth = new THREE.Mesh(innerMouthGeometry, innerMouthMaterial)
  innerMouth.position.set(0, 1.4, 0.28)
  innerMouth.scale.y = 0.1
  innerMouth.name = 'innerMouth'
  headGroup.add(innerMouth)

  // Neck
  const neckGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.2, 16)
  const neckMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d0c5, roughness: 0.6 })
  const neck = new THREE.Mesh(neckGeometry, neckMaterial)
  neck.position.y = 1.25
  headGroup.add(neck)

  // Body/Shoulders
  const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.3, 0.5, 16)
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    roughness: 0.5
  })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.95
  headGroup.add(body)

  // Simple arm placeholders for wave animation
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d0c5, roughness: 0.6 })
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 12), armMaterial)
  leftArm.position.set(-0.3, 0.95, 0)
  leftArm.rotation.z = Math.PI / 2.5
  leftArm.name = 'DefaultLeftHand'
  headGroup.add(leftArm)

  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 12), armMaterial)
  rightArm.position.set(0.3, 0.95, 0)
  rightArm.rotation.z = -Math.PI / 2.5
  rightArm.name = 'DefaultRightHand'
  headGroup.add(rightArm)

  leftHandBone = leftArm
  rightHandBone = rightArm
  leftHandBaseRotation = leftArm.quaternion.clone()
  rightHandBaseRotation = rightArm.quaternion.clone()

  scene.add(headGroup)
  model = headGroup

  isLoading.value = false
  emit('loaded')
}

function loadModel(url: string) {
  const loader = new GLTFLoader()
  
  loader.load(
    url,
    (gltf) => {
      if (!scene) return

      model = gltf.scene
      scene.add(model)

      // Reset hand references for GLB model
      leftHandBone = null
      rightHandBone = null
      leftHandBaseRotation = null
      rightHandBaseRotation = null

      // Find meshes with morph targets and hands
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.morphTargetInfluences && child.morphTargetDictionary) {
          morphTargetMeshes.push(child)
        }

        const name = child.name?.toLowerCase() || ''
        if (!leftHandBone && (name.includes('lefthand') || name.includes('hand_l') || name.includes('left_hand'))) {
          leftHandBone = child
          leftHandBaseRotation = child.quaternion.clone()
        } else if (!rightHandBone && (name.includes('righthand') || name.includes('hand_r') || name.includes('right_hand'))) {
          rightHandBone = child
          rightHandBaseRotation = child.quaternion.clone()
        }
        
        // Find eye bones for bone-based blinking
        if (!leftEyeBone && (name === 'lefteye' || name === 'eye_l' || name === 'eyeleft')) {
          leftEyeBone = child
          leftEyeBaseScale = child.scale.clone()
        } else if (!rightEyeBone && (name === 'righteye' || name === 'eye_r' || name === 'eyeright')) {
          rightEyeBone = child
          rightEyeBaseScale = child.scale.clone()
        }
        
        // Find outfit meshes for color changing (exact name match)
        if (child instanceof THREE.Mesh) {
          if (child.name === 'Wolf3D_Outfit_Top') {
            outfitTopMesh = child
          } else if (child.name === 'Wolf3D_Outfit_Bottom') {
            outfitBottomMesh = child
          } else if (child.name === 'Wolf3D_Outfit_Footwear') {
            outfitFootwearMesh = child
          }
        }
      })
      
      // Check if we have eye blink morph targets
      hasEyeBlinkMorphs = morphTargetMeshes.some(mesh => {
        if (!mesh.morphTargetDictionary) return false
        return 'eyeBlinkLeft' in mesh.morphTargetDictionary || 'eyesClosed' in mesh.morphTargetDictionary
      })

      // Setup animation mixer if animations exist
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model)
        // Play idle animation if available
        const idleAnim = gltf.animations.find(a => 
          a.name.toLowerCase().includes('idle')
        )
        if (idleAnim) {
          mixer.clipAction(idleAnim).play()
        }
      }

      // Position model to show head/neck area
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      
      // Scale to fit nicely
      const scale = 1.8 / size.y
      model.scale.setScalar(scale)
      
      // Position so head is centered in view
      model.position.set(0, -0.3, 0)

      isLoading.value = false
      emit('loaded')
    },
    undefined,
    (error) => {
      loadError.value = 'Failed to load avatar model'
      isLoading.value = false
      createDefaultAvatar()
      emit('error', error as Error)
    }
  )
}

function animate() {
  // Safari fix: Check if animation should continue before requesting next frame
  if (!isAnimating) return
  
  animationFrameId = requestAnimationFrame(animate)

  if (!scene || !camera || !renderer) return

  const delta = clock?.getDelta() || 0
  const now = performance.now() // More accurate and faster than Date.now()

  // Update animation mixer
  if (mixer) {
    mixer.update(delta)
  }

  // Update idle animations (always running)
  updateIdleAnimations(now, delta)

  // Update lip-sync based on current viseme
  if (props.isSpeaking && props.visemes.length > 0) {
    updateLipSync()
    updateSpeakingExpressions(now)
  } else {
    resetMorphTargets()
  }

  renderer.render(scene, camera)
}

function updateIdleAnimations(now: number, delta: number) {
  // Update breath animation with configurable speed
  breathPhase += delta * props.breathingSpeed
  const breathAmount = Math.sin(breathPhase) * props.breathingIntensity
  
  // Update micro expressions with configurable speed
  microExpressionPhase += delta * props.microExpressionSpeed
  handGesturePhase += delta * props.handGestureSpeed
  
  // Eye blinking
  updateBlinking(now)
  
  // Eye movement (look around)
  updateEyeMovement(now)

  // Hand gestures
  updateHandGestures()
  
  // Apply idle morphs to GLB model (including breathing)
  if (morphTargetMeshes.length > 0) {
    applyIdleMorphs(breathAmount)
  }
}

function updateHandGestures() {
  if (!leftHandBone && !rightHandBone) return

  const baseIntensity = props.handGestureIntensity || 0
  if (baseIntensity <= 0) return

  const speakingBoost = props.isSpeaking ? 1.4 : 1
  const wave = Math.sin(handGesturePhase) * baseIntensity * speakingBoost
  const lift = (Math.sin(handGesturePhase * 0.6) + 1) * 0.5 * baseIntensity * speakingBoost

  if (leftHandBone && leftHandBaseRotation) {
    leftHandBone.quaternion.copy(leftHandBaseRotation)
    leftHandBone.rotateZ(wave)
    leftHandBone.rotateX(lift * 0.6)
  }

  if (rightHandBone && rightHandBaseRotation) {
    rightHandBone.quaternion.copy(rightHandBaseRotation)
    rightHandBone.rotateZ(-wave)
    rightHandBone.rotateX(lift * 0.6)
  }
}

function updateBlinking(now: number) {
  // Check if it's time for a new blink
  // Blink more frequently when speaking for natural look
  const speakingMultiplier = props.isSpeaking ? 0.6 : 1.0
  const adjustedInterval = nextBlinkInterval * speakingMultiplier
  
  if (!isBlinking && now - lastBlinkTime > adjustedInterval) {
    isBlinking = true
    blinkProgress = 0
    lastBlinkTime = now
    // Random interval for next blink using configurable range
    const range = props.blinkIntervalMax - props.blinkIntervalMin
    nextBlinkInterval = props.blinkIntervalMin + Math.random() * range
  }
  
  // Animate blink with configurable speed
  if (isBlinking) {
    blinkProgress += props.blinkSpeed
    
    if (blinkProgress >= 1) {
      isBlinking = false
      blinkProgress = 0
    }
  }
  
  // Calculate blink value (0 = open, 1 = closed)
  let blinkValue = 0
  if (isBlinking) {
    // Quick close, slower open
    if (blinkProgress < 0.4) {
      blinkValue = blinkProgress / 0.4
    } else {
      blinkValue = 1 - (blinkProgress - 0.4) / 0.6
    }
  }
  
  // Apply blink - try morph targets first, then bone animation
  if (hasEyeBlinkMorphs) {
    applyMorphTarget('eyeBlinkLeft', blinkValue)
    applyMorphTarget('eyeBlinkRight', blinkValue)
  } else if (leftEyeBone && rightEyeBone && leftEyeBaseScale && rightEyeBaseScale) {
    // Bone-based blinking: scale Y to simulate eyelid closing
    const scaleY = 1 - blinkValue * 0.9 // Scale down to 10% when fully closed
    leftEyeBone.scale.y = leftEyeBaseScale.y * scaleY
    rightEyeBone.scale.y = rightEyeBaseScale.y * scaleY
  } else {
    // Fallback: use mouthSmile as a subtle "expression" during blink
    // This creates a micro-expression effect
    if (isBlinking && blinkValue > 0.5) {
      applyMorphTarget('mouthSmile', 0.15)
    }
  }
}

function updateEyeMovement(now: number) {
  // Check if it's time for new eye target
  if (now - lastEyeMoveTime > nextEyeMoveInterval) {
    // Random look direction using configurable range
    eyeLookTarget.x = (Math.random() - 0.5) * props.eyeMoveRange * 2
    eyeLookTarget.y = (Math.random() - 0.5) * props.eyeMoveRange * 1.3
    lastEyeMoveTime = now
    // Random interval for next eye move using configurable range
    const range = props.eyeMoveIntervalMax - props.eyeMoveIntervalMin
    nextEyeMoveInterval = props.eyeMoveIntervalMin + Math.random() * range
  }
  
  // Smoothly interpolate eye position with configurable speed
  eyeLookCurrent.x += (eyeLookTarget.x - eyeLookCurrent.x) * props.eyeMoveSpeed
  eyeLookCurrent.y += (eyeLookTarget.y - eyeLookCurrent.y) * props.eyeMoveSpeed
  
  // Apply eye look morphs
  if (eyeLookCurrent.x > 0) {
    applyMorphTarget('eyeLookOutLeft', eyeLookCurrent.x)
    applyMorphTarget('eyeLookInRight', eyeLookCurrent.x)
    applyMorphTarget('eyeLookInLeft', 0)
    applyMorphTarget('eyeLookOutRight', 0)
  } else {
    applyMorphTarget('eyeLookInLeft', -eyeLookCurrent.x)
    applyMorphTarget('eyeLookOutRight', -eyeLookCurrent.x)
    applyMorphTarget('eyeLookOutLeft', 0)
    applyMorphTarget('eyeLookInRight', 0)
  }
  
  if (eyeLookCurrent.y > 0) {
    applyMorphTarget('eyeLookUpLeft', eyeLookCurrent.y)
    applyMorphTarget('eyeLookUpRight', eyeLookCurrent.y)
    applyMorphTarget('eyeLookDownLeft', 0)
    applyMorphTarget('eyeLookDownRight', 0)
  } else {
    applyMorphTarget('eyeLookDownLeft', -eyeLookCurrent.y)
    applyMorphTarget('eyeLookDownRight', -eyeLookCurrent.y)
    applyMorphTarget('eyeLookUpLeft', 0)
    applyMorphTarget('eyeLookUpRight', 0)
  }
}

function applyIdleMorphs(breathAmount: number) {
  // Breathing animation - very subtle chest movement (reduced from original)
  if (model) {
    // Apply breathing to model position (very subtle up/down)
    const baseY = -0.3
    model.position.y = baseY + breathAmount * 0.08
    
    // Very slight scale change for breathing effect
    const breathScale = 1 + breathAmount * 0.05
    model.scale.y = model.scale.x * breathScale
  }
  
  // Subtle micro expressions with configurable intensity
  const microSmile = Math.sin(microExpressionPhase) * props.microExpressionIntensity + props.microExpressionIntensity
  applyMorphTarget('mouthSmileLeft', microSmile)
  applyMorphTarget('mouthSmileRight', microSmile)
  
  // Subtle brow movement
  const browMove = Math.sin(microExpressionPhase * 0.7) * props.microExpressionIntensity * 0.6
  applyMorphTarget('browInnerUp', Math.max(0, browMove))
  
  // Cheek puff for breathing
  const cheekBreath = Math.max(0, Math.sin(breathPhase) * props.breathingIntensity * 0.5)
  applyMorphTarget('cheekPuff', cheekBreath)
}

function updateSpeakingExpressions(now: number) {
  // Add expressive eyebrow movements while speaking with configurable intensity
  const expressionPhase = now * 0.003
  const browUp = Math.sin(expressionPhase) * props.speakingBrowIntensity + props.speakingBrowIntensity * 0.67
  
  applyMorphTarget('browInnerUp', browUp)
  
  // Slight squint when speaking (engagement)
  applyMorphTarget('eyeSquintLeft', props.speakingSmileIntensity)
  applyMorphTarget('eyeSquintRight', props.speakingSmileIntensity)
  
  // Subtle smile while speaking with configurable intensity
  applyMorphTarget('mouthSmileLeft', props.speakingSmileIntensity)
  applyMorphTarget('mouthSmileRight', props.speakingSmileIntensity)
}

function applyMorphTarget(name: string, value: number, speed?: number) {
  const lerpSpeed = speed || 0.2
  morphTargetMeshes.forEach(mesh => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return
    
    const index = mesh.morphTargetDictionary[name]
    if (index !== undefined) {
      // Smooth interpolation
      const current = mesh.morphTargetInfluences[index] || 0
      mesh.morphTargetInfluences[index] = current + (value - current) * lerpSpeed
    }
  })
}

function updateLipSync() {
  const currentTime = props.currentTime
  
  // Early return if no morph meshes
  if (morphTargetMeshes.length === 0) return
  
  // Find current viseme based on time
  let currentViseme = 0
  let foundViseme = false
  for (const v of props.visemes) {
    if (currentTime >= v.time && currentTime < v.time + v.duration) {
      currentViseme = v.viseme
      foundViseme = true
      break
    }
  }
  
  // If no viseme found but we're speaking, use a default open mouth
  if (!foundViseme && props.isSpeaking && props.visemes.length > 0) {
    // Use the last viseme or interpolate
    const lastViseme = props.visemes[props.visemes.length - 1]
    if (currentTime < lastViseme.time + lastViseme.duration + 0.5) {
      currentViseme = 10 // Default to 'aa' (open mouth)
    }
  }

  // Apply morph targets
  applyViseme(currentViseme)
}

function applyViseme(visemeId: number) {
  // For default avatar, animate the mouth mesh
  if (model && !morphTargetMeshes.length) {
    const mouth = model.getObjectByName('mouth') as THREE.Mesh
    const innerMouth = model.getObjectByName('innerMouth') as THREE.Mesh
    
    if (mouth && innerMouth) {
      // Calculate mouth opening based on viseme type
      let openAmount = 0
      let widthAmount = 1
      
      if (visemeId === 0) {
        // Silence - closed mouth
        openAmount = 0.1
        widthAmount = 1
      } else if (visemeId >= 10 && visemeId <= 14) {
        // Vowels - wide open
        openAmount = 0.8 + (visemeId - 10) * 0.1
        widthAmount = visemeId === 12 ? 1.3 : visemeId === 14 ? 0.7 : 1
      } else if (visemeId >= 1 && visemeId <= 2) {
        // P, B, M, F, V - lips together/pursed
        openAmount = 0.2
        widthAmount = 0.8
      } else {
        // Other consonants
        openAmount = 0.4 + visemeId * 0.05
        widthAmount = 1
      }
      
      // Animate mouth shape
      mouth.scale.y = 0.8 + openAmount * 0.5
      mouth.scale.x = widthAmount
      
      // Animate inner mouth (dark opening)
      innerMouth.scale.y = openAmount
      innerMouth.scale.x = widthAmount * 0.8
    }
    return
  }

  // For GLB models with morph targets
  // Check if avatar has ARKit blendshapes (mouthLowerDownLeft, etc.) or just basic mouthOpen/mouthSmile
  const hasARKitBlendshapes = morphTargetMeshes.some(mesh => {
    if (!mesh.morphTargetDictionary) return false
    const keys = Object.keys(mesh.morphTargetDictionary)
    // Check for ARKit-style blendshapes
    return keys.some(k => k === 'mouthLowerDownLeft' || k === 'mouthLowerDownRight' || k.toLowerCase().includes('viseme'))
  })
  
  // Build target values for this viseme
  const targetValues: Record<string, number> = {}
  
  if (hasARKitBlendshapes) {
    // ARKit blendshapes support (Ready Player Me with ARKit morphs)
    const morphNames = VISEME_MORPH_MAP[visemeId] || []
    morphNames.forEach(name => {
      targetValues[name] = props.lipSyncIntensity
    })
    
  } else {
    // Basic avatar with only mouthOpen/mouthSmile
    // Map visemes to these simple targets
    let mouthOpenAmount = 0
    let mouthSmileAmount = 0
    
    if (visemeId === 0) {
      // Silence - mouth closed
      mouthOpenAmount = 0
      mouthSmileAmount = 0
    } else if (visemeId >= 10 && visemeId <= 14) {
      // Vowels (aa, E, I, O, U) - wide open mouth
      mouthOpenAmount = 0.6 + (visemeId - 10) * 0.08
      mouthSmileAmount = visemeId === 11 || visemeId === 12 ? 0.3 : 0 // E, I have smile
    } else if (visemeId >= 1 && visemeId <= 2) {
      // P, B, M, F, V - lips together/pursed
      mouthOpenAmount = 0.1
      mouthSmileAmount = 0
    } else if (visemeId === 7 || visemeId === 11 || visemeId === 12) {
      // S, Z, E, I - smile sounds
      mouthOpenAmount = 0.3
      mouthSmileAmount = 0.4
    } else {
      // Other consonants
      mouthOpenAmount = 0.25 + visemeId * 0.03
      mouthSmileAmount = 0.1
    }
    
    targetValues['mouthOpen'] = mouthOpenAmount * props.lipSyncIntensity
    targetValues['mouthSmile'] = mouthSmileAmount * props.lipSyncIntensity
  }
  
  morphTargetMeshes.forEach(mesh => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return

    // Smoothly interpolate all morph targets
    Object.keys(mesh.morphTargetDictionary).forEach(name => {
      const index = mesh.morphTargetDictionary![name]
      if (index === undefined) return
      
      // Get current and target values
      const currentValue = currentMorphValues[name] || 0
      const targetValue = targetValues[name] || 0
      
      // Use very smooth lerp for natural lip movement
      // Slower speed prevents jumping between visemes
      const diff = targetValue - currentValue
      
      // Apply exponential smoothing for more natural feel
      // Smaller movements are slower, larger movements catch up faster
      const absDiff = Math.abs(diff)
      const smoothFactor = Math.min(props.lipSyncSpeed * (0.5 + absDiff * 0.5), 0.08)
      
      let newValue = currentValue + diff * smoothFactor
      
      // Clamp very small values to zero to prevent jittering
      if (Math.abs(newValue) < 0.005) newValue = 0
      if (Math.abs(newValue - targetValue) < 0.005) newValue = targetValue
      
      // Apply and store
      mesh.morphTargetInfluences![index] = newValue
      currentMorphValues[name] = newValue
    })
  })
}

function resetMorphTargets() {
  // Reset default avatar mouth
  if (model && !morphTargetMeshes.length) {
    const mouth = model.getObjectByName('mouth') as THREE.Mesh
    if (mouth) {
      mouth.scale.y = 1
    }
    return
  }

  // Reset only speech-related morphs, keep idle animations
  const speechMorphs = [
    'jawOpen', 'mouthOpen', 'mouthSmile', 'mouthFunnel', 'mouthPucker', 'mouthClose',
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
  ]
  
  morphTargetMeshes.forEach(mesh => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return
    
    speechMorphs.forEach(name => {
      const index = mesh.morphTargetDictionary![name]
      if (index !== undefined) {
        mesh.morphTargetInfluences![index] *= 0.85 // Smooth decay
      }
    })
  })
}

function cleanup() {
  // Safari fix: Stop animation loop first
  isAnimating = false
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  // Dispose scene objects first
  if (scene) {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose())
        } else {
          object.material?.dispose()
        }
      }
    })
  }

  // Safari fix: Force WebGL context loss to free GPU memory
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    
    // Remove canvas from DOM
    if (containerRef.value && renderer.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }

  // Clear all references
  scene = null
  camera = null
  renderer = null
  model = null
  mixer = null
  clock = null
  morphTargetMeshes = []
  currentMorphValues = {}
  leftHandBone = null
  rightHandBone = null
  leftHandBaseRotation = null
  rightHandBaseRotation = null
  leftEyeBone = null
  rightEyeBone = null
  leftEyeBaseScale = null
  rightEyeBaseScale = null
}

// Watch for model URL changes
watch(() => props.modelUrl, (newUrl) => {
  if (newUrl && scene) {
    // Remove old model
    if (model) {
      scene.remove(model)
      model = null
    }
    morphTargetMeshes = []
    loadModel(newUrl)
  }
})

watch(
  () => [props.width, props.height] as const,
  ([newWidth, newHeight]) => {
    if (!newWidth || !newHeight) return
    applySize(newWidth, newHeight)
  }
)

// Watch for size changes
onMounted(() => {
  initScene()
})

onUnmounted(() => {
  cleanup()
})

// Apply outfit colors to avatar meshes
function applyOutfitColors(colors: { top: string; bottom: string; footwear: string }): void {
  if (outfitTopMesh?.material) {
    const mat = outfitTopMesh.material as THREE.MeshStandardMaterial
    if (mat.map) { mat.map = null; mat.needsUpdate = true }
    mat.color.set(colors.top)
  }
  if (outfitBottomMesh?.material) {
    const mat = outfitBottomMesh.material as THREE.MeshStandardMaterial
    if (mat.map) { mat.map = null; mat.needsUpdate = true }
    mat.color.set(colors.bottom)
  }
  if (outfitFootwearMesh?.material) {
    const mat = outfitFootwearMesh.material as THREE.MeshStandardMaterial
    if (mat.map) { mat.map = null; mat.needsUpdate = true }
    mat.color.set(colors.footwear)
  }
}

// Expose methods for parent component
defineExpose({
  applyOutfitColors
})
</script>

<template>
  <div class="liya-3d-avatar-widget-vuejs-avatar-scene" ref="containerRef">
    <div v-if="isLoading" class="liya-3d-avatar-widget-vuejs-avatar-loading">
      <div class="liya-3d-avatar-widget-vuejs-avatar-loading__spinner"></div>
      <span>Avatar yükleniyor...</span>
    </div>
    <div v-if="loadError" class="liya-3d-avatar-widget-vuejs-avatar-error">
      {{ loadError }}
    </div>
  </div>
</template>

<style scoped>
.liya-3d-avatar-widget-vuejs-avatar-scene {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  pointer-events: none;
}

.liya-3d-avatar-widget-vuejs-avatar-scene :deep(canvas) {
  pointer-events: none;
  display: block;
  margin: 0 auto;
}

.liya-3d-avatar-widget-vuejs-avatar-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #fff;
  font-size: 14px;
}

.liya-3d-avatar-widget-vuejs-avatar-loading__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: liya-3d-avatar-widget-vuejs-spin 1s linear infinite;
}

@keyframes liya-3d-avatar-widget-vuejs-spin {
  to { transform: rotate(360deg); }
}

.liya-3d-avatar-widget-vuejs-avatar-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  padding: 16px;
}
</style>
