# noosphere

Unified AI creation engine — text, image, video, and audio generation across all providers through a single interface.

One import. Every model. Every modality.

## Features

- **7 modalities** — LLM, image, video, TTS, STT, music, and embeddings
- **OpenAI media** — GPT-Image-1/1.5, DALL-E 2/3, Sora 2/Pro (video), TTS-1/HD, Whisper — all auto-fetched from `OPENAI_API_KEY`
- **Google media** — Imagen 4.0 (image), Veo 2/3/3.1 (video), Gemini TTS — all auto-fetched from `GEMINI_API_KEY`
- **Always up-to-date models** — Dynamic auto-fetch from ALL provider APIs at runtime (OpenAI, Anthropic, Google, Groq, Mistral, xAI, Cerebras, OpenRouter)
- **Dynamic descriptions** — Model descriptions fetched from source (Ollama library, HuggingFace READMEs, CivitAI API) — no hardcoded strings
- **Modality-filtered sync** — `syncModels('llm')` only fetches LLM providers, avoiding unnecessary requests
- **867+ media endpoints** — via FAL (Flux, SDXL, Kling, Sora 2, VEO 3, Kokoro, ElevenLabs, and hundreds more)
- **30+ HuggingFace tasks** — LLM, image, TTS, translation, summarization, classification, and more
- **Local-first architecture** — Auto-detects Ollama, ComfyUI, Whisper, AudioCraft, Piper, and Kokoro on your machine
- **Org-aware logos** — HuggingFace models show the real org logo (Meta, Google, NVIDIA) instead of generic HF logo
- **Pre-request token counting** — Count tokens before sending, for ALL providers (OpenAI/Groq/Ollama via tiktoken, Google/Anthropic via API)
- **Full pi-ai access** — Agent loop with tool calling, preprocessor (compaction hook), `calculateCost`, direct stream/complete APIs — all re-exported
- **Agentic capabilities** — Tool use, function calling, reasoning/thinking, vision, and agent loops via Pi-AI
- **Failover & retry** — Automatic retries with exponential backoff and cross-provider failover
- **Usage tracking** — Real-time cost, latency, and token tracking across all providers
- **TypeScript-first** — Full type definitions with ESM and CommonJS support

## Install

```bash
npm install noosphere
```

## Quick Start

```typescript
import { Noosphere } from 'noosphere';

const ai = new Noosphere();

// Chat with any LLM
const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.content);

// Generate an image with GPT-Image-1 (OpenAI) — just needs OPENAI_API_KEY
const image = await ai.image({
  prompt: 'A sunset over mountains',
  provider: 'openai-media',
});
// image.buffer contains the PNG data

// Generate an image with Imagen 4.0 (Google) — just needs GEMINI_API_KEY
const googleImage = await ai.image({
  prompt: 'A sunset over mountains',
  provider: 'google-media',
});
// googleImage.buffer contains the PNG data

// Generate an image with DALL-E 3
const dalle = await ai.image({
  prompt: 'A sunset over mountains',
  provider: 'openai-media',
  model: 'dall-e-3',
  width: 1024,
  height: 1024,
});
console.log(dalle.url);

// Generate a video
const video = await ai.video({
  prompt: 'Ocean waves crashing on rocks',
  duration: 5,
});
console.log(video.url);

// Text-to-speech with OpenAI TTS — just needs OPENAI_API_KEY
const audio = await ai.speak({
  text: 'Welcome to Noosphere',
  voice: 'alloy',
  format: 'mp3',
});
// audio.buffer contains the audio data
```

## Dynamic Model Auto-Fetch — Always Up-to-Date (ALL Providers, ALL Modalities)

Noosphere **automatically discovers the latest models from EVERY provider's API at runtime** — across **all 4 modalities** (LLM, image, video, TTS). When Google releases a new Gemini model, when OpenAI drops GPT-5, when FAL adds a new video model, when a new image model trends on HuggingFace — **you get them immediately**, without updating Noosphere or any dependency.

### Provider Logos — SVG & PNG for Every Model

Every model returned by the auto-fetch includes a `logo` field with **CDN URLs** to the provider's official logo — SVG (vector) and PNG (512×512), hosted on DigitalOcean Spaces. For aggregator providers (OpenRouter, HuggingFace), logos are resolved to the **real upstream provider** — so an `x-ai/grok-4` model gets the xAI logo, not OpenRouter's.

```typescript
const models = await ai.getModels('llm');

for (const model of models) {
  console.log(model.id, model.logo);
  // "gpt-5"          { svg: "https://...cdn.../openai.svg", png: "https://...cdn.../openai.png" }
  // "claude-opus-4-6" { svg: "https://...cdn.../anthropic.svg", png: "https://...cdn.../anthropic.png" }
  // "gemini-2.5-pro"  { svg: "https://...cdn.../google.svg", png: "https://...cdn.../google.png" }
}

// Use directly in your UI:
// <img src={model.logo.svg} alt={model.provider} />
// <img src={model.logo.png} width={48} height={48} />;
}

// Providers also have logos:
const providers = await ai.getProviders();
providers.forEach(p => console.log(p.id, p.logo));
```

**28 providers covered (23 SVG + 28 PNG):**

| Provider | SVG | PNG | Source |
|---|---|---|---|
| OpenAI, Anthropic, Google, Groq, Mistral, xAI | ✓ | ✓ | Official brand assets |
| OpenRouter, Cerebras, Meta, DeepSeek | ✓ | ✓ | Official brand assets |
| Microsoft, NVIDIA, Qwen, Cohere, Perplexity | ✓ | ✓ | Official brand assets |
| Amazon, Together, Fireworks, Replicate | ✓ | ✓ | Official brand assets |
| HuggingFace, Ollama, Nebius, Novita | ✓ | ✓ | Official brand assets |
| FAL, ComfyUI, Piper, Kokoro, SambaNova | ✗ | ✓ | GitHub avatars (512×512) |

You can also import the logo registry directly:

```typescript
import { getProviderLogo, PROVIDER_LOGOS, getAllProviderLogos } from 'noosphere';

const logo = getProviderLogo('anthropic');
// { svg: "https://...cdn.../anthropic.svg", png: "https://...cdn.../anthropic.png" }

// Get all logos as a map:
const allLogos = getAllProviderLogos();
console.log(Object.keys(allLogos));
// ['openai', 'anthropic', 'google', 'groq', 'mistral', 'xai', 'openrouter', ...]
```

For HuggingFace models with multiple inference providers, per-provider logos are available in `capabilities.inferenceProviderLogos`:

```typescript
const hfModels = await ai.getModels('llm');
const qwen = hfModels.find(m => m.id === 'Qwen/Qwen2.5-72B-Instruct');

console.log(qwen.capabilities.inferenceProviderLogos);
// {
//   "together": { svg: "https://...cdn.../together.svg", png: "https://...cdn.../together.png" },
//   "fireworks-ai": { svg: "https://...cdn.../fireworks-ai.svg", png: "https://...cdn.../fireworks-ai.png" },
// }
```

### The Problem It Solves

Traditional AI libraries rely on **static model catalogs** hardcoded at build time. The `@mariozechner/pi-ai` dependency ships with ~246 LLM models in a pre-generated `models.generated.js` file. HuggingFace providers typically hardcode 3-5 default models. When a provider releases a new model, you'd have to wait for the library maintainer to update, publish, and then you'd `npm update`. This lag can be days or weeks.

**Noosphere solves this for every provider and every modality simultaneously.**

### How It Works — Complete Auto-Fetch Architecture

Noosphere has **3 independent auto-fetch systems** that work in parallel, one for each provider layer:

```
┌─────────────────────────────────────────────────────────────┐
│                   NOOSPHERE AUTO-FETCH                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Pi-AI Provider (LLM) ─────────────────────────────┐  │
│  │  8 parallel API calls on first chat()/stream():       │  │
│  │  OpenAI, Anthropic, Google, Groq, Mistral,            │  │
│  │  xAI, OpenRouter, Cerebras                            │  │
│  │  → Merges with static pi-ai catalog (246 models)      │  │
│  │  → Constructs synthetic Model objects for new ones     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── FAL Provider (Image/Video/TTS) ───────────────────┐  │
│  │  1 API call on listModels():                          │  │
│  │  GET https://api.fal.ai/v1/models/pricing             │  │
│  │  → Returns ALL 867+ endpoints with live pricing       │  │
│  │  → Auto-classifies modality from model ID + unit      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── HuggingFace Provider (LLM/Image/TTS) ────────────┐  │
│  │  3 parallel API calls on listModels():                │  │
│  │  GET huggingface.co/api/models?pipeline_tag=...       │  │
│  │  → text-generation (top 50 trending, inference-ready) │  │
│  │  → text-to-image (top 50 trending, inference-ready)   │  │
│  │  → text-to-speech (top 30 trending, inference-ready)  │  │
│  │  → Includes inference provider mapping + pricing      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: LLM Auto-Fetch (Pi-AI Provider) — 8 Provider APIs

On the **first `chat()` or `stream()` call**, Pi-AI queries every LLM provider's model listing API in parallel:

| Provider | API Endpoint | Auth | Model Filter | API Protocol |
|---|---|---|---|---|
| **OpenAI** | `GET /v1/models` | Bearer token | `gpt-*`, `o1*`, `o3*`, `o4*`, `chatgpt-*`, `codex-*` | `openai-responses` |
| **Anthropic** | `GET /v1/models?limit=100` | `x-api-key` + `anthropic-version: 2023-06-01` | `claude-*` | `anthropic-messages` |
| **Google** | `GET /v1beta/models?key=KEY` | API key in URL | `gemini-*`, `gemma-*` + must support `generateContent` | `google-generative-ai` |
| **Groq** | `GET /openai/v1/models` | Bearer token | All (Groq only serves chat models) | `openai-completions` |
| **Mistral** | `GET /v1/models` | Bearer token | Exclude `*embed*` | `openai-completions` |
| **xAI** | `GET /v1/models` | Bearer token | `grok*` | `openai-completions` |
| **OpenRouter** | `GET /api/v1/models` | Bearer token | All (all OpenRouter models are usable) | `openai-completions` |
| **Cerebras** | `GET /v1/models` | Bearer token | All (Cerebras only serves chat models) | `openai-completions` |

**How new LLM models become usable:** When a model isn't in the static catalog, Noosphere constructs a **synthetic `Model` object** with the correct API protocol, base URL, and inherited cost data:

```typescript
// New model "gpt-4.5-turbo" discovered from OpenAI's /v1/models:
{
  id: 'gpt-4.5-turbo',
  name: 'gpt-4.5-turbo',
  api: 'openai-responses',              // Correct protocol for OpenAI
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  reasoning: false,                      // Inferred from model ID prefix
  input: ['text', 'image'],
  cost: { input: 2.5, output: 10, ... },  // Inherited from template model
  contextWindow: 128000,                   // From template or API response
  maxTokens: 16384,
}
// This object is passed directly to pi-ai's complete()/stream() — works immediately
```

### Layer 2: Image/Video/TTS Auto-Fetch (FAL Provider) — Pricing API

FAL already provides a **fully dynamic catalog**. On `listModels()`, it fetches from `https://api.fal.ai/v1/models/pricing`:

```typescript
// FAL returns an array with ALL available endpoints + live pricing:
[
  { modelId: "fal-ai/flux-pro/v1.1-ultra", price: 0.06, unit: "per_image" },
  { modelId: "fal-ai/kling-video/v2/master/text-to-video", price: 0.10, unit: "per_second" },
  { modelId: "fal-ai/kokoro/american-english", price: 0.002, unit: "per_1k_chars" },
  // ... 867+ endpoints total
]

// Modality is auto-inferred from model ID + pricing unit:
// - unit contains 'char' OR id contains 'tts'/'kokoro'/'elevenlabs' → TTS
// - unit contains 'second' OR id contains 'video'/'kling'/'sora'/'veo' → Video
// - Everything else → Image
```

**Result:** Every FAL model is always current — new endpoints appear the moment FAL publishes them. Pricing is always accurate because it comes directly from their API.

### Layer 3: LLM/Image/TTS Auto-Fetch (HuggingFace Provider) — Hub API

Instead of 3 hardcoded defaults, HuggingFace now fetches **trending inference-ready models** from the Hub API across all 3 modalities:

```
GET https://huggingface.co/api/models
  ?pipeline_tag=text-generation       ← LLM models
  &inference_provider=all             ← Only models available via inference API
  &sort=trendingScore                 ← Most popular first
  &limit=50                           ← Top 50
  &expand[]=inferenceProviderMapping  ← Include provider routing + pricing
```

| Pipeline Tag | Modality | Limit | What It Fetches |
|---|---|---|---|
| `text-generation` | LLM | 50 | Top 50 trending chat/completion models with active inference endpoints |
| `text-to-image` | Image | 50 | Top 50 trending image generation models (SDXL, Flux, etc.) |
| `text-to-speech` | TTS | 30 | Top 30 trending TTS models with active inference endpoints |

**What the Hub API returns per model:**
```json
{
  "id": "Qwen/Qwen2.5-72B-Instruct",
  "pipeline_tag": "text-generation",
  "likes": 1893,
  "downloads": 4521987,
  "inferenceProviderMapping": [
    {
      "provider": "together",
      "providerId": "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "status": "live",
      "providerDetails": {
        "context_length": 32768,
        "pricing": { "input": 1.2, "output": 1.2 }
      }
    },
    {
      "provider": "fireworks-ai",
      "providerId": "accounts/fireworks/models/qwen2p5-72b-instruct",
      "status": "live"
    }
  ]
}
```

**Noosphere extracts from this:**
- Model ID → `id` field
- Pricing → first provider with `providerDetails.pricing`
- Context window → first provider with `providerDetails.context_length`
- Inference providers → list of available providers (Together, Fireworks, Groq, etc.)

**Three requests fire in parallel** (`Promise.allSettled`) with a **10-second timeout** each. If any fails, the 3 hardcoded defaults are always available as fallback.

### Resilience Guarantees (All Layers)

| Guarantee | Pi-AI (LLM) | FAL (Image/Video/TTS) | HuggingFace (LLM/Image/TTS) |
|---|---|---|---|
| **Timeout** | 8s per provider | No custom timeout | 10s per pipeline_tag |
| **Parallelism** | 8 concurrent requests | 1 request (returns all) | 3 concurrent requests |
| **Failure handling** | `Promise.allSettled` | Returns `[]` on error | `Promise.allSettled` |
| **Fallback** | Static pi-ai catalog (246 models) | Empty list (provider still usable by model ID) | 3 hardcoded defaults |
| **Caching** | One-time fetch, cached in memory | Per `listModels()` call | One-time fetch, cached in memory |
| **Auth required** | Yes (per-provider API keys) | Yes (FAL key) | Optional (works without token) |

### Total Model Coverage

| Source | Modalities | Model Count | Update Frequency |
|---|---|---|---|
| Pi-AI static catalog | LLM | ~246 | On npm update |
| Pi-AI dynamic fetch | LLM | **All models across 8 providers** | **Every session** |
| FAL pricing API | Image, Video, TTS | 867+ | **Every `listModels()` call** |
| HuggingFace Hub API | LLM, Image, TTS | Top 130 trending | **Every session** |
| ComfyUI `/object_info` | Image | Local checkpoints | **Every `listModels()` call** |
| Local TTS `/voices` | TTS | Local voices | **Every `listModels()` call** |

### Force Refresh

```typescript
const ai = new Noosphere();

// Models are auto-fetched on first call — no action needed:
await ai.chat({ model: 'gemini-2.5-ultra', messages: [...] }); // works immediately

// Trigger a full sync across ALL providers:
const result = await ai.syncModels();
// result = { synced: 1200+, byProvider: { 'pi-ai': 300, 'fal': 867, 'huggingface': 130, ... }, errors: [] }

// Get all models for a specific modality:
const imageModels = await ai.getModels('image');
// Returns: FAL image models + HuggingFace image models + ComfyUI models
```

### Why Hybrid (Static + Dynamic)?

| Approach | Pros | Cons |
|---|---|---|
| **Static catalog only** | Accurate costs, fast startup | Stale within days, miss new models |
| **Dynamic only** | Always current | No cost data, no context window info, slow startup |
| **Hybrid (Noosphere)** | Best of both — accurate data for known models + immediate access to new ones | New models have estimated costs until catalog update |

---

## Local Models — Run Everything on Your Machine

Noosphere has **comprehensive local model support** across all modalities — LLM, image, video, TTS, STT, and music. Auto-discovers what's installed, catalogs what's available to download, and provides a unified API for everything.

### Quick Start

```typescript
const ai = new Noosphere();
await ai.syncModels();

// 774 models discovered — cloud + local, all modalities
const all = await ai.getModels();

// Filter by what you can run locally
const localModels = all.filter(m => m.local || m.status === 'installed');

// What's installed vs what's available to download
const installed = all.filter(m => m.status === 'installed');   // 39 models ready to use
const available = all.filter(m => m.status === 'available');   // 251 models you can download

// Chat with a local Ollama model — same API as cloud
const result = await ai.chat({
  model: 'qwen3:8b',
  provider: 'ollama',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(result.content);   // "Hello! How can I help?"
console.log(result.usage);     // { cost: 0, input: 24, output: 198, unit: 'tokens' }

// Install a new model from Ollama library
await ai.installModel('deepseek-r1:14b');

// Uninstall
await ai.uninstallModel('deepseek-r1:14b');
```

### 8 Providers, 5 Modalities, 774+ Models

