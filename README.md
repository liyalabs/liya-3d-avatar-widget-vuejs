# @liyalabs/liya-3d-avatar-widget

3D Talking Avatar Widget - AI Assistant with real-time lip-sync animation for Vue.js 3.

## Features

- 🎭 **3D Avatar** - Three.js powered 3D avatar with customizable models (GLB/GLTF)
- 👄 **Lip-Sync** - Real-time lip synchronization using viseme data
- 🎤 **Voice Input** - Speech-to-text for hands-free interaction
- 🔊 **Voice Output** - Text-to-speech with avatar animation
- 💬 **Full Chat** - Complete chat widget with all features from liya-ai-chat-vue
- 📎 **File Upload** - Attach files to conversations
- 💡 **Suggestions** - Quick reply suggestions
- 🎨 **Customizable** - Theming, positioning, and branding options

## Installation

```bash
npm install @liyalabs/liya-3d-avatar-widget-vuejs
# or
yarn add @liyalabs/liya-3d-avatar-widget-vuejs
# or
pnpm add @liyalabs/liya-3d-avatar-widget-vuejs
```

## Quick Start

### 1. Initialize the Plugin

```typescript
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import LiyaAvatarWidget from '@liyalabs/liya-3d-avatar-widget'
import '@liyalabs/liya-3d-avatar-widget/style.css'

const app = createApp(App)

app.use(LiyaAvatarWidget, {
  apiUrl: 'https://your-api-url.com',
  apiKey: 'your-api-key',
  assistantId: 'your-assistant-id',
  assistantName: 'AI Assistant'
})

app.mount('#app')
```

### 2. Use the Widget Component

```vue
<template>
  <LiyaAvatarWidget
    :show-avatar-button="true"
    avatar-model-url="/models/avatar.glb"
    welcome-message="Merhaba! Size nasıl yardımcı olabilirim?"
    @avatar-opened="onAvatarOpened"
    @message-sent="onMessageSent"
  />
</template>

<script setup>
import { LiyaAvatarWidget } from '@liyalabs/liya-3d-avatar-widget'

function onAvatarOpened() {
  console.log('Avatar modal opened')
}

function onMessageSent(message) {
  console.log('Message sent:', message)
}
</script>
```

## Components

### LiyaAvatarWidget

Main widget component with chat panel and avatar button.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Widget position |
| `showAvatarButton` | `boolean` | `true` | Show "Talk with Avatar" button |
| `avatarModelUrl` | `string` | `''` | URL to GLB/GLTF avatar model |
| `welcomeMessage` | `string` | `'...'` | Welcome message |
| `showVoice` | `boolean` | `true` | Show voice input button |
| `showFileUpload` | `boolean` | `true` | Show file upload button |
| `theme` | `ThemeConfig` | `{}` | Theme customization |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `opened` | - | Chat panel opened |
| `closed` | - | Chat panel closed |
| `avatarOpened` | - | Avatar modal opened |
| `avatarClosed` | - | Avatar modal closed |
| `messageSent` | `string` | User sent a message |
| `messageReceived` | `string` | Assistant responded |

### AvatarModal

Standalone avatar modal component.

```vue
<template>
  <AvatarModal
    :is-open="isOpen"
    model-url="/models/avatar.glb"
    assistant-name="AI Assistant"
    @close="isOpen = false"
  />
</template>
```

### AvatarScene

3D avatar scene component (Three.js).

```vue
<template>
  <AvatarScene
    model-url="/models/avatar.glb"
    :width="400"
    :height="500"
    :is-speaking="isSpeaking"
    :visemes="visemeData"
    :current-time="audioTime"
  />
</template>
```

## Avatar Models

The widget supports GLB/GLTF models with ARKit-compatible blend shapes for lip-sync:

- **Ready Player Me** avatars (recommended)
- Custom models with viseme morph targets

### Supported Viseme Morph Targets

```
viseme_PP, viseme_FF, viseme_TH, viseme_DD, viseme_kk,
viseme_CH, viseme_SS, viseme_nn, viseme_RR, viseme_aa,
viseme_E, viseme_I, viseme_O, viseme_U
```

## API Functions

```typescript
import { 
  generateAvatarSpeech, 
  textToSpeech,
  sendMessage,
  useChat,
  useVoice
} from '@liyalabs/liya-3d-avatar-widget'

// Generate speech with viseme data
const result = await generateAvatarSpeech('Merhaba!', { voice: 'nova' })
console.log(result.visemes) // Lip-sync timing data
console.log(result.audio_base64) // Audio data

// Use chat composable
const { messages, sendMessage, isLoading } = useChat()

// Use voice composable
const { isRecording, transcript, startRecording, stopRecording } = useVoice()
```

## Backend Requirements

This widget requires the Liya AI backend with the following endpoints:

- `POST /api/v1/external/chat/` - Chat messages
- `POST /api/v1/external/avatar/speech/` - Avatar speech with visemes
- `POST /api/v1/external/tts/` - Text-to-speech

## Theme Customization

```vue
<LiyaAvatarWidget
  :theme="{
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#374151',
    borderRadius: '16px',
    fontFamily: 'Inter, sans-serif'
  }"
/>
```

## License

MIT © Liya Labs
