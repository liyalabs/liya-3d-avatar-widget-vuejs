# Tutorial 05 — Embed 3D Avatar Widget in Nuxt 3 (Kiosk Mode)

> **LiyaAI Coding Agent prompt** for the 5th tutorial video.  
> Goal: scaffold a single-page Nuxt 3 app, install the 3D avatar widget, and have
> the avatar respond to "Merhaba" in the browser — all under 5 minutes.

---

## LiyaAI Coding Agent Prompt

Paste the block below as-is into the **LiyaAI Coding Agent** chat inside VS Code
(workspace: `LiyaAiKiosk_Sales_Assistant`).

---

```
You are a senior Vue.js developer. I need a working Nuxt 3 single-page app that
embeds the @liyalabs/liya-3d-avatar-widget-vuejs package in kiosk (full-screen)
mode so the user can type "Merhaba" and see the 3D talking avatar respond in the
browser. Complete the entire setup in the current workspace folder. Do not ask
questions — execute each step immediately.

─────────────────────────────────────────────
REFERENCE DOCS  (read these before writing any code)
─────────────────────────────────────────────
• npm package  : https://www.npmjs.com/package/@liyalabs/liya-3d-avatar-widget-vuejs
• API docs     : https://ai.liyalabs.com/developer/
• OpenAPI spec : on the developer page → Endpoints tab → "OpenAPI Specification"
                 → download LiyaAi-Api-External-V0-en.yaml
                 The spec describes all /api/v1/external/ endpoints, auth header,
                 GAR backend URLs, and feature access tiers.

─────────────────────────────────────────────
CREDENTIALS  (replace with real values before running)
─────────────────────────────────────────────
API_KEY      = YOUR_LIYA_API_KEY          # X-API-Key header — get from ai.liyalabs.com → Projects → API Keys
ASSISTANT_ID = YOUR_LIYA_ASSISTANT_ID     # get from ai.liyalabs.com → Assistants
BASE_URL     = https://app-1-ai.liyalabs.com   # your GAR instance — see ai.liyalabs.com → Settings → API Configuration

─────────────────────────────────────────────
STEPS  (execute in order, do not skip any)
─────────────────────────────────────────────

STEP 1 — Scaffold Nuxt 3 project
Run in terminal:
  npx nuxi@latest init . --no-install --package-manager npm
Accept all defaults (app router, no modules).
Then run: npm install

STEP 2 — Install the widget
  npm install @liyalabs/liya-3d-avatar-widget-vuejs

STEP 3 — Create Nuxt plugin  plugins/liya-avatar.client.ts
  import { LiyaChatPlugin } from '@liyalabs/liya-3d-avatar-widget-vuejs'
  import '@liyalabs/liya-3d-avatar-widget-vuejs/style.css'

  export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(LiyaChatPlugin, {
      mode: 'kiosk',
      apiKey: 'YOUR_LIYA_API_KEY',
      baseUrl: 'https://app-1-ai.liyalabs.com',
      assistantId: 'YOUR_LIYA_ASSISTANT_ID',
      assistantName: 'Satış Asistanı',
      locale: 'tr',
      welcomeMessage: 'Merhaba! Ben Liya. Size nasıl yardımcı olabilirim?',
      welcomeSuggestions: ['Merhaba', 'Ürünleriniz neler?', 'Fiyat bilgisi'],
      autoSpeak: true,
      viewOnPageStart: true,
    })
  })

STEP 4 — Create the single page  app.vue  (replace the default)
  <template>
    <div style="width:100vw; height:100vh; background:#0f172a; overflow:hidden;">
      <LiyaAvatarWidget />
    </div>
  </template>

  <script setup>
  import { LiyaAvatarWidget } from '@liyalabs/liya-3d-avatar-widget-vuejs'
  </script>

STEP 5 — Configure nuxt.config.ts
  export default defineNuxtConfig({
    ssr: false,
    css: [],
    vite: {
      optimizeDeps: {
        include: ['three']
      }
    }
  })

STEP 6 — Start the dev server
  npm run dev
  Open http://localhost:3000

STEP 7 — Verify in the browser
  The full-screen kiosk opens automatically (viewOnPageStart: true).
  Type "Merhaba" in the chat input.
  The 3D avatar should animate, lip-sync, and speak the reply.
  If you see "[Liya3DAvatar] assistantId is required", check STEP 3 credentials.
  If the avatar model does not load, confirm the assistant has PREMIUM or
  PREMIUM PLUS tier (3D Avatar requires PREMIUM+).

─────────────────────────────────────────────
DONE — the whole setup should take under 5 minutes.
─────────────────────────────────────────────
```

---

## Video checklist

- [ ] Fresh empty workspace `LiyaAiKiosk_Sales_Assistant` open in VS Code
- [ ] LiyaAI Coding Agent panel open (sidebar)
- [ ] Paste prompt → agent executes all 7 steps autonomously
- [ ] Replace `YOUR_LIYA_API_KEY` and `YOUR_LIYA_ASSISTANT_ID` before `npm run dev`
- [ ] Browser shows full-screen kiosk with 3D avatar
- [ ] Type "Merhaba" → avatar speaks

## Notes

- `mode: 'kiosk'` = full-screen layout, no toggle button.  
  Use `mode: 'modal_kiosk'` for a floating button that opens the kiosk overlay.
- The avatar model URL is fetched automatically from the backend via  
  `GET /api/v1/external/avatar/model/` (PREMIUM PLUS only).  
  For PREMIUM accounts use `mode: 'modal_kiosk'` (standard chat + avatar modal).
- Full OpenAPI spec at **[ai.liyalabs.com/developer](https://ai.liyalabs.com/developer)** →
  Endpoints tab → download `LiyaAi-Api-External-V0-en.yaml`.