| Provider | Modality | Models | Source | Auto-Detect |
|---|---|---|---|---|
| **pi-ai** | LLM | 482 | OpenAI, Anthropic, Google, Groq, Mistral, xAI, OpenRouter, Cerebras | API keys |
| **openai-media** | image, video, tts, stt | 12 | GPT-Image-1/1.5, DALL-E 2/3, Sora 2/Pro, TTS-1/HD, Whisper | `OPENAI_API_KEY` |
| **google-media** | image, video, tts | 10 | Imagen 4.0, Veo 2/3/3.1, Gemini TTS (Flash/Pro) | `GEMINI_API_KEY` |
| **ollama** | LLM, embedding | 70 | 38 installed + 32 from Ollama web catalog | `localhost:11434` |
| **hf-local** | image, video, tts, stt, music | 220 | HuggingFace catalog (FLUX, SDXL, Wan2.2, Whisper, MusicGen) | Always (no API key) |
| **huggingface** | LLM, image, tts | dynamic | HuggingFace Inference API | `HUGGINGFACE_TOKEN` |
| **comfyui** | image, video | dynamic | Installed checkpoints + CivitAI catalog | `localhost:8188` |
| **openai-compat** | LLM | dynamic | llama.cpp, LM Studio, vLLM, LocalAI, KoboldCpp, Jan, TabbyAPI | Scans ports |
| **fal** | image, video, tts | 867+ | FAL.ai (Flux, SDXL, Kling, Sora 2, Kokoro, ElevenLabs) | `FAL_KEY` |
| **piper** | TTS | 2+ | Piper voices installed locally | Binary detection |
| **whisper-local** | STT | 8 | Whisper/Faster-Whisper (tiny → large-v3) | Python detection |
| **audiocraft** | music | 5 | MusicGen (small/medium/large/melody) + AudioGen | Python detection |

### Modality-Filtered Sync — Only Fetch What You Need

Sync **only the providers relevant to a specific modality** instead of fetching everything. This avoids unnecessary network requests (e.g., fetching 270+ HuggingFace READMEs when you only need LLMs).

```typescript
// Sync only LLM providers (Ollama, pi-ai, openai-compat, huggingface)
await ai.syncModels('llm');

// Sync only image providers (hf-local, comfyui, fal, huggingface)
await ai.syncModels('image');

// Sync only STT providers (whisper-local, hf-local)
await ai.syncModels('stt');

// Sync everything (backward compatible)
await ai.syncModels();
```

**Which providers sync for each modality:**

| Modality | Providers Synced |
|---|---|
| `llm` | pi-ai, ollama, openai-compat, huggingface (cloud) |
| `image` | **openai-media** (GPT-Image-1, DALL-E), **google-media** (Imagen 4.0), hf-local, comfyui, fal, huggingface (cloud) |
| `video` | **openai-media** (Sora 2/Pro), **google-media** (Veo 2/3/3.1), hf-local, comfyui, fal |
| `tts` | **openai-media** (TTS-1, TTS-1-HD), **google-media** (Gemini TTS), hf-local, fal, piper, kokoro, huggingface (cloud) |
| `stt` | **openai-media** (Whisper), hf-local, whisper-local |
| `music` | hf-local (MusicGen, AudioLDM, etc.), audiocraft |
| `embedding` | ollama |

### Models by Modality

```typescript
const models = await ai.getModels();

// Filter by modality
const llm    = models.filter(m => m.modality === 'llm');    // 552 (cloud + Ollama local)
const image  = models.filter(m => m.modality === 'image');  // 101 (FLUX, SDXL, SD3, PixArt...)
const tts    = models.filter(m => m.modality === 'tts');    //  61 (MusicGen, Bark, Piper, Kokoro...)
const video  = models.filter(m => m.modality === 'video');  //  30 (Wan2.2, CogVideoX, AnimateDiff...)
const stt    = models.filter(m => m.modality === 'stt');    //  30 (Whisper, wav2vec2...)
```

### Ollama Provider — Local LLM

Full integration with Ollama's API:

```typescript
// Auto-detected on startup — no config needed
// Models include full metadata from Ollama

const ollamaModels = models.filter(m => m.provider === 'ollama');
for (const m of ollamaModels) {
  console.log(m.id);                      // "llama3.3:70b"
  console.log(m.status);                  // "installed" | "available" | "running"
  console.log(m.localInfo.parameterSize); // "70.6B"
  console.log(m.localInfo.quantization);  // "Q4_K_M"
  console.log(m.localInfo.sizeBytes);     // 42520413916
  console.log(m.localInfo.family);        // "llama"
  console.log(m.logo);                    // { svg: "...meta.svg", png: "...meta.png" }
}

// Chat with streaming
const stream = ai.stream({
  model: 'qwen3:8b',
  provider: 'ollama',
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
});

for await (const event of stream) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
}

const finalResult = await stream.result();

// Model management
await ai.installModel('deepseek-r1:14b');     // Downloads from Ollama library
await ai.uninstallModel('old-model:7b');       // Removes from disk

// Hardware info
const hw = await ai.getHardware();
// { ollama: true, runningModels: [{ name: 'qwen3:8b', size: 5200000000, ... }] }
```

### OpenAI-Compatible Provider — Any Local Server

Connects to ANY server that implements the OpenAI API:

```typescript
// Auto-detects servers on common ports:
// llama.cpp (:8080), LM Studio (:1234), vLLM (:8000)
// LocalAI (:8080), TabbyAPI (:5000), KoboldCpp (:5001), Jan (:1337)

// Or configure manually:
const ai = new Noosphere({
  openaiCompat: [
    { baseUrl: 'http://localhost:1234/v1', name: 'LM Studio' },
    { baseUrl: 'http://192.168.1.100:8080/v1', name: 'Remote llama.cpp' },
  ],
});
```

### HuggingFace Local Catalog

Auto-fetches the top models by downloads for each modality:

```typescript
const imageModels = models.filter(m => m.provider === 'hf-local' && m.modality === 'image');
// → FLUX.1-dev, FLUX.1-schnell, SDXL, SD 3.5, PixArt-Σ, Playground v2.5, Kolors...

const videoModels = models.filter(m => m.provider === 'hf-local' && m.modality === 'video');
// → Wan2.2-T2V, CogVideoX-5b, AnimateDiff, Stable Video Diffusion...

const ttsModels = models.filter(m => m.provider === 'hf-local' && m.modality === 'tts');
// → MusicGen, Stable Audio Open, Bark, ACE-Step...

const sttModels = models.filter(m => m.provider === 'hf-local' && m.modality === 'stt');
// → Whisper large-v3, Whisper large-v3-turbo, wav2vec2...
```

Models already downloaded to `~/.cache/huggingface/hub/` are automatically detected as `status: 'installed'`.

### ComfyUI — Dynamic Workflow Engine

When ComfyUI is running, noosphere discovers all installed checkpoints, LoRAs, and models:

```typescript
// Auto-detected on localhost:8188
const comfyModels = models.filter(m => m.provider === 'comfyui');
// → All checkpoints (SD 1.5, SDXL, FLUX, Pony, etc.)

// Also fetches top models from CivitAI as "available"
const civitai = comfyModels.filter(m => m.status === 'available');
```

### Model Descriptions — Dynamic from Source

Every model includes a `description` field fetched dynamically from its source — no hardcoded strings:

```typescript
const models = await ai.getModels('llm');

for (const m of models) {
  console.log(m.name, m.description);
  // "llama3.1"  "Llama 3.1 is a new state-of-the-art model from Meta available in 8B, 70B and 405B"
  // "qwen3"     "Qwen3 is the latest generation of large language models in Qwen series"
  // "gemma3"    "The current, most capable model that runs on a single GPU"
}

const imageModels = await ai.getModels('image');
for (const m of imageModels) {
  console.log(m.name, m.description);
  // "stable-diffusion-xl-base-1.0"  "Stable Diffusion XL (SDXL) is a latent text-to-image..."
  // "FLUX.1-dev"                     "FLUX.1 [dev] is a 12 billion parameter rectified flow..."
}
```

| Provider | Description Source |
|---|---|
| **Ollama** | Scraped from `ollama.com/library` page |
| **HuggingFace Local** | Parsed from each model's `README.md` on HuggingFace Hub |
| **CivitAI/ComfyUI** | Extracted from CivitAI API response |
| **Whisper** | Parsed from OpenAI's Whisper README on HuggingFace |
| **AudioCraft** | Parsed from Meta's AudioCraft README on HuggingFace |

All description fetches are **parallel and fail-safe** — if a source is unreachable, models are returned without descriptions. No API keys required.

### Model Status & Local Info

Every local model includes rich metadata:

```typescript
interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  description?: string;          // Dynamic from source (Ollama library, HF README, CivitAI)
  modality: 'llm' | 'image' | 'video' | 'tts' | 'stt' | 'music' | 'embedding';
  status?: 'installed' | 'available' | 'downloading' | 'running' | 'error';
  local: boolean;
  logo?: { svg?: string; png?: string };
  localInfo?: {
    sizeBytes: number;
    family?: string;              // "llama", "gemma3", "qwen2"
    parameterSize?: string;       // "70.6B", "7B", "3.2B"
    quantization?: string;        // "Q4_K_M", "Q8_0", "F16"
    format?: string;              // "gguf", "safetensors", "onnx"
    digest?: string;
    modifiedAt?: string;
    running?: boolean;
    runtime: string;              // "ollama", "diffusers", "comfyui", "piper", "whisper"
  };
  capabilities: {
    contextWindow?: number;
    maxTokens?: number;
    supportsVision?: boolean;
    supportsStreaming?: boolean;
  };
}
```

### Web Catalogs (Auto-Fetched)

| Source | API | What it provides |
|---|---|---|
| **Ollama Library** | `ollama.com/api/tags` | 215+ LLM families with sizes and quantizations |
| **HuggingFace** | `huggingface.co/api/models?pipeline_tag=...` | Top models per modality (image, video, TTS, STT) |
| **CivitAI** | `civitai.com/api/v1/models` | SD/SDXL/FLUX checkpoints with previews |

### Auto-Detection — Zero Config

Noosphere auto-detects all local runtimes on startup:

| Runtime | Detection Method | Default Port |
|---|---|---|
| Ollama | `GET localhost:11434/api/version` | 11434 |
| ComfyUI | `GET localhost:8188/system_stats` | 8188 |
| llama.cpp | `GET localhost:8080/health` | 8080 |
| LM Studio | `GET localhost:1234/v1/models` | 1234 |
| vLLM | `GET localhost:8000/v1/models` | 8000 |
| KoboldCpp | `GET localhost:5001/v1/models` | 5001 |
| TabbyAPI | `GET localhost:5000/v1/models` | 5000 |
| Jan | `GET localhost:1337/v1/models` | 1337 |
| Piper | Binary in PATH | — |
| Whisper | Python package detection | — |
| AudioCraft | Python package detection | — |

> 📄 **Full research:** [`docs/LOCAL_AI_RESEARCH.md`](./docs/LOCAL_AI_RESEARCH.md) — 44KB covering 12+ runtimes across all modalities

---

## Pre-Request Token Counting

Count tokens **before** sending a request to any provider. Know the cost upfront.

```typescript
// Via Noosphere instance (auto-routes by model)
const result = await ai.countTokens({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' },
  ],
  model: 'gpt-4o',
});
console.log(result.tokens);   // 26
console.log(result.method);   // "tiktoken" (instant, local)
console.log(result.provider); // "openai"

// Google — exact count via API
const google = await ai.countTokens({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gemini-2.5-flash',
});
console.log(google.tokens);   // 3
console.log(google.method);   // "api" (exact)
```

**Token counting by provider:**

| Provider | Method | Speed | Accuracy |
|---|---|---|---|
| **OpenAI** (GPT-4o, o1, o3, o4, GPT-5) | tiktoken (local) | Instant | Exact |
| **Google** (Gemini) | `/countTokens` API | ~200ms | Exact |
| **Anthropic** (Claude) | `/messages/count_tokens` API | ~200ms | Exact |
| **Groq** (Llama, Mixtral, Gemma) | tiktoken (local) | Instant | Exact |
| **Cerebras** (Llama) | tiktoken (local) | Instant | Exact |
| **Mistral** (Mistral, Mixtral, Codestral) | tiktoken (local) | Instant | Close approx |
| **xAI** (Grok) | tiktoken (local) | Instant | Close approx |
| **OpenRouter** (all models) | tiktoken (local) | Instant | Close approx |
| **Ollama** (all local models) | tiktoken (local) | Instant | Close approx |

You can also use standalone functions without a Noosphere instance:

```typescript
import {
  countTokensOpenAI, countTokensGoogle, countTokensAnthropic,
  countTokensGroq, countTokensMistral, countTokensXai,
  countTokensCerebras, countTokensOpenRouter, countTokensOllama,
} from 'noosphere';

// Local (instant, no API key needed)
const tokens = countTokensOpenAI(messages, 'gpt-4o');       // 26
const groq   = countTokensGroq(messages, 'llama-3.3-70b');  // 26
const ollama = countTokensOllama(messages, 'qwen3:8b');     // 26

// API-based (exact, needs key)
const google = await countTokensGoogle(messages, GEMINI_KEY, 'gemini-2.5-flash');     // 16
const claude = await countTokensAnthropic(messages, ANTHROPIC_KEY, 'claude-sonnet-4-20250514'); // exact
```

---

## Agent Loop & pi-ai Access

Noosphere re-exports the full [pi-ai](https://github.com/mariozechner/pi-ai) library for direct access to agent loops, tool calling, cost calculation, and streaming APIs.

### Preprocessor — Context Compaction

The preprocessor hook runs **before every LLM call** in the agent loop. Use it to manage context window limits — truncate old messages, summarize conversations, or implement sliding window strategies.

```typescript
import { agentLoop, getPiModel, setApiKey, countTokensOpenAI } from 'noosphere';
import type { AgentLoopConfig, AgentContext, PiMessage } from 'noosphere';

setApiKey('openai', process.env.OPENAI_API_KEY!);

const config: AgentLoopConfig = {
  model: getPiModel('openai', 'gpt-4o'),

  // Preprocessor runs before each LLM call
  preprocessor: async (messages) => {
    // Strategy 1: Simple sliding window — keep last N messages
    if (messages.length > 50) {
      return messages.slice(-20);
    }
    return messages;
  },
};

// Start the agent loop
const context: AgentContext = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [],
};

const userMessage = {
  role: 'user' as const,
  content: 'Hello!',
  timestamp: Date.now(),
};

const stream = agentLoop(userMessage, context, config);

for await (const event of stream) {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
}
```

#### Preprocessor Strategies

**Token-aware compaction** — count tokens and trim to fit the context window:

```typescript
preprocessor: async (messages) => {
  const model = getPiModel('openai', 'gpt-4o');
  const maxTokens = model.contextWindow * 0.8; // leave 20% for response

  let totalTokens = 0;
  const kept: PiMessage[] = [];

  // Keep messages from newest to oldest until we hit the limit
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const content = 'content' in msg && typeof msg.content === 'string' ? msg.content : '';
    const msgTokens = countTokensOpenAI([{ role: msg.role, content }], 'gpt-4o');

    if (totalTokens + msgTokens > maxTokens) break;
    totalTokens += msgTokens;
    kept.unshift(msg);
  }

  return kept;
},
```

**Summarization compaction** — summarize old messages, keep recent ones:

```typescript
preprocessor: async (messages) => {
  if (messages.length <= 20) return messages;

  // Summarize the older messages using the LLM itself
  const oldMessages = messages.slice(0, -10);
  const recentMessages = messages.slice(-10);

  const summary = await piCompleteSimple(getPiModel('openai', 'gpt-4o-mini'), {
    systemPrompt: 'Summarize this conversation in 2-3 sentences.',
    messages: oldMessages,
  });

  // Replace old messages with a summary message
  const summaryText = summary.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');

  return [
    { role: 'user' as const, content: `[Previous conversation summary: ${summaryText}]`, timestamp: Date.now() },
    ...recentMessages,
  ];
},
```

### Tool Calling

Define tools for the agent loop with typed parameters:

```typescript
import { Type } from '@sinclair/typebox';
import type { AgentTool } from 'noosphere';

const weatherTool: AgentTool = {
  name: 'get_weather',
  label: 'Get Weather',
  description: 'Get the current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name' }),
  }),
  execute: async (toolCallId, params) => {
    const weather = await fetchWeather(params.location);
    return { output: JSON.stringify(weather), details: weather };
  },
};

const context: AgentContext = {
  systemPrompt: 'You are a helpful assistant with weather access.',
  messages: [],
  tools: [weatherTool],
};

const stream = agentLoop(userMessage, context, config);

for await (const event of stream) {
  if (event.type === 'tool_execution_start') {
    console.log(`Calling ${event.toolName}...`);
  }
  if (event.type === 'tool_execution_end') {
    console.log(`Result: ${event.result}`);
  }
}
```

### Cost Calculation

```typescript
import { calculateCost, getPiModel } from 'noosphere';

const model = getPiModel('openai', 'gpt-4o');
const usage = { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 };
const cost = calculateCost(model, usage);
console.log(cost.total);  // $0.00625
console.log(cost.input);  // $0.0025
console.log(cost.output); // $0.00375
```

### Direct Stream/Complete APIs

```typescript
import { piComplete, piStream, piCompleteSimple, setApiKey, getPiModel } from 'noosphere';

setApiKey('openai', process.env.OPENAI_API_KEY!);
const model = getPiModel('openai', 'gpt-4o');

// Simple completion
const result = await piCompleteSimple(model, {
  systemPrompt: 'You are helpful.',
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }],
});

// Streaming
const stream = piStream(model, {
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }],
});

for await (const event of stream) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
}
```

---

## Configuration

API keys are resolved from the constructor config or environment variables (config takes priority):

```typescript
const ai = new Noosphere({
  keys: {
    openai: 'sk-...',
    anthropic: 'sk-ant-...',
    google: 'AIza...',
    fal: 'fal-...',
    huggingface: 'hf_...',
    groq: 'gsk_...',
    mistral: '...',
    xai: '...',
    openrouter: 'sk-or-...',
  },
});
```

Or set environment variables:

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GEMINI_API_KEY` | Google Gemini |
| `FAL_KEY` | FAL.ai |
| `HUGGINGFACE_TOKEN` | Hugging Face |
| `GROQ_API_KEY` | Groq |
| `MISTRAL_API_KEY` | Mistral |
| `XAI_API_KEY` | xAI (Grok) |
| `OPENROUTER_API_KEY` | OpenRouter |

### Full Configuration Reference

```typescript
const ai = new Noosphere({
  // API keys (or use env vars above)
  keys: { /* ... */ },

  // Default models per modality
  defaults: {
    llm: { provider: 'pi-ai', model: 'claude-sonnet-4-20250514' },
    image: { provider: 'fal', model: 'fal-ai/flux/schnell' },
    video: { provider: 'fal', model: 'fal-ai/kling-video/v2/master/text-to-video' },
    tts: { provider: 'fal', model: 'fal-ai/kokoro/american-english' },
  },

  // Local service configuration
  autoDetectLocal: true,  // env: NOOSPHERE_AUTO_DETECT_LOCAL
  local: {
    ollama: { enabled: true, host: 'http://localhost', port: 11434 },
    comfyui: { enabled: true, host: 'http://localhost', port: 8188 },
    piper: { enabled: true, host: 'http://localhost', port: 5500 },
    kokoro: { enabled: true, host: 'http://localhost', port: 5501 },
    custom: [],  // additional LocalServiceConfig[]
  },

  // Retry & failover
  retry: {
    maxRetries: 2,           // default: 2
    backoffMs: 1000,         // default: 1000 (exponential: 1s, 2s, 4s...)
    failover: true,          // default: true — try other providers on failure
    retryableErrors: ['PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'TIMEOUT'],
  },

  // Timeouts per modality (ms)
  timeout: {
    llm: 30000,    // 30s
    image: 120000, // 2min
    video: 300000, // 5min
    tts: 60000,    // 1min
  },

  // Model discovery cache (minutes)
  discoveryCacheTTL: 60,  // env: NOOSPHERE_DISCOVERY_CACHE_TTL

  // Real-time usage callback
  onUsage: (event) => {
    console.log(`${event.provider}/${event.model}: $${event.cost} (${event.latencyMs}ms)`);
  },
});
```

### Local Service Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost` | Ollama server host |
| `OLLAMA_PORT` | `11434` | Ollama server port |
| `COMFYUI_HOST` | `http://localhost` | ComfyUI server host |
| `COMFYUI_PORT` | `8188` | ComfyUI server port |
| `PIPER_HOST` | `http://localhost` | Piper TTS server host |
| `PIPER_PORT` | `5500` | Piper TTS server port |
| `KOKORO_HOST` | `http://localhost` | Kokoro TTS server host |
| `KOKORO_PORT` | `5501` | Kokoro TTS server port |
| `NOOSPHERE_AUTO_DETECT_LOCAL` | `true` | Enable/disable local service auto-detection |
| `NOOSPHERE_DISCOVERY_CACHE_TTL` | `60` | Model cache TTL in minutes |

---

## API Reference

### `new Noosphere(config?)`

Creates a new instance. Providers are initialized lazily on first API call. Auto-detects local services via HTTP pings (2s timeout each).

### Generation Methods

#### `ai.chat(options): Promise<NoosphereResult>`

Generate text with any LLM. Supports 246+ models across 8 providers.

```typescript
const result = await ai.chat({
  provider: 'anthropic',                // optional — auto-resolved if omitted
  model: 'claude-sonnet-4-20250514',    // optional — uses default or first available
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Explain quantum computing' },
  ],
  temperature: 0.7,     // optional (0-2)
  maxTokens: 1024,      // optional
  jsonMode: false,       // optional
});

console.log(result.content);          // response text
console.log(result.thinking);         // reasoning output (Claude, GPT-5, o3, Gemini, Grok-4)
console.log(result.usage.cost);       // cost in USD
console.log(result.usage.input);      // input tokens
console.log(result.usage.output);     // output tokens
console.log(result.latencyMs);        // response time in ms
```

#### `ai.stream(options): NoosphereStream`

Stream LLM responses token-by-token. Same options as `chat()`.

```typescript
const stream = ai.stream({
  messages: [{ role: 'user', content: 'Write a story' }],
});

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta!);
      break;
    case 'thinking_delta':
      console.log('[thinking]', event.delta);
      break;
    case 'done':
      console.log('\n\nUsage:', event.result!.usage);
      break;
    case 'error':
      console.error(event.error);
      break;
  }
}

// Or consume the full result
const result = await stream.result();

// Abort at any time
stream.abort();
```

#### `ai.image(options): Promise<NoosphereResult>`

Generate images. Supports 200+ image models via FAL, HuggingFace, and ComfyUI.

```typescript
const result = await ai.image({
  provider: 'fal',                              // optional
  model: 'fal-ai/flux-2-pro',                   // optional
  prompt: 'A futuristic cityscape at sunset',
  negativePrompt: 'blurry, low quality',         // optional
  width: 1024,                                   // optional
  height: 768,                                   // optional
  seed: 42,                                      // optional — reproducible results
  steps: 30,                                     // optional — inference steps (more = higher quality)
  guidanceScale: 7.5,                            // optional — prompt adherence (higher = stricter)
});

console.log(result.url);                // image URL (FAL)
console.log(result.buffer);             // image Buffer (HuggingFace, ComfyUI)
console.log(result.media?.width);       // actual dimensions
console.log(result.media?.height);
console.log(result.media?.format);      // 'png'
```

#### `ai.video(options): Promise<NoosphereResult>`

Generate videos. Supports 150+ video models via FAL (Kling, Sora 2, VEO 3, WAN, Pixverse, and more).

```typescript
const result = await ai.video({
  provider: 'fal',
  model: 'fal-ai/kling-video/v2/master/text-to-video',
  prompt: 'A bird flying through clouds',
  imageUrl: 'https://...',    // optional — image-to-video
  duration: 5,                // optional — seconds
  fps: 24,                    // optional
  width: 1280,                // optional
  height: 720,                // optional
});

console.log(result.url);                // video URL
console.log(result.media?.duration);    // actual duration
console.log(result.media?.fps);         // frames per second
console.log(result.media?.format);      // 'mp4'
```

#### `ai.speak(options): Promise<NoosphereResult>`

Text-to-speech synthesis. Supports 50+ TTS models via FAL, HuggingFace, Piper, and Kokoro.

```typescript
const result = await ai.speak({
  provider: 'fal',
  model: 'fal-ai/kokoro/american-english',
  text: 'Hello world',
  voice: 'af_heart',        // optional — voice ID
  language: 'en',            // optional
  speed: 1.0,                // optional
  format: 'mp3',             // optional — 'mp3' | 'wav' | 'ogg'
});

console.log(result.buffer);  // audio Buffer
console.log(result.url);     // audio URL (FAL)
```

### Discovery Methods

#### `ai.getProviders(modality?): Promise<ProviderInfo[]>`

List available providers, optionally filtered by modality.

```typescript
const providers = await ai.getProviders('llm');
// [{ id: 'pi-ai', name: 'Pi-AI', modalities: ['llm'], local: false, status: 'online', modelCount: 246 }]
```

#### `ai.getModels(modality?): Promise<ModelInfo[]>`

List all available models with full metadata.

```typescript
const models = await ai.getModels('image');
// Returns ModelInfo[] with id, provider, name, modality, local, cost, capabilities
```

#### `ai.getModel(provider, modelId): Promise<ModelInfo | null>`

Get details about a specific model.

#### `ai.syncModels(): Promise<SyncResult>`

Refresh model lists from all providers. Returns sync count, per-provider breakdown, and any errors.

### Usage Tracking

#### `ai.getUsage(options?): UsageSummary`

Get aggregated usage statistics with optional filtering.

```typescript
const usage = ai.getUsage({
  since: '2024-01-01',    // optional — ISO date or Date object
  until: '2024-12-31',    // optional
  provider: 'openai',     // optional — filter by provider
  modality: 'llm',        // optional — filter by modality
});

console.log(usage.totalCost);        // total USD spent
console.log(usage.totalRequests);    // number of requests
console.log(usage.byProvider);       // { openai: 2.50, anthropic: 1.20, fal: 0.30 }
console.log(usage.byModality);       // { llm: 3.00, image: 0.70, video: 0.30, tts: 0.00 }
```

### Lifecycle

#### `ai.registerProvider(provider): void`

Register a custom provider (see [Custom Providers](#custom-providers)).

#### `ai.dispose(): Promise<void>`

Cleanup all provider resources, clear model cache, and reset usage tracker.

### NoosphereResult

Every generation method returns a `NoosphereResult`:

```typescript
interface NoosphereResult {
  content?: string;        // LLM response text
  thinking?: string;       // reasoning/thinking output (supported models)
  url?: string;            // media URL (images, videos, audio from cloud providers)
  buffer?: Buffer;         // media binary data (local providers, HuggingFace)
  provider: string;        // which provider handled the request
  model: string;           // which model was used
  modality: Modality;      // 'llm' | 'image' | 'video' | 'tts'
  latencyMs: number;       // request duration in milliseconds
  usage: {
    cost: number;          // cost in USD
    input?: number;        // input tokens/characters
    output?: number;       // output tokens
    unit?: string;         // 'tokens' | 'characters' | 'per_image' | 'per_second' | 'free'
  };
  media?: {
    width?: number;        // image/video width
    height?: number;       // image/video height
    duration?: number;     // video/audio duration in seconds
    format?: string;       // 'png' | 'mp4' | 'mp3' | 'wav'
    fps?: number;          // video frames per second
  };
}
```

---

## Providers In Depth

### Pi-AI — LLM Gateway (246+ models)

**Provider ID:** `pi-ai`
**Modalities:** LLM (chat + streaming)
**Library:** `@mariozechner/pi-ai`

A unified gateway that routes to 8 LLM providers through 4 different API protocols:

| API Protocol | Providers |
|---|---|
| `anthropic-messages` | Anthropic |
| `google-generative-ai` | Google |
| `openai-responses` | OpenAI (reasoning models) |
| `openai-completions` | OpenAI, xAI, Groq, Cerebras, Zai, OpenRouter |

#### Anthropic Models (19)

| Model | Context | Reasoning | Vision | Input Cost | Output Cost |
|---|---|---|---|---|---|
| `claude-opus-4-0` | 200k | Yes | Yes | $15/M | $75/M |
| `claude-opus-4-1` | 200k | Yes | Yes | $15/M | $75/M |
| `claude-sonnet-4-20250514` | 200k | Yes | Yes | $3/M | $15/M |
| `claude-sonnet-4-5-20250929` | 200k | Yes | Yes | $3/M | $15/M |
| `claude-3-7-sonnet-20250219` | 200k | Yes | Yes | $3/M | $15/M |
| `claude-3-5-sonnet-20241022` | 200k | No | Yes | $3/M | $15/M |
| `claude-haiku-4-5-20251001` | 200k | No | Yes | $0.80/M | $4/M |
| `claude-3-5-haiku-20241022` | 200k | No | Yes | $0.80/M | $4/M |
| `claude-3-haiku-20240307` | 200k | No | Yes | $0.25/M | $1.25/M |
| *...and 10 more variants* | | | | | |

#### OpenAI Models (24)

| Model | Context | Reasoning | Vision | Input Cost | Output Cost |
|---|---|---|---|---|---|
| `gpt-5` | 200k | Yes | Yes | $10/M | $30/M |
| `gpt-5-mini` | 200k | Yes | Yes | $2.50/M | $10/M |
| `gpt-4.1` | 128k | No | Yes | $2/M | $8/M |
| `gpt-4.1-mini` | 128k | No | Yes | $0.40/M | $1.60/M |
| `gpt-4.1-nano` | 128k | No | Yes | $0.10/M | $0.40/M |
| `gpt-4o` | 128k | No | Yes | $2.50/M | $10/M |
| `gpt-4o-mini` | 128k | No | Yes | $0.15/M | $0.60/M |
| `o3-pro` | 200k | Yes | Yes | $20/M | $80/M |
| `o3-mini` | 200k | Yes | Yes | $1.10/M | $4.40/M |
| `o4-mini` | 200k | Yes | Yes | $1.10/M | $4.40/M |
| `codex-mini-latest` | 200k | Yes | No | $1.50/M | $6/M |
| *...and 13 more variants* | | | | | |

#### Google Gemini Models (19)

| Model | Context | Reasoning | Vision | Cost |
|---|---|---|---|---|
| `gemini-2.5-flash` | 1M | Yes | Yes | $0.15-0.60/M |
| `gemini-2.5-pro` | 1M | Yes | Yes | $1.25-10/M |
| `gemini-2.0-flash` | 1M | No | Yes | $0.10-0.40/M |
| `gemini-2.0-flash-lite` | 1M | No | Yes | $0.025-0.10/M |
| `gemini-1.5-flash` | 1M | No | Yes | $0.075-0.30/M |
| `gemini-1.5-pro` | 2M | No | Yes | $1.25-5/M |
| *...and 13 more variants* | | | | |

#### xAI Grok Models (20)

| Model | Context | Reasoning | Vision | Input Cost |
|---|---|---|---|---|
| `grok-4` | 256k | Yes | Yes | $5/M |
| `grok-4-fast` | 256k | Yes | Yes | $3/M |
| `grok-3` | 131k | No | Yes | $3/M |
| `grok-3-fast` | 131k | No | Yes | $5/M |
| `grok-3-mini-fast-latest` | 131k | Yes | No | $0.30/M |
| `grok-2-vision` | 32k | No | Yes | $2/M |
| *...and 14 more variants* | | | | |

#### Groq Models (15)

| Model | Context | Cost |
|---|---|---|
| `llama-3.3-70b-versatile` | 128k | $0.59/M |
| `llama-3.1-8b-instant` | 128k | $0.05/M |
| `mistral-saba-24b` | 32k | $0.40/M |
| `qwen-qwq-32b` | 128k | $0.29/M |
| `deepseek-r1-distill-llama-70b` | 128k | $0.75/M |
| *...and 10 more* | | |

#### Cerebras Models (3)

`gpt-oss-120b`, `qwen-3-235b-a22b-instruct-2507`, `qwen-3-coder-480b`

#### Zai Models (5)

`glm-4.6`, `glm-4.5`, `glm-4.5-flash`, `glm-4.5v`, `glm-4.5-air`

#### OpenRouter (141 models)

Aggregator providing access to hundreds of additional models including Llama, Deepseek, Mistral, Qwen, and many more. Full list available via `ai.getModels('llm')`.

#### The Pi-AI Engine — Deep Dive

Noosphere's LLM provider is powered by `@mariozechner/pi-ai`, part of the **Pi mono-repo** by Mario Zechner (badlogic). Pi is NOT a wrapper like LangChain or Mastra — it's a **micro-framework for agentic AI** (~15K LOC, 4 npm packages) that was built from scratch as a minimalist alternative to Claude Code.

Pi consists of 4 packages in 3 tiers:

```
TIER 1 — FOUNDATION
  @mariozechner/pi-ai             LLM API: stream(), complete(), model registry
                                  0 internal deps, talks to 20+ providers

TIER 2 — INFRASTRUCTURE
  @mariozechner/pi-agent-core     Agent loop, tool execution, lifecycle events
                                  Depends on pi-ai

  @mariozechner/pi-tui            Terminal UI with differential rendering
                                  Standalone, 0 internal deps

TIER 3 — APPLICATION
  @mariozechner/pi-coding-agent   CLI + SDK: sessions, compaction, extensions
                                  Depends on all above
```

Noosphere uses `@mariozechner/pi-ai` (Tier 1) directly for LLM access. But the full Pi ecosystem provides capabilities that can be layered on top.

---

#### How Pi Keeps 200+ Models Updated

Pi does NOT hardcode models. It has an **auto-generation pipeline** that runs at build time:

```
STEP 1: FETCH (3 sources in parallel)
┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐
│   models.dev     │  │   OpenRouter     │  │  Vercel AI    │
│   /api.json      │  │   /v1/models     │  │  Gateway      │
│                  │  │                  │  │  /v1/models   │
│ Context windows  │  │ Pricing ($/M)    │  │ Capability    │
│ Capabilities     │  │ Availability     │  │ tags          │
│ Tool support     │  │ Provider routing │  │               │
└────────┬─────────┘  └────────┬─────────┘  └──────┬────────┘
         └─────────┬───────────┴────────────────────┘
                   ▼
STEP 2: MERGE & DEDUPLICATE
         Priority: models.dev > OpenRouter > Vercel
         Key: provider + modelId
                   │
                   ▼
STEP 3: FILTER
         ✅ tool_call === true
         ✅ streaming supported
         ✅ system messages supported
         ✅ not deprecated
                   │
                   ▼
STEP 4: NORMALIZE
         Costs → $/million tokens
         API type → one of 4 protocols
         Input modes → ["text"] or ["text","image"]
                   │
                   ▼
STEP 5: PATCH (manual corrections)
         Claude Opus: cache pricing fix
         GPT-5.4: context window override
         Kimi K2.5: hardcoded pricing
                   │
                   ▼
STEP 6: GENERATE TypeScript
         → models.generated.ts (~330KB)
         → 200+ models with full type safety
```

Each generated model entry looks like:

```typescript
{
  id: "claude-opus-4-6",
  name: "Claude Opus 4.6",
  api: "anthropic-messages",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  reasoning: true,
  input: ["text", "image"],
  cost: {
    input: 15,          // $15/M tokens
    output: 75,         // $75/M tokens
    cacheRead: 1.5,     // prompt cache hit
    cacheWrite: 18.75,  // prompt cache write
  },
  contextWindow: 200_000,
  maxTokens: 32_000,
} satisfies Model<"anthropic-messages">
```

When a new model is released (e.g., Gemini 3.0), it appears in models.dev/OpenRouter → the script captures it → a new Pi version is published → Noosphere updates its dependency.

---

#### 4 API Protocols — How Pi Talks to Every Provider

Pi abstracts all LLM providers into 4 wire protocols. Each protocol handles the differences in request format, streaming format, auth headers, and response parsing:

| Protocol | Providers | Key Differences |
|---|---|---|
| `anthropic-messages` | Anthropic, AWS Bedrock | `system` as top-level field, content as `[{type:"text", text:"..."}]` blocks, `x-api-key` auth, `anthropic-beta` headers |
| `openai-completions` | OpenAI, xAI, Groq, Cerebras, OpenRouter, Ollama, vLLM | `system` as message with `role:"system"`, content as string, `Authorization: Bearer` auth, `tool_calls` array |
| `openai-responses` | OpenAI (reasoning models) | New Responses API with server-side context, `store: true`, reasoning summaries |
| `google-generative-ai` | Google Gemini, Vertex AI | `systemInstruction.parts[{text}]`, role `"model"` instead of `"assistant"`, `functionCall` instead of `tool_calls`, `thinkingConfig` |

The core function `streamSimple()` detects which protocol to use based on `model.api` and handles all the formatting/parsing transparently:

```typescript
// What happens inside Pi when you call Noosphere's chat():
async function* streamSimple(
  model: Model,           // includes model.api to determine protocol
  context: Context,       // { systemPrompt, messages, tools }
  options?: StreamOptions  // { signal, onPayload, thinkingLevel, ... }
): AsyncIterable<AssistantMessageEvent> {
  // 1. Format request according to model.api protocol
  // 2. Open SSE/WebSocket stream
  // 3. Parse provider-specific chunks
  // 4. Emit normalized events:
  //    → text_delta, thinking_delta, tool_call, message_end
}
```

---

#### Agentic Capabilities

These are the capabilities people get access to through the Pi-AI engine:

##### 1. Tool Use / Function Calling

Full structured tool calling supported across **all major providers**. Tool definitions use TypeBox schemas with runtime validation via AJV:

```typescript
import { type Tool, StringEnum } from '@mariozechner/pi-ai';
import { Type } from '@sinclair/typebox';

// Define a tool with typed parameters
const searchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: Type.Object({
    query: Type.String({ description: 'Search query' }),
    maxResults: Type.Optional(Type.Number({ default: 5 })),
    type: StringEnum(['web', 'images', 'news'], { description: 'Search type' }),
  }),
};

// Pass tools in context — Pi handles the rest
const context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Search for recent AI news' }],
  tools: [searchTool],
};
```

**How tool calling works internally:**

```
User prompt → LLM → "I need to call web_search"
                         │
                         ▼
              Pi validates arguments with AJV
              against the TypeBox schema
                         │
                   ┌─────┴─────┐
                   │ Valid?     │
                   ├─Yes───────┤
                   │ Execute   │
                   │ tool      │
                   ├───────────┤
                   │ No        │
                   │ Return    │
                   │ validation│
                   │ error to  │
                   │ LLM       │
                   └───────────┘
                         │
                         ▼
              Tool result → back into context → LLM continues
```

**Provider-specific tool_choice control:**
- **Anthropic:** `"auto" | "any" | "none" | { type: "tool", name: "specific_tool" }`
- **OpenAI:** `"auto" | "none" | "required" | { type: "function", function: { name: "..." } }`
- **Google:** `"auto" | "none" | "any"`

**Partial JSON streaming:** During streaming, Pi parses tool call arguments incrementally using partial JSON parsing. This means you can see tool arguments being built in real-time, not just after the tool call completes.

##### 2. Reasoning / Extended Thinking

Pi provides **unified thinking support** across all providers that support it. Thinking blocks are automatically extracted, separated from regular text, and streamed as distinct events:

| Provider | Models | Control Parameters | How It Works |
|---|---|---|---|
| **Anthropic** | Claude Opus, Sonnet 4+ | `thinkingEnabled: boolean`, `thinkingBudgetTokens: number` | Extended thinking blocks in response, separate `thinking` content type |
| **OpenAI** | o1, o3, o4, GPT-5 | `reasoningEffort: "minimal" \| "low" \| "medium" \| "high"` | Reasoning via Responses API, `reasoningSummary: "auto" \| "detailed" \| "concise"` |
| **Google** | Gemini 2.5 Flash/Pro | `thinking.enabled: boolean`, `thinking.budgetTokens: number` | Thinking via `thinkingConfig`, mapped to effort levels |
| **xAI** | Grok-4, Grok-3-mini | Native reasoning | Automatic when model supports it |

**Cross-provider thinking portability:** When switching models mid-conversation, Pi converts thinking blocks between formats. Anthropic thinking blocks become `<thinking>` tagged text when sent to OpenAI/Google, and vice versa.

```typescript
// Thinking is automatically extracted in Noosphere responses:
const result = await ai.chat({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: 'Solve this step by step: 15! / 13!' }],
});

console.log(result.thinking);  // "Let me work through this... 15! = 15 × 14 × 13!..."
console.log(result.content);   // "15! / 13! = 15 × 14 = 210"

// During streaming, thinking arrives as separate events:
const stream = ai.stream({ messages: [...] });
for await (const event of stream) {
  if (event.type === 'thinking_delta') console.log('[THINKING]', event.delta);
  if (event.type === 'text_delta') console.log('[RESPONSE]', event.delta);
}
```

##### 3. Vision / Multimodal Input

Models with `input: ["text", "image"]` accept images alongside text. Pi handles the encoding and format differences per provider:

```typescript
// Send images to vision-capable models
const messages = [{
  role: 'user',
  content: [
    { type: 'text', text: 'What is in this image?' },
    { type: 'image', data: base64PngString, mimeType: 'image/png' },
  ],
}];

// Supported MIME types: image/png, image/jpeg, image/gif, image/webp
// Images are silently ignored when sent to non-vision models
```

**Vision-capable models include:** All Claude models, all GPT-4o/GPT-5 models, Gemini models, Grok-2-vision, Grok-4, and select Groq models.

##### 4. Agent Loop — Autonomous Tool Execution

The `@mariozechner/pi-agent-core` package provides a complete agent loop that automatically cycles through `prompt → LLM → tool call → result → repeat` until the task is done:

```typescript
import { agentLoop } from '@mariozechner/pi-ai';

const events = agentLoop(userMessage, agentContext, {
  model: getModel('anthropic', 'claude-opus-4-6'),
  tools: [searchTool, readFileTool, writeFileTool],
  signal: abortController.signal,
});

for await (const event of events) {
  switch (event.type) {
    case 'agent_start':           // Agent begins
    case 'turn_start':            // New LLM turn begins
    case 'message_start':         // LLM starts responding
    case 'message_update':        // Text/thinking delta received
    case 'tool_execution_start':  // About to execute a tool
    case 'tool_execution_end':    // Tool finished, result available
    case 'message_end':           // LLM finished this message
    case 'turn_end':              // Turn complete (may loop if tools were called)
    case 'agent_end':             // All done, final messages available
  }
}
```

**The agent loop state machine:**

```
[User sends prompt]
        │
        ▼
  ┌─[Build Context]──▶ [Check Queues]──▶ [Stream LLM]◄── streamFn()
  │                                           │
  │                                     ┌─────┴──────┐
  │                                     │            │
  │                                   text      tool_call
  │                                     │            │
  │                                     ▼            ▼
  │                                  [Done]    [Execute Tool]
  │                                                  │
  │                                            tool result
  │                                                  │
  └──────────────────────────────────────────────────┘
                                    (loops back to Stream LLM)
```

**Key design decisions:**
- Tools execute **sequentially** by default (parallelism can be added on top)
- The `streamFn` is **injectable** — you can wrap it with middleware to modify requests per-provider
- Tool arguments are **validated at runtime** using TypeBox + AJV before execution
- Aborted/failed responses preserve partial content and usage data
- Tool results are automatically added to the conversation context

##### 5. The `streamFn` Pattern — Injectable Middleware

This is Pi's most powerful architectural feature. The `streamFn` is the function that actually talks to the LLM, and it can be **wrapped with middleware** like Express.js request handlers:

```typescript
import type { StreamFn } from '@mariozechner/pi-agent-core';
import { streamSimple } from '@mariozechner/pi-ai';

// Start with Pi's base streaming function
let fn: StreamFn = streamSimple;

// Wrap it with middleware that modifies requests per-provider
fn = createMyCustomWrapper(fn, {
  // Add custom headers for Anthropic
  onPayload: (payload) => {
    if (model.provider === 'anthropic') {
      payload.headers['anthropic-beta'] = 'fine-grained-tool-streaming-2025-05-14';
    }
  },
});

// Each wrapper calls the previous one, forming a chain:
// request → wrapper3 → wrapper2 → wrapper1 → streamSimple → API
```

This pattern is what allows projects like OpenClaw to stack **16 provider-specific wrappers** on top of Pi's base streaming — adding beta headers for Anthropic, WebSocket transport for OpenAI, thinking sanitization for Google, reasoning effort headers for OpenRouter, and more — without modifying Pi's source code.

##### 6. Session Management (via pi-coding-agent)

The `@mariozechner/pi-coding-agent` package provides persistent session management with JSONL-based storage:

```typescript
import { createAgentSession, SessionManager } from '@mariozechner/pi-coding-agent';

// Create a session with full persistence
const session = await createAgentSession({
  model: 'claude-opus-4-6',
  tools: myTools,
  sessionManager,  // handles JSONL persistence
});

const result = await session.run('Build a REST API');
// Session is automatically saved to:
// ~/.pi/agent/sessions/session_abc123.jsonl
```

**Session file format (append-only JSONL):**
```jsonl
{"role":"user","content":"Build a REST API","timestamp":1710000000}
{"role":"assistant","content":"I'll create...","model":"claude-opus-4-6","usage":{...}}
{"role":"toolResult","toolCallId":"tc_001","toolName":"bash","content":"OK"}
{"type":"compaction","summary":"The user asked to build...","preservedMessages":[...]}
```

**Session operations:**
- `create()` — new session
- `open(id)` — restore existing session
- `continueRecent()` — continue the most recent session
- `forkFrom(id)` — create a branch (new JSONL referencing parent)
- `inMemory()` — RAM-only session (for SDK/testing)

##### 7. Context Compaction — Automatic Context Window Management

When the conversation approaches the model's context window limit, Pi automatically **compacts** the history:

```
1. DETECT: Calculate inputTokens + outputTokens vs model.contextWindow
2. TRIGGER: Proactively before overflow, or as recovery after overflow error
3. SUMMARIZE: Send history to LLM with a compaction prompt
4. WRITE: Append compaction entry to JSONL:
   {"type":"compaction","summary":"...","preservedMessages":[last N messages]}
5. CONTINUE: Context is now summary + recent messages instead of full history
```

The JSONL file is **never rewritten** — compaction entries are appended, maintaining a complete audit trail.

##### 8. Cost Tracking — Cache-Aware Pricing

Pi tracks costs per-request with cache-aware pricing for providers that support prompt caching:

```typescript
// Every model has 4 cost dimensions:
{
  input: 15,          // $15 per 1M input tokens
  output: 75,         // $75 per 1M output tokens
  cacheRead: 1.5,     // $1.50 per 1M cached prompt tokens (read)
  cacheWrite: 18.75,  // $18.75 per 1M cached prompt tokens (write)
}

// Usage tracking on every response:
{
  input: 1500,        // tokens consumed as input
  output: 800,        // tokens generated
  cacheRead: 5000,    // prompt cache hits
  cacheWrite: 1500,   // prompt cache writes
  cost: {
    total: 0.082,     // total cost in USD
    input: 0.0225,
    output: 0.06,
    cacheRead: 0.0075,
    cacheWrite: 0.028,
  },
}
```

**Anthropic and OpenAI** support prompt caching. For providers without caching, `cacheRead` and `cacheWrite` are always 0.

##### 9. Extension System (via pi-coding-agent)

Pi supports a plugin system where extensions can register tools, commands, and lifecycle hooks:

```typescript
// Extensions are TypeScript modules loaded at runtime via jiti
export default function(api: ExtensionAPI) {
  // Register a custom tool
  api.registerTool('my_tool', {
    description: 'Does something useful',
    parameters: { /* TypeBox schema */ },
    execute: async (args) => 'result',
  });

  // Register a slash command
  api.registerCommand('/mycommand', {
    handler: async (args) => { /* ... */ },
    description: 'Custom command',
  });

  // Hook into the agent lifecycle
  api.on('before_agent_start', async (context) => {
    context.systemPrompt += '\nExtra instructions';
  });

  api.on('tool_execution_end', async (event) => {
    // Post-process tool results
  });
}
```

**Resource discovery chain (priority):**
1. Project `.pi/` directory (highest)
2. User `~/.pi/agent/`
3. npm packages with Pi metadata
4. Built-in defaults

##### 10. The Anti-MCP Philosophy — Why Pi Uses CLI Instead

Pi explicitly **rejects MCP** (Model Context Protocol). Mario Zechner's argument, backed by benchmarks:

**The token cost problem:**

| Approach | Tools | Tokens Consumed | % of Claude's Context |
|---|---|---|---|
| Playwright MCP | 21 tools | 13,700 tokens | 6.8% |
| Chrome DevTools MCP | 26 tools | 18,000 tokens | 9.0% |
| Pi CLI + README | N/A | 225 tokens | ~0.1% |

That's a **60-80x reduction** in token consumption. With 5 MCP servers, you lose ~55,000 tokens before doing any work.

**Benchmark results (120 evaluations):**

| Approach | Avg Cost | Success Rate |
|---|---|---|
| CLI (tmux) | $0.37 | 100% |
| CLI (terminalcp) | $0.39 | 100% |
| MCP (terminalcp) | $0.48 | 100% |

Same success rate, MCP costs **30% more**.

**Pi's alternative: Progressive Disclosure via CLI tools + READMEs**

Instead of loading all tool definitions upfront, Pi's agent has `bash` as a built-in tool and discovers CLI tools only when needed:

```
MCP approach:                          Pi approach:
─────────────                          ──────────
Session start →                        Session start →
  Load 21 Playwright tools               Load 4 tools: read, write, edit, bash
  Load 26 Chrome DevTools tools           (225 tokens)
  Load N more MCP tools
  (~55,000 tokens wasted)

When browser needed:                   When browser needed:
  Tools already loaded                   Agent reads SKILL.md (225 tokens)
  (but context is polluted)              Runs: browser-start.js
                                         Runs: browser-nav.js https://...
                                         Runs: browser-screenshot.js

When browser NOT needed:               When browser NOT needed:
  Tools still consume context             0 tokens wasted
```

**The 4 built-in tools** (what Pi argues is sufficient):

| Tool | What It Does | Why It's Enough |
|---|---|---|
| `read` | Read files (text + images) | Supports offset/limit for large files |
| `write` | Create/overwrite files | Creates directories automatically |
| `edit` | Replace text (oldText→newText) | Surgical edits, like a diff |
| `bash` | Execute any shell command | **bash can do everything else** — replaces MCP entirely |

The key insight: `bash` replaces MCP. Any CLI tool, API call, database query, or system operation can be invoked through bash. The agent reads the tool's README only when it needs it, paying tokens on-demand instead of upfront.

---

### FAL — Media Generation (867+ endpoints)

**Provider ID:** `fal`
**Modalities:** Image, Video, TTS
**Library:** `@fal-ai/client`

The largest media generation provider with dynamic pricing fetched at runtime from `https://api.fal.ai/v1/models/pricing`.

#### Image Models (200+)

**FLUX Family (20+ variants):**
| Model | Description |
|---|---|
| `fal-ai/flux/schnell` | Fast generation (default) |
| `fal-ai/flux/dev` | Higher quality |
| `fal-ai/flux-2` | Next generation |
| `fal-ai/flux-2-pro` | Professional quality |
| `fal-ai/flux-2-flex` | Flexible variant |
| `fal-ai/flux-2/edit` | Image editing |
| `fal-ai/flux-2/lora` | LoRA fine-tuning |
| `fal-ai/flux-pro/v1.1-ultra` | Ultra high quality |
| `fal-ai/flux-pro/kontext` | Context-aware generation |
| `fal-ai/flux-lora` | Custom style training |
| `fal-ai/flux-vision-upscaler` | AI upscaling |
| `fal-ai/flux-krea-trainer` | Model training |
| `fal-ai/flux-lora-fast-training` | Fast fine-tuning |
| `fal-ai/flux-lora-portrait-trainer` | Portrait specialist |

**Stable Diffusion:**
`fal-ai/stable-diffusion-v15`, `fal-ai/stable-diffusion-v35-large`, `fal-ai/stable-diffusion-v35-medium`, `fal-ai/stable-diffusion-v3-medium`

**Other Image Models:**
| Model | Description |
|---|---|
| `fal-ai/recraft/v3/text-to-image` | Artistic generation |
| `fal-ai/ideogram/v2`, `v2a`, `v3` | Ideogram series |
| `fal-ai/imagen3`, `fal-ai/imagen4/preview` | Google Imagen |
| `fal-ai/gpt-image-1` | GPT image generation |
| `fal-ai/gpt-image-1/edit-image` | GPT image editing |
| `fal-ai/reve/text-to-image` | Reve generation |
| `fal-ai/sana`, `fal-ai/sana/sprint` | Sana models |
| `fal-ai/pixart-sigma` | PixArt Sigma |
| `fal-ai/bria/text-to-image/base` | Bria AI |

**Pre-trained LoRA Styles:**
`fal-ai/flux-2-lora-gallery/sepia-vintage`, `virtual-tryon`, `satellite-view-style`, `realism`, `multiple-angles`, `hdr-style`, `face-to-full-portrait`, `digital-comic-art`, `ballpoint-pen-sketch`, `apartment-staging`, `add-background`

**Image Editing/Enhancement (30+ tools):**
`fal-ai/image-editing/age-progression`, `baby-version`, `background-change`, `hair-change`, `expression-change`, `object-removal`, `photo-restoration`, `style-transfer`, and many more.

#### Video Models (150+)

**Kling Video (20+ variants):**
| Model | Description |
|---|---|
| `fal-ai/kling-video/v2/master/text-to-video` | Default text-to-video |
| `fal-ai/kling-video/v2/master/image-to-video` | Image-to-video |
| `fal-ai/kling-video/v2.5-turbo/pro/text-to-video` | Turbo pro |
| `fal-ai/kling-video/o1/image-to-video` | O1 quality |
| `fal-ai/kling-video/o1/video-to-video/edit` | Video editing |
| `fal-ai/kling-video/lipsync/audio-to-video` | Lip sync |
| `fal-ai/kling-video/video-to-audio` | Audio extraction |

**Sora 2 (OpenAI):**
| Model | Description |
|---|---|
| `fal-ai/sora-2/text-to-video` | Text-to-video |
| `fal-ai/sora-2/text-to-video/pro` | Pro quality |
| `fal-ai/sora-2/image-to-video` | Image-to-video |
| `fal-ai/sora-2/video-to-video/remix` | Video remixing |

**VEO 3 (Google):**
| Model | Description |
|---|---|
| `fal-ai/veo3` | VEO 3 standard |
| `fal-ai/veo3/fast` | Fast variant |
| `fal-ai/veo3/image-to-video` | Image-to-video |
| `fal-ai/veo3.1` | Latest version |
| `fal-ai/veo3.1/reference-to-video` | Reference-guided |
| `fal-ai/veo3.1/first-last-frame-to-video` | Frame interpolation |

**WAN (15+ variants):**
`fal-ai/wan-pro/text-to-video`, `fal-ai/wan-pro/image-to-video`, `fal-ai/wan/v2.2-a14b/text-to-video`, `fal-ai/wan-vace-14b/depth`, `fal-ai/wan-vace-14b/inpainting`, `fal-ai/wan-vace-14b/pose`, `fal-ai/wan-effects`

**Pixverse (20+ variants):**
`fal-ai/pixverse/v5.5/text-to-video`, `fal-ai/pixverse/v5.5/image-to-video`, `fal-ai/pixverse/v5.5/effects`, `fal-ai/pixverse/lipsync`, `fal-ai/pixverse/sound-effects`

**Minimax / Hailuo:**
`fal-ai/minimax/hailuo-2.3/text-to-video/pro`, `fal-ai/minimax/hailuo-2.3/image-to-video/pro`, `fal-ai/minimax/video-01-director`, `fal-ai/minimax/video-01-live`

**Other Video Models:**
| Provider | Models |
|---|---|
| Hunyuan | `fal-ai/hunyuan-video/text-to-video`, `image-to-video`, `video-to-video`, `foley` |
| Pika | `fal-ai/pika/v2.2/text-to-video`, `pikascenes`, `pikaffects` |
| LTX | `fal-ai/ltx-2/text-to-video`, `image-to-video`, `retake-video` |
| Luma | `fal-ai/luma-dream-machine/ray-2`, `ray-2-flash`, `luma-photon` |
| Vidu | `fal-ai/vidu/q2/text-to-video`, `image-to-video/pro` |
| CogVideoX | `fal-ai/cogvideox-5b/text-to-video`, `video-to-video` |
| Seedance | `fal-ai/bytedance/seedance/v1/text-to-video`, `image-to-video` |
| Magi | `fal-ai/magi/text-to-video`, `extend-video` |

#### TTS / Speech Models (50+)

**Kokoro (9 languages, 20+ voices per language):**
| Model | Language | Example Voices |
|---|---|---|
| `fal-ai/kokoro/american-english` | English (US) | af_heart, af_alloy, af_bella, af_nova, am_adam, am_echo, am_onyx |
| `fal-ai/kokoro/british-english` | English (UK) | British voice set |
| `fal-ai/kokoro/french` | French | French voice set |
| `fal-ai/kokoro/japanese` | Japanese | Japanese voice set |
| `fal-ai/kokoro/spanish` | Spanish | Spanish voice set |
| `fal-ai/kokoro/mandarin-chinese` | Chinese | Mandarin voice set |
| `fal-ai/kokoro/italian` | Italian | Italian voice set |
| `fal-ai/kokoro/hindi` | Hindi | Hindi voice set |
| `fal-ai/kokoro/brazilian-portuguese` | Portuguese | Portuguese voice set |

**ElevenLabs:**
| Model | Description |
|---|---|
| `fal-ai/elevenlabs/tts/eleven-v3` | Professional quality |
| `fal-ai/elevenlabs/tts/turbo-v2.5` | Faster inference |
| `fal-ai/elevenlabs/tts/multilingual-v2` | Multi-language |
| `fal-ai/elevenlabs/text-to-dialogue/eleven-v3` | Dialogue generation |
| `fal-ai/elevenlabs/sound-effects/v2` | Sound effects |
| `fal-ai/elevenlabs/speech-to-text` | Transcription |
| `fal-ai/elevenlabs/audio-isolation` | Background removal |

**Other TTS:**
`fal-ai/f5-tts` (voice cloning), `fal-ai/dia-tts`, `fal-ai/minimax/speech-2.6-turbo`, `fal-ai/minimax/speech-2.6-hd`, `fal-ai/chatterbox/text-to-speech`, `fal-ai/index-tts-2/text-to-speech`

#### FAL Provider Internals — How It Actually Works

**Image generation** uses `fal.subscribe()` (queue-based, polls until complete):
```typescript
// Exact request payload sent to FAL:
const response = await fal.subscribe(model, {
  input: {
    prompt: "A sunset over mountains",
    negative_prompt: "blurry",           // from options.negativePrompt
    image_size: { width: 1024, height: 768 }, // from options.width/height
    seed: 42,                            // from options.seed
    num_inference_steps: 30,             // from options.steps
    guidance_scale: 7.5,                 // from options.guidanceScale
  },
});

// Response parsing — URL from images array:
const image = response.data?.images?.[0];
// result.url    = image?.url
// result.media  = { width: image?.width, height: image?.height, format: 'png' }
```

**Video generation** uses `fal.subscribe()`:
```typescript
const response = await fal.subscribe(model, {
  input: {
    prompt: "Ocean waves",
    image_url: "https://...",   // from options.imageUrl (image-to-video)
    duration: 5,                // from options.duration
    fps: 24,                    // from options.fps
  },
});

// Response parsing — URL from video object with fallback:
const video = response.data?.video;
// result.url = video?.url ?? response.data?.video_url
// Note: width/height/duration/fps come from INPUT options, not response
```

**TTS** uses `fal.run()` (direct call, NOT subscribe — no queue):
```typescript
const response = await fal.run(model, {
  input: {
    text: "Hello world",
    voice: "af_heart",          // from options.voice
    speed: 1.0,                 // from options.speed
  },
});

// Response parsing — URL from audio object with fallback:
// result.url = response.data?.audio_url ?? response.data?.audio?.url
```

**Pricing cache and cost tracking:**
```typescript
// Pricing fetched dynamically from FAL API during listModels():
const res = await fetch('https://api.fal.ai/v1/models/pricing', {
  headers: { Authorization: `Key ${this.apiKey}` },
});
// Returns: Array<{ modelId: string, price: number, unit: string }>

// Cached in memory Map, cleared on each listModels() call:
private pricingCache = new Map<string, { price: number; unit: string }>();

// Cost per request pulled from cache (defaults to 0 if not cached):
usage: { cost: pricingCache.get(model)?.price ?? 0 }
```

**Modality inference from model ID — exact string matching:**
```typescript
inferModality(modelId: string, unit: string): Modality {
  // TTS: unit contains 'char' OR modelId contains 'tts'/'kokoro'/'elevenlabs'
  // Video: unit contains 'second' OR modelId contains 'video'/'kling'/'sora'/'veo'
  // Image: everything else (default)
}
```

**Error handling:** Only `listModels()` catches errors (returns `[]`). Image/video/speak methods let FAL errors propagate directly — no wrapping.

#### FAL Client Capabilities

The `@fal-ai/client` provides additional features beyond what Noosphere surfaces:

- **Queue API** — `fal.queue.submit()`, `status()`, `result()`, `cancel()`. Supports webhooks, priority levels (`"low"` | `"normal"`), and polling/streaming status modes
- **Streaming API** — `fal.streaming.stream()` with async iterators, chunk-level events, configurable timeout between chunks (15s default)
- **Realtime API** — `fal.realtime.connect()` for WebSocket connections with msgpack encoding, throttle interval (128ms default), frame buffering (1-60 frames)
- **Storage API** — `fal.storage.upload()` with configurable object lifecycle: `"never"` | `"immediate"` | `"1h"` | `"1d"` | `"7d"` | `"30d"` | `"1y"`
- **Retry logic** — 3 retries default, exponential backoff (500ms base, 15s max), jitter enabled, retries on 408/429/500/502/503/504
- **Request middleware** — `withMiddleware()` for request interceptors, `withProxy()` for proxy configuration

---

### Hugging Face — Open Source AI (30+ tasks, Dynamic Discovery)

**Provider ID:** `huggingface`
**Modalities:** LLM, Image, TTS
**Library:** `@huggingface/inference`
**Auto-Fetch:** Yes — discovers trending inference-ready models from the Hub API

Access to the entire Hugging Face Hub ecosystem. Noosphere **automatically discovers the top trending models** across all 3 modalities via the Hub API, filtered to only include models with active inference provider endpoints.

#### Auto-Discovered Models

On first `listModels()` call, HuggingFace fetches from:
```
GET https://huggingface.co/api/models?inference_provider=all&pipeline_tag={tag}&sort=trendingScore&limit={n}&expand[]=inferenceProviderMapping
```

| Pipeline Tag | Modality | Limit | Example Models |
|---|---|---|---|
| `text-generation` | LLM | 50 | Qwen2.5-72B-Instruct, Llama-3.3-70B, DeepSeek-V3, Mistral-Large |
| `text-to-image` | Image | 50 | FLUX.1-dev, Stable Diffusion 3.5, SDXL-Lightning, Playground v2.5 |
| `text-to-speech` | TTS | 30 | Kokoro-82M, Bark, MMS-TTS |

Each discovered model includes **inference provider routing** (Together, Fireworks, Groq, Replicate, etc.) and **pricing data** when available from the provider.

#### Fallback Default Models

These 3 models are always available, even if the Hub API is unreachable:

| Modality | Default Model | Description |
|---|---|---|
| LLM | `meta-llama/Llama-3.1-8B-Instruct` | Llama 3.1 8B |
| Image | `stabilityai/stable-diffusion-xl-base-1.0` | SDXL Base |
| TTS | `facebook/mms-tts-eng` | MMS TTS English |

Any HuggingFace model ID works — just pass it as the `model` parameter (even if it's not in the auto-discovered list):

```typescript
await ai.chat({
  provider: 'huggingface',
  model: 'mistralai/Mixtral-8x7B-v0.1',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

#### Full Library Capabilities

The `@huggingface/inference` library (v3.15.0) provides 30+ AI tasks, including capabilities not yet surfaced by Noosphere:

**Natural Language Processing:**
| Task | Method | Description |
|---|---|---|
| Chat | `chatCompletion()` | OpenAI-compatible chat completions |
| Chat Streaming | `chatCompletionStream()` | Token-by-token streaming |
| Text Generation | `textGeneration()` | Raw text completion |
| Summarization | `summarization()` | Text summarization |
| Translation | `translation()` | Language translation |
| Question Answering | `questionAnswering()` | Extract answers from context |
| Text Classification | `textClassification()` | Sentiment, topic classification |
| Zero-Shot Classification | `zeroShotClassification()` | Classify without training |
| Token Classification | `tokenClassification()` | NER, POS tagging |
| Sentence Similarity | `sentenceSimilarity()` | Semantic similarity scores |
| Feature Extraction | `featureExtraction()` | Text embeddings |
| Fill Mask | `fillMask()` | Fill in masked tokens |
| Table QA | `tableQuestionAnswering()` | Answer questions about tables |

**Computer Vision:**
| Task | Method | Description |
|---|---|---|
| Text-to-Image | `textToImage()` | Generate images from text |
| Image-to-Image | `imageToImage()` | Transform/edit images |
| Image Captioning | `imageToText()` | Describe images |
| Classification | `imageClassification()` | Classify image content |
| Object Detection | `objectDetection()` | Detect and locate objects |
| Segmentation | `imageSegmentation()` | Pixel-level segmentation |
| Zero-Shot Image | `zeroShotImageClassification()` | Classify without training |
| Text-to-Video | `textToVideo()` | Generate videos |

**Audio:**
| Task | Method | Description |
|---|---|---|
| Text-to-Speech | `textToSpeech()` | Generate speech |
| Speech-to-Text | `automaticSpeechRecognition()` | Transcription |
| Audio Classification | `audioClassification()` | Classify sounds |
| Audio-to-Audio | `audioToAudio()` | Source separation, enhancement |

**Multimodal:**
| Task | Method | Description |
|---|---|---|
| Visual QA | `visualQuestionAnswering()` | Answer questions about images |
| Document QA | `documentQuestionAnswering()` | Answer questions about documents |

**Tabular:**
| Task | Method | Description |
|---|---|---|
| Classification | `tabularClassification()` | Classify tabular data |
| Regression | `tabularRegression()` | Predict continuous values |

#### HuggingFace Agentic Features

- **Tool/Function Calling:** Full support via `tools` parameter with `tool_choice` control (auto/none/required)
- **JSON Schema Responses:** `response_format: { type: 'json_schema', json_schema: {...} }`
- **Reasoning:** `reasoning_effort` parameter (none/minimal/low/medium/high/xhigh)
- **Multimodal Input:** Images via `image_url` content chunks in chat messages
- **17 Inference Providers:** Route through Groq, Together, Fireworks, Replicate, Cerebras, Cohere, and more

#### HuggingFace Provider Internals — How It Actually Works

The `HuggingFaceProvider` class (`src/providers/huggingface.ts`, 141 lines) wraps the `@huggingface/inference` library's `HfInference` client. Here's the exact internal flow for each modality:

**Initialization:**
```typescript
// Constructor receives a single API token
constructor(token: string) {
  this.client = new HfInference(token);
  // HfInference stores the token internally and attaches it
  // as Authorization: Bearer <token> to every request
}

// ping() always returns true — HuggingFace is considered
// "available" if the token was provided. No actual HTTP check.
async ping(): Promise<boolean> { return true; }
```

**Chat Completions — exact request flow:**
```typescript
// Default model: meta-llama/Llama-3.1-8B-Instruct
const model = options.model ?? 'meta-llama/Llama-3.1-8B-Instruct';

// Maps directly to HfInference.chatCompletion():
const response = await this.client.chatCompletion({
  model,                           // HuggingFace model ID or inference endpoint
  messages: options.messages,       // Array<{ role, content }> — passed directly
  temperature: options.temperature, // 0.0 - 2.0 (optional)
  max_tokens: options.maxTokens,    // Max output tokens (optional)
});

// Response parsing:
const choice = response.choices?.[0];           // OpenAI-compatible format
const usage = response.usage;                    // { prompt_tokens, completion_tokens }
// result.content = choice?.message?.content ?? ''
// result.usage.input = usage?.prompt_tokens
// result.usage.output = usage?.completion_tokens
// result.usage.cost = 0  (always free for HF Inference API)
```

**Image Generation — Blob-to-Buffer conversion pipeline:**
```typescript
// Default model: stabilityai/stable-diffusion-xl-base-1.0
const model = options.model ?? 'stabilityai/stable-diffusion-xl-base-1.0';

// Uses textToImage() which returns a Blob object:
const blob = await this.client.textToImage({
  model,
  inputs: options.prompt,        // The text prompt
  parameters: {
    negative_prompt: options.negativePrompt,  // What NOT to generate
    width: options.width,                      // Pixel width
    height: options.height,                    // Pixel height
    guidance_scale: options.guidanceScale,      // CFG scale
    num_inference_steps: options.steps,         // Denoising steps
  },
}, { outputType: 'blob' });  // <-- Forces Blob output (not ReadableStream)

// Blob → ArrayBuffer → Node.js Buffer conversion:
const buffer = Buffer.from(await blob.arrayBuffer());
// This is the critical step — HfInference returns a Web API Blob,
// which must be converted to a Node.js Buffer for downstream use.

// Result always reports PNG format regardless of actual model output:
// result.media = { width: options.width ?? 1024, height: options.height ?? 1024, format: 'png' }
```

**Text-to-Speech — Blob-to-Buffer conversion:**
```typescript
// Default model: facebook/mms-tts-eng
const model = options.model ?? 'facebook/mms-tts-eng';

// Uses textToSpeech() — simpler API, just model + text:
const blob = await this.client.textToSpeech({
  model,
  inputs: options.text,    // Text to synthesize
  // Note: No voice, speed, or format parameters — these are model-dependent
});

// Same Blob → Buffer conversion:
const buffer = Buffer.from(await blob.arrayBuffer());

// Usage tracks character count, not tokens:
// result.usage = { cost: 0, input: options.text.length, unit: 'characters' }
// result.media = { format: 'wav' }
```

**Model listing — dynamic Hub API discovery:**
```typescript
// HuggingFace now auto-fetches trending models from the Hub API:
async listModels(modality?: Modality): Promise<ModelInfo[]> {
  if (!this.dynamicModels) await this.fetchHubModels();
  // Returns: 3 hardcoded defaults + top 50 LLM + top 50 image + top 30 TTS
  // All filtered by inference_provider=all (only inference-ready models)
}

// Hub API request per modality:
// GET https://huggingface.co/api/models
//   ?pipeline_tag=text-generation
//   &inference_provider=all        ← Only models with active inference endpoints
//   &sort=trendingScore            ← Most popular first
//   &limit=50
//   &expand[]=inferenceProviderMapping  ← Include provider routing + pricing

// Response includes per model:
// - id: "Qwen/Qwen2.5-72B-Instruct"
// - inferenceProviderMapping: [{ provider: "together", status: "live",
//     providerDetails: { context_length: 32768, pricing: { input: 1.2 } } }]

// Pricing and context_length extracted from inferenceProviderMapping
// 3 hardcoded defaults always included as fallback
// Results cached in memory after first fetch
```

#### The 17 HuggingFace Inference Providers

The `@huggingface/inference` library supports routing requests through 17 different inference providers. This means a single HuggingFace model ID can be served by multiple backends with different performance/cost characteristics:

| # | Provider | Type | Strengths |
|---|---|---|---|
| 1 | `hf-inference` | HuggingFace's own | Default, free tier, rate-limited |
| 2 | `hf-dedicated` | Dedicated endpoints | Private, reserved GPU, guaranteed availability |
| 3 | `together-ai` | Together.ai | Fast inference, competitive pricing |
| 4 | `fireworks-ai` | Fireworks.ai | Optimized serving, function calling |
| 5 | `replicate` | Replicate | Pay-per-use, large model catalog |
| 6 | `cerebras` | Cerebras | Extreme speed (WSE-3 hardware) |
| 7 | `groq` | Groq | Ultra-low latency (LPU hardware) |
| 8 | `cohere` | Cohere | Enterprise, embeddings, RAG |
| 9 | `sambanova` | SambaNova | Enterprise RDU hardware |
| 10 | `nebius` | Nebius | European cloud infrastructure |
| 11 | `hyperbolic` | Hyperbolic Labs | Open-access GPU marketplace |
| 12 | `novita` | Novita AI | Cost-efficient inference |
| 13 | `ovh-cloud` | OVHcloud | European sovereign cloud |
| 14 | `aws` | Amazon SageMaker | AWS-managed endpoints |
| 15 | `azure` | Azure ML | Azure-managed endpoints |
| 16 | `google-vertex` | Google Vertex | GCP-managed endpoints |
| 17 | `deepinfra` | DeepInfra | High-throughput inference |

**Provider routing** is handled by the `@huggingface/inference` library's internal `provider` parameter:
```typescript
// Route through a specific inference provider:
const response = await client.chatCompletion({
  model: 'meta-llama/Llama-3.1-70B-Instruct',
  provider: 'together-ai',  // <-- Route through Together.ai
  messages: [...],
});

// NOTE: Noosphere does NOT currently expose the `provider` parameter
// in its ChatOptions type. To use a specific HF inference provider,
// you would need a custom provider or direct @huggingface/inference usage.
```

#### Using HuggingFace Locally — Dedicated Endpoints

HuggingFace Inference Endpoints let you deploy any model on dedicated GPUs. The `@huggingface/inference` library supports this via the `endpointUrl` parameter:

```typescript
// Direct HfInference usage with a local/dedicated endpoint:
import { HfInference } from '@huggingface/inference';

const client = new HfInference('your-token');

// Point to your dedicated endpoint:
const response = await client.chatCompletion({
  model: 'tgi',
  endpointUrl: 'https://your-endpoint.endpoints.huggingface.cloud',
  messages: [{ role: 'user', content: 'Hello' }],
});

// For a truly local setup with TGI (Text Generation Inference):
const localClient = new HfInference();  // No token needed for local
const response = await localClient.chatCompletion({
  model: 'tgi',
  endpointUrl: 'http://localhost:8080',  // Local TGI server
  messages: [...],
});
```

**Deploying HuggingFace models locally with TGI:**

```bash
# 1. Install Text Generation Inference (TGI):
docker run --gpus all -p 8080:80 \
  -v /data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3.1-8B-Instruct

# 2. For image models, use Inference Endpoints:
# Deploy via https://ui.endpoints.huggingface.co/
# Select your model, GPU type, and region
# Get an endpoint URL like: https://xyz123.endpoints.huggingface.cloud

# 3. For TTS models locally, use the Transformers library:
# pip install transformers torch
# Then run a local server that serves the model
```

**Other local deployment options:**

| Method | URL Pattern | Use Case |
|---|---|---|
| TGI Docker | `http://localhost:8080` | Production local LLM serving |
| HF Inference Endpoints | `https://xxxx.endpoints.huggingface.cloud` | Managed dedicated GPU |
| vLLM with HF models | `http://localhost:8000` | High-throughput local serving |
| Transformers + FastAPI | Custom URL | Custom model serving |

#### Unexposed `@huggingface/inference` Parameters

The `chatCompletion()` method accepts many parameters that Noosphere's `ChatOptions` doesn't currently expose. These are available if you use the library directly:

| Parameter | Type | Description |
|---|---|---|
| `temperature` | `number` | Sampling temperature (0-2.0) — **exposed** via `ChatOptions.temperature` |
| `max_tokens` | `number` | Max output tokens — **exposed** via `ChatOptions.maxTokens` |
| `top_p` | `number` | Nucleus sampling threshold (0-1.0) — **not exposed** |
| `top_k` | `number` | Top-K sampling — **not exposed** |
| `frequency_penalty` | `number` | Penalize repeated tokens (-2.0 to 2.0) — **not exposed** |
| `presence_penalty` | `number` | Penalize tokens already present (-2.0 to 2.0) — **not exposed** |
| `repetition_penalty` | `number` | Alternative repetition penalty (>1.0 penalizes) — **not exposed** |
| `stop` | `string[]` | Stop sequences — **not exposed** |
| `seed` | `number` | Deterministic sampling seed — **not exposed** |
| `tools` | `Tool[]` | Function/tool definitions — **not exposed** |
| `tool_choice` | `string \| object` | Tool selection strategy — **not exposed** |
| `tool_prompt` | `string` | System prompt for tool use — **not exposed** |
| `response_format` | `object` | JSON schema constraints — **not exposed** |
| `reasoning_effort` | `string` | Thinking depth level — **not exposed** |
| `stream` | `boolean` | Enable streaming — **not exposed** (use `chatCompletionStream()`) |
| `provider` | `string` | Inference provider routing — **not exposed** |
| `endpointUrl` | `string` | Custom endpoint URL — **not exposed** |
| `n` | `number` | Number of completions — **not exposed** |
| `logprobs` | `boolean` | Return log probabilities — **not exposed** |
| `grammar` | `object` | BNF grammar constraints — **not exposed** |

**Image generation unexposed parameters:**
| Parameter | Type | Description |
|---|---|---|
| `negative_prompt` | `string` | **Exposed** via `ImageOptions.negativePrompt` |
| `width` / `height` | `number` | **Exposed** via `ImageOptions.width/height` |
| `guidance_scale` | `number` | **Exposed** via `ImageOptions.guidanceScale` |
| `num_inference_steps` | `number` | **Exposed** via `ImageOptions.steps` |
| `scheduler` | `string` | Diffusion scheduler type — **not exposed** |
| `target_size` | `object` | Target resize dimensions — **not exposed** |
| `clip_skip` | `number` | CLIP skip layers — **not exposed** |

#### HuggingFace Error Behavior

Unlike other providers, HuggingFaceProvider does **not** catch errors from the `@huggingface/inference` library. All errors propagate directly up to Noosphere's `executeWithRetry()`:

```
HfInference throws → HuggingFaceProvider propagates →
  executeWithRetry catches → Noosphere wraps as NoosphereError
```

Common error scenarios:
- **401 Unauthorized** — Invalid or expired token → becomes `AUTH_FAILED`
- **404 Model Not Found** — Model ID doesn't exist on HF Hub → becomes `MODEL_NOT_FOUND`
- **429 Rate Limited** — Free tier limit exceeded → becomes `RATE_LIMITED` (retryable)
- **503 Model Loading** — Model is cold-starting on HF Inference → becomes `PROVIDER_UNAVAILABLE` (retryable)

---

### ComfyUI — Local Image Generation

**Provider ID:** `comfyui`
**Modalities:** Image, Video (planned)
**Type:** Local
**Default Port:** 8188
**Source:** `src/providers/comfyui.ts` (155 lines)

Connects to a local ComfyUI instance for Stable Diffusion workflows. ComfyUI is a node-based UI for Stable Diffusion that exposes an HTTP API. Noosphere communicates with it via raw HTTP — no ComfyUI SDK needed.

#### How It Works — Complete Lifecycle

```
User calls ai.image() →
  1. structuredClone(DEFAULT_TXT2IMG_WORKFLOW)     // Deep-clone the template
  2. Inject parameters into workflow nodes          // Mutate the clone
  3. POST /prompt { prompt: workflow }              // Queue the workflow
  4. Receive { prompt_id: "abc-123" }               // Get tracking ID
  5. POLL GET /history/abc-123 every 1000ms         // Check completion
  6. Parse outputs → find SaveImage node            // Locate generated image
  7. GET /view?filename=X&subfolder=Y&type=Z        // Fetch image binary
  8. Return Buffer                                   // PNG buffer to caller
```

#### The Complete Workflow JSON — All 8 Nodes

The `DEFAULT_TXT2IMG_WORKFLOW` constant defines a complete SDXL text-to-image pipeline as a ComfyUI node graph. Each key is a **node ID** (string), each value defines the node type and its connections:

```typescript
// Node "3": KSampler — The core diffusion sampling node
'3': {
  class_type: 'KSampler',
  inputs: {
    seed: 0,                    // Random seed (overridden by options.seed)
    steps: 20,                  // Denoising steps (overridden by options.steps)
    cfg: 7,                     // CFG/guidance scale (overridden by options.guidanceScale)
    sampler_name: 'euler',      // Sampling algorithm
    scheduler: 'normal',        // Noise schedule
    denoise: 1,                 // Full denoise (1.0 = txt2img, <1.0 = img2img)
    model: ['4', 0],            // ← Connection: output 0 of node "4" (checkpoint model)
    positive: ['6', 0],         // ← Connection: output 0 of node "6" (positive prompt)
    negative: ['7', 0],         // ← Connection: output 0 of node "7" (negative prompt)
    latent_image: ['5', 0],     // ← Connection: output 0 of node "5" (empty latent)
  },
}

// Node "4": CheckpointLoaderSimple — Loads the SDXL model from disk
'4': {
  class_type: 'CheckpointLoaderSimple',
  inputs: {
    ckpt_name: 'sd_xl_base_1.0.safetensors',  // Checkpoint file on disk
    // Outputs: [0]=MODEL, [1]=CLIP, [2]=VAE
    // MODEL → KSampler.model
    // CLIP  → CLIPTextEncode nodes
    // VAE   → VAEDecode
  },
}

// Node "5": EmptyLatentImage — Creates the initial noise tensor
'5': {
  class_type: 'EmptyLatentImage',
  inputs: {
    width: 1024,       // Overridden by options.width
    height: 1024,      // Overridden by options.height
    batch_size: 1,     // Always 1 image per generation
  },
}

// Node "6": CLIPTextEncode — Positive prompt encoding
'6': {
  class_type: 'CLIPTextEncode',
  inputs: {
    text: '',           // Overridden by options.prompt
    clip: ['4', 1],     // ← Connection: output 1 of node "4" (CLIP model)
  },
}

// Node "7": CLIPTextEncode — Negative prompt encoding
'7': {
  class_type: 'CLIPTextEncode',
  inputs: {
    text: '',           // Overridden by options.negativePrompt ?? ''
    clip: ['4', 1],     // ← Same CLIP model as positive prompt
  },
}

// Node "8": VAEDecode — Converts latent space to pixel space
'8': {
  class_type: 'VAEDecode',
  inputs: {
    samples: ['3', 0],  // ← Connection: output 0 of node "3" (sampled latents)
    vae: ['4', 2],       // ← Connection: output 2 of node "4" (VAE decoder)
  },
}

// Node "9": SaveImage — Saves the final image
'9': {
  class_type: 'SaveImage',
  inputs: {
    filename_prefix: 'noosphere',   // Files saved as noosphere_00001.png, etc.
    images: ['8', 0],                // ← Connection: output 0 of node "8" (decoded image)
  },
}
```

**Node connection format:** `['nodeId', outputIndex]` — this is ComfyUI's internal linking system. For example, `['4', 1]` means "output slot 1 of node 4", which is the CLIP model from CheckpointLoaderSimple.

**Visual pipeline flow:**
```
CheckpointLoader["4"] ──MODEL──→ KSampler["3"]
         ├──CLIP──→ CLIPTextEncode["6"] (positive) ──→ KSampler["3"]
         ├──CLIP──→ CLIPTextEncode["7"] (negative) ──→ KSampler["3"]
         └──VAE───→ VAEDecode["8"]
EmptyLatentImage["5"] ──→ KSampler["3"] ──→ VAEDecode["8"] ──→ SaveImage["9"]
```

#### Parameter Injection — How Options Map to Nodes

```typescript
// Deep-clone to avoid mutating the template:
const workflow = structuredClone(DEFAULT_TXT2IMG_WORKFLOW);

// Direct node mutations:
workflow['6'].inputs.text = options.prompt;                    // Positive prompt → Node 6
workflow['7'].inputs.text = options.negativePrompt ?? '';      // Negative prompt → Node 7
workflow['5'].inputs.width = options.width ?? 1024;            // Width → Node 5
workflow['5'].inputs.height = options.height ?? 1024;          // Height → Node 5

// Conditional overrides (only if user provided them):
if (options.seed !== undefined)          workflow['3'].inputs.seed = options.seed;
if (options.steps !== undefined)         workflow['3'].inputs.steps = options.steps;
if (options.guidanceScale !== undefined) workflow['3'].inputs.cfg = options.guidanceScale;
// Note: sampler_name, scheduler, and denoise are NOT configurable via Noosphere.
// They're hardcoded to euler/normal/1.0
```

#### Queue Submission — POST /prompt

```typescript
const queueRes = await fetch(`${this.baseUrl}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: workflow }),
  // ComfyUI expects: { prompt: <workflow_object>, client_id?: string }
});

if (!queueRes.ok) throw new Error(`ComfyUI queue failed: ${queueRes.status}`);

const { prompt_id } = await queueRes.json();
// prompt_id is a UUID like "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
// Used to track this specific generation in the history API
```

#### Polling Mechanism — Deadline-Based with 1s Intervals

```typescript
private async pollForResult(promptId: string, maxWaitMs = 300000): Promise<ArrayBuffer> {
  const deadline = Date.now() + maxWaitMs;  // 300,000ms = 5 minutes

  while (Date.now() < deadline) {
    // Check history for our prompt
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);

    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 1000));  // 1 second between polls
      continue;
    }

    const history = await res.json();
    // History format: { [promptId]: { outputs: { [nodeId]: { images: [...] } } } }

    const entry = history[promptId];
    if (!entry?.outputs) {
      await new Promise((r) => setTimeout(r, 1000));  // Not ready yet
      continue;
    }

    // Search ALL output nodes for images (not just node "9"):
    for (const nodeOutput of Object.values(entry.outputs)) {
      if (nodeOutput.images?.length > 0) {
        const img = nodeOutput.images[0];
        // Fetch the actual image binary:
        const imgRes = await fetch(
          `${this.baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
        );
        return imgRes.arrayBuffer();
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(`ComfyUI generation timed out after ${maxWaitMs}ms`);
}
```

**Key polling details:**
- **Interval:** Fixed 1000ms (not configurable)
- **Timeout:** 300,000ms = 5 minutes (hardcoded, not from `config.timeout.image`)
- **Deadline-based:** Uses `Date.now() < deadline` comparison, NOT a retry counter
- **Image fetch URL format:** `/view?filename=noosphere_00001_.png&subfolder=&type=output`
- **Returns:** Raw `ArrayBuffer` → converted to `Buffer` by the caller

#### Auto-Detection — How ComfyUI Gets Discovered

During `Noosphere.init()`, if `autoDetectLocal` is true:

```typescript
// Ping the /system_stats endpoint with a 2-second timeout:
const pingUrl = async (url: string): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);  // 2s hard timeout
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
};

// Check ComfyUI specifically:
if (comfyuiCfg?.enabled) {
  const ok = await pingUrl(`${comfyuiCfg.host}:${comfyuiCfg.port}/system_stats`);
  if (ok) {
    this.registry.addProvider(new ComfyUIProvider({
      host: comfyuiCfg.host,  // Default: 'http://localhost'
      port: comfyuiCfg.port,  // Default: 8188
    }));
  }
}
```

**Environment variable overrides:**
```bash
COMFYUI_HOST=http://192.168.1.100    # Override host
COMFYUI_PORT=8190                     # Override port
```

#### Configuration

```typescript
const ai = new Noosphere({
  local: {
    comfyui: {
      enabled: true,                      // Default: true (auto-detected)
      host: 'http://localhost',           // Default: 'http://localhost'
      port: 8188,                         // Default: 8188
    },
  },
});
```

#### Model Discovery — Dynamic via /object_info

```typescript
async listModels(modality?: Modality): Promise<ModelInfo[]> {
  // Fetches ComfyUI's full node registry:
  const res = await fetch(`${this.baseUrl}/object_info`);
  if (!res.ok) return [];

  // Does NOT parse the response — just uses it as a connectivity check.
  // Returns hardcoded model entries:
  const models: ModelInfo[] = [];
  if (!modality || modality === 'image') {
    models.push({
      id: 'comfyui-txt2img',
      provider: 'comfyui',
      name: 'ComfyUI Text-to-Image',
      modality: 'image',
      local: true,
      cost: { price: 0, unit: 'free' },
      capabilities: { maxWidth: 2048, maxHeight: 2048, supportsNegativePrompt: true },
    });
  }
  if (!modality || modality === 'video') {
    models.push({
      id: 'comfyui-txt2vid',
      provider: 'comfyui',
      name: 'ComfyUI Text-to-Video',
      modality: 'video',
      local: true,
      cost: { price: 0, unit: 'free' },
      capabilities: { maxDuration: 10, supportsImageToVideo: true },
    });
  }
  return models;
}
// NOTE: /object_info is fetched but the response is discarded.
// The actual model list is hardcoded. This means even if you have
// dozens of checkpoints in ComfyUI, Noosphere only exposes 2 model IDs.
```

#### Video Generation — Not Yet Implemented

```typescript
async video(_options: VideoOptions): Promise<NoosphereResult> {
  throw new Error('ComfyUI video generation requires a configured AnimateDiff workflow');
}
// The 'comfyui-txt2vid' model ID is listed but will throw at runtime.
// This is a placeholder for future AnimateDiff/SVD workflow templates.
```

#### Default Workflow Parameters Summary

| Parameter | Default | Configurable | Node |
|---|---|---|---|
| Checkpoint | `sd_xl_base_1.0.safetensors` | No | Node 4 |
| Sampler | `euler` | No | Node 3 |
| Scheduler | `normal` | No | Node 3 |
| Denoise | `1.0` | No | Node 3 |
| Steps | `20` | Yes (`options.steps`) | Node 3 |
| CFG/Guidance | `7` | Yes (`options.guidanceScale`) | Node 3 |
| Seed | `0` | Yes (`options.seed`) | Node 3 |
| Width | `1024` | Yes (`options.width`) | Node 5 |
| Height | `1024` | Yes (`options.height`) | Node 5 |
| Batch Size | `1` | No | Node 5 |
| Filename Prefix | `noosphere` | No | Node 9 |
| Negative Prompt | `''` (empty) | Yes (`options.negativePrompt`) | Node 7 |
| Max Size | `2048x2048` | Via options | Node 5 |
| Output Format | PNG | No | ComfyUI default |

---

### Local TTS — Piper & Kokoro

**Provider IDs:** `piper`, `kokoro`
**Modality:** TTS
**Type:** Local
**Source:** `src/providers/local-tts.ts` (112 lines)

The `LocalTTSProvider` is a generic adapter for any local TTS server that exposes an OpenAI-compatible `/v1/audio/speech` endpoint. Two instances are created by default — one for Piper, one for Kokoro — but the class works with ANY server implementing this protocol.

#### Supported Engines

| Engine | Default Port | Health Check | Voice Discovery | Description |
|---|---|---|---|---|
| Piper | 5500 | `GET /health` | `GET /voices` (array) | Fast offline TTS, 30+ languages, ONNX models |
| Kokoro | 5501 | `GET /health` | `GET /v1/models` (OpenAI format) | High-quality neural TTS |

#### Provider Instantiation — How Instances Are Created

```typescript
// The LocalTTSProvider constructor takes a config object:
interface LocalTTSConfig {
  id: string;     // Provider ID: 'piper' or 'kokoro'
  name: string;   // Display name: 'Piper TTS' or 'Kokoro TTS'
  host: string;   // Base URL host
  port: number;   // Port number
}

// Two separate instances are created during init():
new LocalTTSProvider({ id: 'piper',  name: 'Piper TTS',  host: piperCfg.host,  port: piperCfg.port })
new LocalTTSProvider({ id: 'kokoro', name: 'Kokoro TTS', host: kokoroCfg.host, port: kokoroCfg.port })

// Each instance is an independent provider in the registry.
// They don't share state or config.
// The baseUrl is constructed as: `${config.host}:${config.port}`
// Example: "http://localhost:5500"
```

#### Health Check — Ping Protocol

```typescript
async ping(): Promise<boolean> {
  try {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.ok;  // true if HTTP 200-299
  } catch {
    return false;    // Network error, connection refused, etc.
  }
}
// Used during auto-detection in Noosphere.init()
// Also used by: the 2-second AbortController timeout in init()
// Note: /health is checked BEFORE the provider is registered.
// If /health fails, the provider is silently skipped.
```

#### Dual Voice Discovery Mechanism

The `listModels()` method implements a **two-strategy fallback** to discover available voices. This is necessary because different TTS servers expose voices through different API formats:

```typescript
async listModels(modality?: Modality): Promise<ModelInfo[]> {
  if (modality && modality !== 'tts') return [];

  let voices: Array<{ id: string; name?: string }> = [];

  // STRATEGY 1: Piper-style /voices endpoint
  // Expected response: Array<{ id: string, name?: string, ... }>
  try {
    const res = await fetch(`${this.baseUrl}/voices`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        voices = data;
        // Success — skip fallback
      }
    }
  } catch {
    // STRATEGY 2: OpenAI-compatible /v1/models endpoint
    // Expected response: { data: Array<{ id: string, ... }> }
    const res = await fetch(`${this.baseUrl}/v1/models`);
    if (res.ok) {
      const data = await res.json();
      voices = data.data ?? [];
    }
  }

  // Map voices to ModelInfo objects:
  return voices.map((v) => ({
    id: v.id,
    provider: this.id,              // 'piper' or 'kokoro'
    name: v.name ?? v.id,           // Fallback to ID if no name
    modality: 'tts' as const,
    local: true,
    cost: { price: 0, unit: 'free' },
    capabilities: {
      voices: voices.map((vv) => vv.id),  // All voice IDs as capabilities
    },
  }));
}
```

**Critical implementation detail:** The fallback is triggered by a `catch` block, NOT by checking the response. This means:
- If `/voices` returns a **non-array** (e.g., `{}`), strategy 1 succeeds but `voices` remains empty
- If `/voices` returns HTTP **404**, strategy 1 "succeeds" (no exception), but `res.ok` is false, so voices stays empty, AND strategy 2 is never tried
- Strategy 2 only runs if `/voices` **throws a network error** (connection refused, DNS failure, etc.)

**Piper response format** (`GET /voices`):
```json
[
  { "id": "en_US-lessac-medium", "name": "Lessac (English US)" },
  { "id": "en_US-amy-medium", "name": "Amy (English US)" },
  { "id": "de_DE-thorsten-high", "name": "Thorsten (German)" }
]
```

**Kokoro/OpenAI response format** (`GET /v1/models`):
```json
{
  "data": [
    { "id": "kokoro-v1", "object": "model" },
    { "id": "kokoro-v1-jp", "object": "model" }
  ]
}
```

#### Speech Generation — Exact HTTP Protocol

```typescript
async speak(options: SpeakOptions): Promise<NoosphereResult> {
  const start = Date.now();

  // POST to OpenAI-compatible TTS endpoint:
  const res = await fetch(`${this.baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? 'tts-1',        // Default model ID
      input: options.text,                     // Text to synthesize
      voice: options.voice ?? 'default',       // Voice selection
      speed: options.speed ?? 1.0,             // Playback speed multiplier
      response_format: options.format ?? 'mp3', // Output audio format
    }),
  });

  if (!res.ok) {
    throw new Error(`Local TTS failed: ${res.status} ${await res.text()}`);
    // Note: error includes the response body text for debugging
  }

  // Response is raw audio binary — convert to Buffer:
  const audioBuffer = Buffer.from(await res.arrayBuffer());

  return {
    buffer: audioBuffer,
    provider: this.id,                              // 'piper' or 'kokoro'
    model: options.model ?? options.voice ?? 'default',  // Fallback chain
    modality: 'tts',
    latencyMs: Date.now() - start,
    usage: {
      cost: 0,                                       // Always free (local)
      input: options.text.length,                     // CHARACTER count, not tokens
      unit: 'characters',                             // Track by characters
    },
    media: {
      format: options.format ?? 'mp3',               // Matches requested format
    },
  };
}
```

**Request/Response details:**
| Field | Value | Notes |
|---|---|---|
| Method | `POST` | Always POST |
| URL | `/v1/audio/speech` | OpenAI-compatible standard |
| Content-Type | `application/json` | JSON body |
| Response Content-Type | `audio/mpeg`, `audio/wav`, or `audio/ogg` | Depends on `response_format` |
| Response Body | Raw binary audio | Converted to `Buffer` via `arrayBuffer()` |

**Available formats (from `SpeakOptions.format` type):**
| Format | Typical Size | Quality | Use Case |
|---|---|---|---|
| `mp3` | Smallest | Lossy | Web playback, storage |
| `wav` | Largest | Lossless | Processing, editing |
| `ogg` | Medium | Lossy | Web playback, open format |

#### Usage Tracking — Character-Based

Local TTS tracks usage by **character count**, not tokens:

```typescript
usage: {
  cost: 0,                        // Always 0 for local providers
  input: options.text.length,     // JavaScript string .length (UTF-16 code units)
  unit: 'characters',             // Unit identifier for aggregation
}
// Note: .length counts UTF-16 code units, not Unicode codepoints.
// "Hello" = 5, "🎵" = 2 (surrogate pair), "café" = 4
```

This feeds into the global `UsageTracker`, so you can query TTS usage:
```typescript
const usage = ai.getUsage({ modality: 'tts' });
// usage.totalRequests = number of TTS calls
// usage.totalCost = 0 (always free for local)
// usage.byProvider = { piper: 0, kokoro: 0 }
```

#### Auto-Detection — Parallel Discovery

Both Piper and Kokoro are detected simultaneously during `init()`:

```typescript
// Inside Noosphere.init(), wrapped in Promise.allSettled():
await Promise.allSettled([
  // ... ComfyUI detection ...
  (async () => {
    if (piperCfg?.enabled) {    // enabled: true by default
      const ok = await pingUrl(`${piperCfg.host}:${piperCfg.port}/health`);
      if (ok) {
        this.registry.addProvider(new LocalTTSProvider({
          id: 'piper', name: 'Piper TTS',
          host: piperCfg.host, port: piperCfg.port,
        }));
      }
    }
  })(),
  (async () => {
    if (kokoroCfg?.enabled) {   // enabled: true by default
      const ok = await pingUrl(`${kokoroCfg.host}:${kokoroCfg.port}/health`);
      if (ok) {
        this.registry.addProvider(new LocalTTSProvider({
          id: 'kokoro', name: 'Kokoro TTS',
          host: kokoroCfg.host, port: kokoroCfg.port,
        }));
      }
    }
  })(),
]);
```

**Environment variable overrides:**
```bash
PIPER_HOST=http://192.168.1.100    PIPER_PORT=5500
KOKORO_HOST=http://192.168.1.100   KOKORO_PORT=5501
```

#### Setting Up Local TTS Servers

**Piper TTS:**
```bash
# Docker (recommended):
docker run -p 5500:5500 rhasspy/wyoming-piper \
  --voice en_US-lessac-medium

# Or via pip:
pip install piper-tts
# Then run a compatible HTTP server (wyoming-piper or piper-http-server)
```

**Kokoro TTS:**
```bash
# Docker:
docker run -p 5501:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest

# The Kokoro server exposes OpenAI-compatible endpoints at:
# GET  /v1/models          → List available voices
# POST /v1/audio/speech    → Generate speech
# GET  /health             → Health check
```

---

## Architecture

### The Complete Init() Flow — What Happens When You Create a Noosphere Instance

```typescript
const ai = new Noosphere({ /* config */ });
// At this point: config is resolved, but NO providers are registered.
// The `initialized` flag is false.

await ai.chat({ messages: [...] });
// FIRST call triggers lazy initialization via init()
```

**Initialization sequence (`src/noosphere.ts:240-322`):**

```
1. Constructor:
   ├── resolveConfig(input)           // Merge config > env > defaults
   ├── new Registry(cacheTTLMinutes)  // Empty provider registry
   └── new UsageTracker(onUsage)      // Empty event list

2. First API call triggers init():
   ├── Set initialized = true (immediately, before any async work)
   │
   ├── CLOUD PROVIDER REGISTRATION (synchronous):
   │   ├── Collect all API keys from resolved config
   │   ├── If ANY LLM key exists → register PiAiProvider(allKeys)
   │   ├── If FAL key exists    → register FalProvider(falKey)
   │   └── If HF token exists   → register HuggingFaceProvider(token)
   │
   └── LOCAL SERVICE DETECTION (parallel, async):
       └── Promise.allSettled([
             pingUrl(comfyui /system_stats)  → register ComfyUIProvider
             pingUrl(piper /health)          → register LocalTTSProvider('piper')
             pingUrl(kokoro /health)         → register LocalTTSProvider('kokoro')
           ])
```

**Key design decisions:**
- `initialized = true` is set **before** async work, preventing concurrent init() calls
- Cloud providers are registered **synchronously** (no network calls needed)
- Local detection uses `Promise.allSettled()` — a failing ping doesn't block others
- Each ping has a 2-second `AbortController` timeout
- If auto-detection is disabled (`autoDetectLocal: false`), local providers are never registered

### Configuration Resolution — Three-Layer Priority System

The `resolveConfig()` function (`src/config.ts`, 87 lines) implements a strict priority hierarchy:

```
Priority: Explicit Config > Environment Variables > Built-in Defaults
```

**API Key Resolution:**
```typescript
// For each of the 9 supported providers:
const ENV_KEY_MAP = {
  openai:      'OPENAI_API_KEY',
  anthropic:   'ANTHROPIC_API_KEY',
  google:      'GEMINI_API_KEY',
  fal:         'FAL_KEY',
  openrouter:  'OPENROUTER_API_KEY',
  huggingface: 'HUGGINGFACE_TOKEN',
  groq:        'GROQ_API_KEY',
  mistral:     'MISTRAL_API_KEY',
  xai:         'XAI_API_KEY',
};

// Resolution per key:
keys[name] = input.keys?.[name]     // 1. Explicit config
           ?? process.env[envVar];   // 2. Environment variable
                                     // 3. undefined (no default)
```

**Local Service Resolution:**
```typescript
// For each of the 4 local services:
const LOCAL_DEFAULTS = {
  ollama:  { host: 'http://localhost', port: 11434, envHost: 'OLLAMA_HOST',  envPort: 'OLLAMA_PORT'  },
  comfyui: { host: 'http://localhost', port: 8188,  envHost: 'COMFYUI_HOST', envPort: 'COMFYUI_PORT' },
  piper:   { host: 'http://localhost', port: 5500,  envHost: 'PIPER_HOST',   envPort: 'PIPER_PORT'   },
  kokoro:  { host: 'http://localhost', port: 5501,  envHost: 'KOKORO_HOST',  envPort: 'KOKORO_PORT'  },
};

// Resolution per service:
local[name] = {
  enabled: cfgLocal?.enabled ?? true,                          // Default: enabled
  host:    cfgLocal?.host ?? process.env[envHost] ?? defaults.host,
  port:    cfgLocal?.port ?? parseInt(process.env[envPort]) ?? defaults.port,
  type:    cfgLocal?.type,
};
```

**Other config defaults:**
| Setting | Default | Environment Override |
|---|---|---|
| `autoDetectLocal` | `true` | `NOOSPHERE_AUTO_DETECT_LOCAL` |
| `discoveryCacheTTL` | `60` (minutes) | `NOOSPHERE_DISCOVERY_CACHE_TTL` |
| `retry.maxRetries` | `2` | — |
| `retry.backoffMs` | `1000` | — |
| `retry.failover` | `true` | — |
| `retry.retryableErrors` | `['PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'TIMEOUT']` | — |
| `timeout.llm` | `30000` (30s) | — |
| `timeout.image` | `120000` (2m) | — |
| `timeout.video` | `300000` (5m) | — |
| `timeout.tts` | `60000` (1m) | — |

### Provider Resolution — Local-First Algorithm

When you call a generation method without specifying a provider, Noosphere resolves one automatically through a three-stage process in `resolveProviderForModality()` (`src/noosphere.ts:324-348`):

```typescript
private resolveProviderForModality(
  modality: Modality,
  preferredId?: string,
  modelId?: string,
): NoosphereProvider {

  // STAGE 1: Model-based resolution
  // If model was specified WITHOUT a provider, search the registry cache
  if (modelId && !preferredId) {
    const resolved = this.registry.resolveModel(modelId, modality);
    if (resolved) return resolved.provider;
    // resolveModel() scans ALL cached models across ALL providers
    // looking for exact match on both modelId AND modality
  }

  // STAGE 2: Default-based resolution
  // Check if user configured a default for this modality
  if (!preferredId) {
    const defaultCfg = this.config.defaults[modality];
    if (defaultCfg) {
      preferredId = defaultCfg.provider;
      // Now fall through to Stage 3 with this preferredId
    }
  }

  // STAGE 3: Provider registry resolution
  const provider = this.registry.resolveProvider(modality, preferredId);
  if (!provider) {
    throw new NoosphereError(
      `No provider available for modality '${modality}'`,
      { code: 'NO_PROVIDER', ... }
    );
  }
  return provider;
}
```

**Registry.resolveProvider() — The local-first algorithm** (`src/registry.ts:31-46`):

```typescript
resolveProvider(modality: Modality, preferredId?: string): NoosphereProvider | null {
  // If a specific provider was requested:
  if (preferredId) {
    const p = this.providers.get(preferredId);
    if (p && p.modalities.includes(modality)) return p;
    return null;  // NOT found — returns null, NOT a fallback
  }

  // No preference — scan with local-first priority:
  let bestCloud: NoosphereProvider | null = null;

  for (const p of this.providers.values()) {
    if (!p.modalities.includes(modality)) continue;

    // LOCAL provider found → return IMMEDIATELY (first match wins)
    if (p.isLocal) return p;

    // CLOUD provider → save as fallback (first cloud match only)
    if (!bestCloud) bestCloud = p;
  }

  return bestCloud;  // Return first cloud provider, or null
}
```

**Resolution priority diagram:**
```
ai.chat({ model: 'gpt-4o' })
  │
  ├─ Stage 1: Search modelCache for 'gpt-4o' with modality 'llm'
  │  └── Found in pi-ai cache → return PiAiProvider
  │
  ├─ Stage 2: (skipped — model resolved in Stage 1)
  │
  └─ Stage 3: (skipped — already resolved)

ai.image({ prompt: 'sunset' })
  │
  ├─ Stage 1: (no model specified, skipped)
  │
  ├─ Stage 2: Check config.defaults.image → none configured
  │
  └─ Stage 3: resolveProvider('image', undefined)
     ├── Scan providers:
     │   ├── pi-ai: modalities=['llm'] → skip (no 'image')
     │   ├── comfyui: modalities=['image','video'], isLocal=true → RETURN
     │   └── (fal never reached — local wins)
     └── Returns ComfyUIProvider (local-first)

ai.image({ prompt: 'sunset' })  // No local ComfyUI running
  │
  └─ Stage 3: resolveProvider('image', undefined)
     ├── Scan providers:
     │   ├── pi-ai: no 'image' → skip
     │   ├── fal: modalities=['image','video','tts'], isLocal=false → save as bestCloud
     │   └── huggingface: modalities=['image','tts','llm'], isLocal=false → already have bestCloud
     └── Returns FalProvider (first cloud fallback)
```

### Retry & Failover Logic — Complete Algorithm

The `executeWithRetry()` method (`src/noosphere.ts:350-397`) implements a two-phase error handling strategy: same-provider retries, then cross-provider failover.

```typescript
private async executeWithRetry<T>(
  modality: Modality,
  provider: NoosphereProvider,
  fn: () => Promise<T>,
  failoverFnFactory?: (alt: NoosphereProvider) => (() => Promise<T>) | null,
): Promise<T> {
  const { maxRetries, backoffMs, retryableErrors, failover } = this.config.retry;
  // Default: maxRetries=2, backoffMs=1000, failover=true
  // retryableErrors = ['PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'TIMEOUT']
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();  // Try the primary provider
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isNoosphereErr = err instanceof NoosphereError;
      const code = isNoosphereErr ? err.code : 'GENERATION_FAILED';

      // GENERATION_FAILED is special:
      //   - Retryable on same provider (bad prompt, transient model issue)
      //   - NOT eligible for cross-provider failover
      const isRetryable = retryableErrors.includes(code) || code === 'GENERATION_FAILED';
      const allowsFailover = code !== 'GENERATION_FAILED' && retryableErrors.includes(code);

      if (!isRetryable || attempt === maxRetries) {
        // FAILOVER PHASE: Try other providers
        if (failover && allowsFailover && failoverFnFactory) {
          const altProviders = this.registry.getAllProviders()
            .filter((p) => p.id !== provider.id && p.modalities.includes(modality));

          for (const alt of altProviders) {
            try {
              const altFn = failoverFnFactory(alt);
              if (altFn) return await altFn();  // Success on alternate provider
            } catch {
              // Continue to next alternate provider
            }
          }
        }
        break;  // All retries and failovers exhausted
      }

      // RETRY: Exponential backoff on same provider
      const delay = backoffMs * Math.pow(2, attempt);
      // attempt=0: 1000ms, attempt=1: 2000ms, attempt=2: 4000ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new NoosphereError('Generation failed', { ... });
}
```

**Failover function factory pattern:**

Each generation method passes a factory function that creates the right call for alternate providers:
```typescript
// In chat():
(alt) => alt.chat ? () => alt.chat!(options) : null
// If the alternate provider has chat(), create a function to call it.
// If not (e.g., ComfyUI for LLM), return null → skip this provider.

// In image():
(alt) => alt.image ? () => alt.image!(options) : null

// In video():
(alt) => alt.video ? () => alt.video!(options) : null

// In speak():
(alt) => alt.speak ? () => alt.speak!(options) : null
```

**Complete retry timeline example:**
```
ai.chat() with provider="pi-ai", maxRetries=2, backoffMs=1000

Attempt 0: pi-ai.chat() → RATE_LIMITED
  wait 1000ms (1000 * 2^0)
Attempt 1: pi-ai.chat() → RATE_LIMITED
  wait 2000ms (1000 * 2^1)
Attempt 2: pi-ai.chat() → RATE_LIMITED
  // maxRetries exhausted, RATE_LIMITED allows failover
  Failover 1: huggingface.chat() → 503 SERVICE_UNAVAILABLE
  Failover 2: (no more providers with 'llm' modality)
  throw last error (RATE_LIMITED from pi-ai)
```

**Error classification matrix:**

| Error Code | Same-Provider Retry | Cross-Provider Failover | Typical Cause |
|---|---|---|---|
| `PROVIDER_UNAVAILABLE` | Yes | Yes | Server down, network error |
| `RATE_LIMITED` | Yes | Yes | API quota exceeded |
| `TIMEOUT` | Yes | Yes | Slow response |
| `GENERATION_FAILED` | Yes | **No** | Bad prompt, model error |
| `AUTH_FAILED` | No | No | Wrong API key |
| `MODEL_NOT_FOUND` | No | No | Invalid model ID |
| `INVALID_INPUT` | No | No | Bad parameters |
| `NO_PROVIDER` | No | No | No provider registered |

### Model Registry — Internal Data Structures

The Registry (`src/registry.ts`, 137 lines) is the central nervous system that maps providers to models and handles model lookups.

**Internal state:**
```typescript
class Registry {
  // Provider storage: Map<providerId, providerInstance>
  private providers = new Map<string, NoosphereProvider>();
  // Example: { 'pi-ai' → PiAiProvider, 'fal' → FalProvider, 'comfyui' → ComfyUIProvider }

  // Model cache: Map<providerId, { models: ModelInfo[], syncedAt: timestamp }>
  private modelCache = new Map<string, CachedModels>();
  // Example: {
  //   'pi-ai' → { models: [246 ModelInfo objects], syncedAt: 1710000000000 },
  //   'fal'   → { models: [867 ModelInfo objects], syncedAt: 1710000000000 },
  // }

  // Cache TTL in milliseconds (converted from minutes in constructor)
  private cacheTTLMs: number;
  // Default: 60 * 60 * 1000 = 3,600,000ms = 1 hour
}
```

**Cache staleness check:**
```typescript
isCacheStale(providerId: string): boolean {
  const cached = this.modelCache.get(providerId);
  if (!cached) return true;  // No cache = stale
  return Date.now() - cached.syncedAt > this.cacheTTLMs;
  // Example: if syncedAt was 61 minutes ago and TTL is 60 minutes → stale
}
```

**Model resolution — linear scan across all caches:**
```typescript
resolveModel(modelId: string, modality: Modality):
  { provider: NoosphereProvider; model: ModelInfo } | null {

  // Scan EVERY provider's cached models:
  for (const [providerId, cached] of this.modelCache) {
    const model = cached.models.find(
      (m) => m.id === modelId && m.modality === modality
    );
    // Must match BOTH modelId AND modality
    if (model) {
      const provider = this.providers.get(providerId);
      if (provider) return { provider, model };
    }
  }
  return null;
}
// Performance: O(n) where n = total models across all providers
// With 246 Pi-AI + 867 FAL + 3 HuggingFace = ~1116 models to scan
// This is fast enough for the use case (called once per request)
```

**Sync mechanism:**
```typescript
async syncAll(): Promise<SyncResult> {
  const byProvider: Record<string, number> = {};
  const errors: string[] = [];
  let synced = 0;

  // Sequential sync (NOT parallel) — one provider at a time:
  for (const provider of this.providers.values()) {
    try {
      const models = await provider.listModels();
      this.modelCache.set(provider.id, {
        models,
        syncedAt: Date.now(),
      });
      byProvider[provider.id] = models.length;
      synced += models.length;
    } catch (err) {
      errors.push(`${provider.id}: ${err.message}`);
      byProvider[provider.id] = 0;
      // Note: failed sync does NOT clear existing cache
    }
  }

  return { synced, byProvider, errors };
}
```

**Provider info aggregation:**
```typescript
getProviderInfos(modality?: Modality): ProviderInfo[] {
  // Returns summary info for each registered provider:
  // {
  //   id: 'pi-ai',
  //   name: 'pi-ai (LLM Gateway)',
  //   modalities: ['llm'],
  //   local: false,
  //   status: 'online',       // Always 'online' — no live ping check
  //   modelCount: 246,        // From cache, or 0 if not synced
  // }
}
```

### Usage Tracking — In-Memory Event Store

The `UsageTracker` (`src/tracking.ts`, 57 lines) records every API call and provides filtered aggregation.

**Internal state:**
```typescript
class UsageTracker {
  private events: UsageEvent[] = [];  // Append-only array
  private onUsage?: (event: UsageEvent) => void | Promise<void>;  // Optional callback
}
```

**Recording flow — every API call creates a UsageEvent:**

```typescript
// On SUCCESS (in Noosphere.trackUsage):
const event: UsageEvent = {
  modality: result.modality,    // 'llm' | 'image' | 'video' | 'tts'
  provider: result.provider,    // 'pi-ai', 'fal', etc.
  model: result.model,          // 'gpt-4o', 'flux-pro', etc.
  cost: result.usage.cost,      // USD amount (0 for free/local)
  latencyMs: result.latencyMs,  // Wall-clock milliseconds
  input: result.usage.input,    // Input tokens or characters
  output: result.usage.output,  // Output tokens (LLM only)
  unit: result.usage.unit,      // 'tokens', 'characters', 'free'
  timestamp: new Date().toISOString(),  // ISO 8601
  success: true,
  metadata,                     // User-provided metadata passthrough
};

// On FAILURE (in Noosphere.trackError):
const event: UsageEvent = {
  modality, provider,
  model: model ?? 'unknown',
  cost: 0,                              // No cost on failure
  latencyMs: Date.now() - startMs,      // Time until failure
  timestamp: new Date().toISOString(),
  success: false,
  error: err instanceof Error ? err.message : String(err),
  metadata,
};
```

**Query/aggregation — filtered summary:**
```typescript
getSummary(options?: UsageQueryOptions): UsageSummary {
  let filtered = this.events;

  // Time-range filtering:
  if (options?.since) {
    const since = new Date(options.since).getTime();
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= since);
  }
  if (options?.until) {
    const until = new Date(options.until).getTime();
    filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= until);
  }

  // Provider/modality filtering:
  if (options?.provider) {
    filtered = filtered.filter((e) => e.provider === options.provider);
  }
  if (options?.modality) {
    filtered = filtered.filter((e) => e.modality === options.modality);
  }

  // Aggregation:
  const byProvider: Record<string, number> = {};
  const byModality = { llm: 0, image: 0, video: 0, tts: 0 };
  let totalCost = 0;

  for (const event of filtered) {
    totalCost += event.cost;
    byProvider[event.provider] = (byProvider[event.provider] ?? 0) + event.cost;
    byModality[event.modality] += event.cost;
  }

  return { totalCost, totalRequests: filtered.length, byProvider, byModality };
}
```

**Usage example:**
```typescript
// Get all usage:
const all = ai.getUsage();
// { totalCost: 0.42, totalRequests: 15, byProvider: { 'pi-ai': 0.40, 'fal': 0.02 }, byModality: { llm: 0.40, image: 0.02, video: 0, tts: 0 } }

// Get usage for last hour, LLM only:
const recent = ai.getUsage({
  since: new Date(Date.now() - 3600000),
  modality: 'llm',
});

// Get usage for a specific provider:
const falUsage = ai.getUsage({ provider: 'fal' });

// Real-time callback (set in constructor):
const ai = new Noosphere({
  onUsage: (event) => {
    console.log(`${event.provider}/${event.model}: $${event.cost} in ${event.latencyMs}ms`);
    // Or: send to analytics, update dashboard, check budget
  },
});
```

**Important limitations:**
- Events are stored **in memory only** — lost on process restart
- No deduplication — each retry/failover attempt creates a separate event
- `clear()` wipes all history (called by `dispose()`)
- The `onUsage` callback is `await`ed — a slow callback blocks the response return

### Streaming Architecture

The `stream()` method (`src/noosphere.ts:73-124`) wraps provider streams with usage tracking:

```typescript
stream(options: ChatOptions): NoosphereStream {
  // Returns IMMEDIATELY (synchronous) — no await
  // The actual initialization happens lazily on first iteration

  let innerStream: NoosphereStream | undefined;
  let finalResult: NoosphereResult | undefined;
  let providerRef: NoosphereProvider | undefined;

  // Lazy init — runs on first for-await-of iteration:
  const ensureInit = async () => {
    if (!this.initialized) await this.init();
    if (!providerRef) {
      providerRef = this.resolveProviderForModality('llm', ...);
      if (!providerRef.stream) throw new NoosphereError(...);
      innerStream = providerRef.stream(options);
    }
  };

  // Wrapped async iterator with usage tracking:
  const wrappedIterator = {
    async *[Symbol.asyncIterator]() {
      await ensureInit();           // Init on first next()
      for await (const event of innerStream!) {
        if (event.type === 'done' && event.result) {
          finalResult = event.result;
          await trackUsage(event.result);  // Track when complete
        }
        yield event;                // Pass events through
      }
    },
  };

  return {
    [Symbol.asyncIterator]: () => wrappedIterator[Symbol.asyncIterator](),

    // result() — consume entire stream and return final result:
    result: async () => {
      if (finalResult) return finalResult;  // Already consumed
      for await (const event of wrappedIterator) {
        if (event.type === 'done') return event.result!;
        if (event.type === 'error') throw event.error;
      }
      throw new NoosphereError('Stream ended without result');
    },

    // abort() — signal cancellation:
    abort: () => innerStream?.abort(),
  };
}
```

**Stream event types:**
| Event Type | Fields | When |
|---|---|---|
| `text_delta` | `{ type, delta: string }` | Each text token |
| `thinking_delta` | `{ type, delta: string }` | Each reasoning token |
| `done` | `{ type, result: NoosphereResult }` | Stream complete |
| `error` | `{ type, error: Error }` | Stream failed |

**Note:** Streaming does NOT use `executeWithRetry()`. If the stream fails, there's no automatic retry or failover. The error is yielded as an `error` event and also tracked via `trackError()`.

### Lifecycle Management — dispose()

```typescript
async dispose(): Promise<void> {
  // 1. Call dispose() on every registered provider (if implemented):
  for (const provider of this.registry.getAllProviders()) {
    if (provider.dispose) {
      await provider.dispose();
      // Currently: no built-in provider implements dispose()
      // This is for custom providers that need cleanup
    }
  }

  // 2. Clear the model cache:
  this.registry.clearCache();

  // 3. Clear usage history:
  this.tracker.clear();

  // Note: does NOT set initialized=false
  // After dispose(), the instance is NOT reusable for new requests
}
```

---

## Error Handling

All errors are instances of `NoosphereError`:

```typescript
import { NoosphereError } from 'noosphere';

try {
  await ai.chat({ messages: [{ role: 'user', content: 'Hello' }] });
} catch (err) {
  if (err instanceof NoosphereError) {
    console.log(err.code);           // error code
    console.log(err.provider);       // which provider failed
    console.log(err.modality);       // which modality
    console.log(err.model);          // which model (if known)
    console.log(err.cause);          // underlying error
    console.log(err.isRetryable());  // whether retry might help
  }
}
```

### Error Codes

| Code | Description | Retryable | Failover |
|---|---|---|---|
| `PROVIDER_UNAVAILABLE` | Provider is down or unreachable | Yes | Yes |
| `RATE_LIMITED` | API rate limit exceeded | Yes | Yes |
| `TIMEOUT` | Request exceeded timeout | Yes | Yes |
| `GENERATION_FAILED` | Generation error (bad prompt, model issue) | Yes | No |
| `AUTH_FAILED` | Invalid or missing API key | No | No |
| `MODEL_NOT_FOUND` | Requested model doesn't exist | No | No |
| `INVALID_INPUT` | Bad parameters or unsupported operation | No | No |
| `NO_PROVIDER` | No provider available for the requested modality | No | No |

---

## Custom Providers

Extend Noosphere with your own providers:

```typescript
import type { NoosphereProvider, ModelInfo, ChatOptions, NoosphereResult, Modality } from 'noosphere';

const myProvider: NoosphereProvider = {
  // Required properties
  id: 'my-provider',
  name: 'My Custom Provider',
  modalities: ['llm', 'image'] as Modality[],
  isLocal: false,

  // Required methods
  async ping() { return true; },
  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    return [{
      id: 'my-model',
      provider: 'my-provider',
      name: 'My Model',
      modality: 'llm',
      local: false,
      cost: { price: 1.0, unit: 'per_1m_tokens' },
      capabilities: {
        contextWindow: 128000,
        maxTokens: 4096,
        supportsVision: false,
        supportsStreaming: true,
      },
    }];
  },

  // Optional methods — implement per modality
  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();
    // ... your implementation
    return {
      content: 'Response text',
      provider: 'my-provider',
      model: 'my-model',
      modality: 'llm',
      latencyMs: Date.now() - start,
      usage: { cost: 0.001, input: 100, output: 50, unit: 'tokens' },
    };
  },

  // stream?(options): NoosphereStream
  // image?(options): Promise<NoosphereResult>
  // video?(options): Promise<NoosphereResult>
  // speak?(options): Promise<NoosphereResult>
  // dispose?(): Promise<void>
};

ai.registerProvider(myProvider);
```

---

## Provider Summary

| Provider | ID | Modalities | Type | Models | Library |
|---|---|---|---|---|---|
| Pi-AI Gateway | `pi-ai` | LLM | Cloud | 246+ | `@mariozechner/pi-ai` |
| FAL.ai | `fal` | Image, Video, TTS | Cloud | 867+ | `@fal-ai/client` |
| Hugging Face | `huggingface` | LLM, Image, TTS | Cloud | Unlimited (any HF model) | `@huggingface/inference` |
| ComfyUI | `comfyui` | Image | Local | SDXL workflows | Direct HTTP |
| Piper TTS | `piper` | TTS | Local | Piper voices | Direct HTTP |
| Kokoro TTS | `kokoro` | TTS | Local | Kokoro voices | Direct HTTP |

## Requirements

- Node.js >= 18.0.0

## License

MIT
