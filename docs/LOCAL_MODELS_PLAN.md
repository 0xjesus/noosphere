# Noosphere — Local Models: Deep Implementation Plan

> **Goal:** Make noosphere the definitive library for discovering, managing, and using AI models locally — across ALL modalities (LLM, image, video, audio/music, TTS, STT, embeddings).

---

## The Vision

```typescript
import { Noosphere } from 'noosphere';

const ai = new Noosphere();
await ai.syncModels();

// Everything you can run locally — installed or available to download
const local = await ai.getModels({ local: true });
// → 200+ models: Ollama LLMs, Diffusers image models, ComfyUI workflows, Piper/Kokoro TTS, etc.

// What's installed vs what's available
const installed = await ai.getModels({ local: true, status: 'installed' });
const available = await ai.getModels({ local: true, status: 'available' });

// Install a model
await ai.installModel('ollama/deepseek-r1:14b');     // pulls from Ollama
await ai.installModel('hf/stabilityai/sd-turbo');     // downloads from HuggingFace
await ai.installModel('comfyui/flux-schnell');         // downloads checkpoint for ComfyUI

// Use it — same API as cloud models
const result = await ai.chat({ model: 'deepseek-r1:14b', messages: [...] });
const image = await ai.image({ model: 'flux-schnell', prompt: 'a cat in space' });
const audio = await ai.speak({ model: 'kokoro/af_heart', text: 'Hello world' });
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Noosphere                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Model Registry                         │   │
│  │  - Unified catalog (cloud + local)                        │   │
│  │  - Status: installed | available | downloading | running  │   │
│  │  - Per-model metadata: size, quant, VRAM req, logo        │   │
│  └────────────┬─────────────────────────────┬───────────────┘   │
│               │                             │                    │
│  ┌────────────▼──────┐         ┌───────────▼────────────┐      │
│  │   Cloud Providers  │         │   Local Providers       │      │
│  │  (existing)        │         │   (NEW)                 │      │
│  │  - pi-ai (LLM)    │         │  - ollama (LLM)         │      │
│  │  - fal (img/vid)   │         │  - diffusers (img/vid)  │      │
│  │  - huggingface     │         │  - comfyui (img/vid)    │      │
│  │                    │         │  - kokoro (TTS)         │      │
│  │                    │         │  - piper (TTS)          │      │
│  │                    │         │  - whisper (STT)        │      │
│  │                    │         │  - audiocraft (music)   │      │
│  └────────────────────┘         └────────────────────────┘      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Local Model Manager                          │   │
│  │  - Discover installed models                              │   │
│  │  - Fetch available models (web catalogs)                  │   │
│  │  - Install / uninstall / update                           │   │
│  │  - Track download progress                                │   │
│  │  - Hardware compatibility checks                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Ollama Provider (LLM — Local + Web Catalog)

**Priority: 🔴 CRITICAL — Most impactful, simplest API**

### 1.1 New file: `src/providers/ollama.ts`

**Web Catalog Fetch (available models):**
- `GET https://ollama.com/api/tags` → 33 featured models with sizes
- `GET https://ollama.com/library` scrape → 215+ model families
- Per-model detail: `GET https://ollama.com/library/{model}` → tags/sizes/quantizations

**Local Installed Fetch:**
- `GET http://localhost:11434/api/tags` → installed models with full metadata
  - family, parameter_size, quantization_level, format, size on disk
- `GET http://localhost:11434/api/ps` → currently running/loaded models

**Chat/Stream:**
- `POST http://localhost:11434/api/chat` → OpenAI-compatible chat
  - Native streaming support
  - Vision support (models with `-vision`, `llava`, `moondream`, `minicpm-v`)
  - Tool/function calling (newer models)

**Model Management:**
- `POST http://localhost:11434/api/pull` → install model (with progress streaming)
- `DELETE http://localhost:11434/api/delete` → uninstall model
- `POST http://localhost:11434/api/show` → detailed model info (template, parameters, license)

**Logo Inference (model → real provider):**
```typescript
const OLLAMA_MODEL_TO_PROVIDER: Record<string, string> = {
  'llama': 'meta', 'codellama': 'meta', 'llama2': 'meta', 'llama3': 'meta', 'llama4': 'meta',
  'gemma': 'google', 'gemma2': 'google', 'gemma3': 'google', 'gemma3n': 'google',
  'qwen': 'qwen', 'qwen2': 'qwen', 'qwen3': 'qwen', 'qwq': 'qwen',
  'deepseek': 'deepseek', 'deepcoder': 'deepseek',
  'phi': 'microsoft', 'phi3': 'microsoft', 'phi4': 'microsoft',
  'mistral': 'mistral', 'mixtral': 'mistral', 'codestral': 'mistral', 'ministral': 'mistral',
  'nemotron': 'nvidia',
  'command': 'cohere',
  'gpt-oss': 'openai',
  'starcoder': 'huggingface',
  'falcon': 'tii',
  'glm': 'zai',
  'kimi': 'moonshotai',
  'granite': 'ibm',
  'olmo': 'allenai',
  'yi': 'zeroone',
  'minimax': 'minimax',
};
```

**ModelInfo output:**
```typescript
{
  id: 'llama3.3:70b',
  name: 'Llama 3.3 70B',
  provider: 'ollama',
  modality: 'llm',
  local: true,
  status: 'installed',         // NEW FIELD
  logo: { svg: '...meta.svg', png: '...meta.png' },
  cost: { price: 0, unit: 'free' },
  localInfo: {                  // NEW FIELD
    sizeBytes: 42520413916,
    family: 'llama',
    parameterSize: '70.6B',
    quantization: 'Q4_K_M',
    format: 'gguf',
    digest: 'a6eb4748fd29...',
    modifiedAt: '2026-01-09T14:59:38Z',
    running: false,
  },
  capabilities: {
    contextWindow: 131072,
    maxTokens: 131072,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalls: true,
  },
}
```

### 1.2 Types additions (`src/types.ts`)

```typescript
type ModelStatus = 'installed' | 'available' | 'downloading' | 'running' | 'error';

interface LocalModelInfo {
  sizeBytes: number;
  family?: string;
  parameterSize?: string;       // "70.6B", "7B", "3.2B"
  quantization?: string;        // "Q4_K_M", "Q8_0", "F16"
  format?: string;              // "gguf", "safetensors", "pytorch"
  digest?: string;
  modifiedAt?: string;
  running?: boolean;
  vramRequired?: number;        // estimated VRAM in bytes
  diskPath?: string;            // where it lives on disk
}

interface ModelInstallProgress {
  modelId: string;
  status: 'pulling' | 'downloading' | 'verifying' | 'complete' | 'error';
  completedBytes: number;
  totalBytes: number;
  percent: number;
}
```

---

## Phase 2: Diffusers Provider (Image + Video — Local)

**Priority: 🟡 HIGH — Massive model ecosystem**

### 2.1 New file: `src/providers/diffusers.ts`

Diffusers is the Python library by HuggingFace that runs Stable Diffusion, FLUX, SDXL, SD3, PixArt, Kandinsky, AnimateDiff, CogVideo, etc. locally.

**Architecture:** Node.js → Python subprocess (JSON protocol over stdin/stdout)

Create a thin Python bridge script (`scripts/diffusers_bridge.py`) that:
1. Receives JSON commands over stdin
2. Loads models via `diffusers.AutoPipelineForText2Image` / etc.
3. Returns results as JSON (base64 image, file path, etc.)

**Web Catalog Fetch (available models):**
- HuggingFace API: `GET https://huggingface.co/api/models?pipeline_tag=text-to-image&sort=downloads&limit=100`
- Pipeline tags to fetch:
  - `text-to-image` → FLUX, SDXL, SD3, PixArt, Playground, etc.
  - `image-to-image` → img2img, inpainting, upscaling
  - `text-to-video` → CogVideoX, AnimateDiff, Stable Video Diffusion
  - `text-to-audio` → AudioLDM, MusicLDM, AudioCraft
- Filter by: downloads > 1000, recent activity, diffusers compatibility

**Local Installed Detection:**
- Scan `~/.cache/huggingface/hub/` for downloaded models
- Parse `model_index.json` in each to detect pipeline type
- Cross-reference with web catalog for metadata

**Supported Pipelines (146 total in diffusers, key ones):**

| Pipeline | Modality | Key Models |
|---|---|---|
| `FluxPipeline` | text-to-image | FLUX.1-dev, FLUX.1-schnell |
| `StableDiffusion3Pipeline` | text-to-image | SD 3.5 Medium/Large |
| `StableDiffusionXLPipeline` | text-to-image | SDXL, Juggernaut, RealVisXL |
| `PixArtAlphaPipeline` | text-to-image | PixArt-α, PixArt-Σ |
| `HunyuanDiTPipeline` | text-to-image | Hunyuan-DiT |
| `StableVideoDiffusionPipeline` | image-to-video | SVD, SVD-XT |
| `AnimateDiffPipeline` | text-to-video | AnimateDiff |
| `CogVideoXPipeline`* | text-to-video | CogVideoX-5B |
| `AudioLDM2Pipeline` | text-to-audio | AudioLDM 2 |
| `MusicLDMPipeline` | text-to-music | MusicLDM |
| `BarkPipeline`* | text-to-speech | Bark |

*Not in diffusers 0.29 but available in newer versions or transformers directly.

**Model Management:**
- Install: `huggingface-cli download {model_id}` or programmatic via `huggingface_hub`
- Uninstall: Delete from `~/.cache/huggingface/hub/models--{org}--{name}/`
- Size estimation: Read `config.json` → infer dtype/size → estimate VRAM

**Hardware Compatibility:**
```typescript
interface HardwareProfile {
  gpu: string;                // "NVIDIA RTX 2000 Ada"
  vramMB: number;            // 8188
  ramMB: number;
  compute: 'cuda' | 'mps' | 'cpu';
}

// Auto-detect and filter models that can run
function canRunLocally(model: LocalModelInfo, hw: HardwareProfile): boolean {
  return model.vramRequired <= hw.vramMB * 1024 * 1024;
}
```

### 2.2 Python Bridge (`scripts/diffusers_bridge.py`)

```python
#!/usr/bin/env python3
"""Noosphere ↔ Diffusers bridge. JSON-RPC over stdin/stdout."""
import sys, json, torch
from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image

class DiffusersBridge:
    def __init__(self):
        self.loaded = {}  # model_id → pipeline
    
    def generate(self, model_id, prompt, **kwargs):
        if model_id not in self.loaded:
            self.loaded[model_id] = AutoPipelineForText2Image.from_pretrained(
                model_id, torch_dtype=torch.float16
            ).to("cuda")
        pipe = self.loaded[model_id]
        image = pipe(prompt, **kwargs).images[0]
        path = f"/tmp/noosphere_{hash(prompt)}.png"
        image.save(path)
        return {"path": path, "width": image.width, "height": image.height}
```

---

## Phase 3: ComfyUI Provider (Image/Video — Workflow Engine)

**Priority: 🟡 HIGH — Most powerful local gen for advanced users**

### 3.1 Enhanced `src/providers/comfyui.ts`

**Current state:** Hardcoded workflows, no model discovery.

**Needed:**
- `GET http://localhost:8188/object_info` → all available nodes and their models
- `GET http://localhost:8188/models/{type}` → checkpoints, loras, vaes, controlnets
- Model types to discover:
  - `checkpoints/` → SD 1.5, SDXL, SD3, FLUX, Pony, etc.
  - `loras/` → LoRA adapters
  - `vae/` → VAE models
  - `controlnet/` → ControlNet models
  - `upscale_models/` → ESRGAN, Real-ESRGAN, etc.
  - `clip/` → CLIP models
  - `unet/` → UNet models (for FLUX etc.)

**Web catalog:** CivitAI API for model discovery:
- `GET https://civitai.com/api/v1/models?types=Checkpoint&sort=Highest%20Rated&limit=50`
- Includes download URLs, preview images, model metadata

---

## Phase 4: Audio & Music (Local)

**Priority: 🟢 MEDIUM**

### 4.1 Enhanced TTS (`src/providers/local-tts.ts`)

**Already have:** Piper, Kokoro basic support.

**Needed:**
- **Piper:** Fetch voice catalog from `https://huggingface.co/rhasspy/piper-voices/tree/main`
  - 30+ languages, 100+ voices
  - Show installed vs available voices
  - Install: download .onnx + .json config
- **Kokoro:** Support all voice packs
  - Detect installed voices in `~/.local/share/kokoro/`
  - Web catalog from PyPI/GitHub releases
- **Bark** (via diffusers/transformers): Multi-language TTS with emotion
  - Clone voices from audio samples
  - Music/sound effects generation
- **Chatterbox** (ResembleAI): Already cached in HF hub!
  - Zero-shot voice cloning
  - Emotion control

### 4.2 New: Music Generation (`src/providers/audiocraft.ts`)

**Meta AudioCraft family:**
- **MusicGen**: Text-to-music (small/medium/large/melody)
  - `facebook/musicgen-small` → 300M params, runs on 8GB VRAM
  - `facebook/musicgen-large` → 3.3B params, needs 16GB+
  - Melody conditioning (hum a tune → full song)
- **AudioGen**: Text-to-sound-effects
- **EnCodec**: Audio compression/tokenization

**API:**
```typescript
const music = await ai.generate({
  modality: 'music',
  model: 'musicgen-small',
  prompt: 'upbeat electronic dance music with heavy bass',
  duration: 30,  // seconds
});
// → { path: '/tmp/music_abc123.wav', duration: 30, sampleRate: 32000 }
```

### 4.3 New: Speech-to-Text (`src/providers/whisper.ts`)

**OpenAI Whisper (local):**
- Models: tiny, base, small, medium, large, large-v2, large-v3
- Already installed on this system!
- `GET https://huggingface.co/api/models?pipeline_tag=automatic-speech-recognition&sort=downloads`

**API:**
```typescript
const transcript = await ai.transcribe({
  model: 'whisper-large-v3',
  audio: '/path/to/audio.mp3',
  language: 'es',
});
// → { text: "Hola mundo", segments: [...], language: 'es' }
```

---

## Phase 5: Embeddings (Local)

**Priority: 🟢 MEDIUM**

Ollama already serves embedding models:
- `all-minilm` (23M, F16) — installed
- `bge-m3` (566M, F16) — installed
- `mxbai-embed-large` (334M, F16) — installed
- `nomic-embed-text` (137M, F16) — installed

**API:**
```typescript
const embedding = await ai.embed({
  model: 'nomic-embed-text',
  text: 'Hello world',
});
// → { vector: [0.123, -0.456, ...], dimensions: 768 }
```

---

## Phase 6: Model Manager

**Priority: 🔴 CRITICAL — Core infrastructure for all local models**

### 6.1 New file: `src/model-manager.ts`

```typescript
class ModelManager {
  // Discover all local runtimes
  async detectRuntimes(): Promise<RuntimeInfo[]>;
  // → [{ id: 'ollama', version: '0.13.4', running: true },
  //    { id: 'comfyui', version: null, running: false },
  //    { id: 'diffusers', version: '0.29.0', available: true },
  //    { id: 'whisper', version: '1.1.10', available: true }]

  // Hardware profile
  async getHardware(): Promise<HardwareProfile>;
  // → { gpu: 'NVIDIA RTX 2000 Ada', vramMB: 8188, ramMB: 32768, compute: 'cuda' }

  // Unified install/uninstall
  async install(modelId: string, options?: InstallOptions): AsyncIterable<InstallProgress>;
  async uninstall(modelId: string): Promise<void>;
  
  // Recommendations based on hardware
  async recommend(hw: HardwareProfile, modality: Modality): Promise<ModelInfo[]>;
  // → Models that fit in your VRAM, sorted by quality
}
```

### 6.2 Hardware-Aware Model Recommendations

For your setup (RTX 2000 Ada, 8GB VRAM):

| Modality | Recommended Models | VRAM Needed |
|---|---|---|
| LLM | qwen3:8b, phi4:14b (Q4), deepseek-r1:7b | 3-6 GB |
| Image | FLUX.1-schnell (FP8), SD-Turbo, SDXL-Turbo | 6-8 GB |
| Video | AnimateDiff (with SDXL), SVD (512px) | 8 GB |
| TTS | Kokoro, Piper (CPU), Bark-small | <1 GB |
| STT | Whisper medium/large | 2-5 GB |
| Music | MusicGen-small | 4 GB |
| Embeddings | nomic-embed-text, all-minilm | <1 GB |

---

## Complete Local Model Landscape

### By Runtime & Modality

| Runtime | LLM | Image | Video | TTS | STT | Music | Embeddings |
|---|---|---|---|---|---|---|---|
| **Ollama** | ✅ 215+ families | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 10+ |
| **Diffusers** | ❌ | ✅ 1000+ | ✅ 50+ | ✅ (Bark) | ❌ | ✅ (AudioLDM) | ❌ |
| **ComfyUI** | ❌ | ✅ (workflows) | ✅ (workflows) | ❌ | ❌ | ❌ | ❌ |
| **Transformers** | ✅ (overlap w/Ollama) | ✅ (overlap) | ✅ (CogVideo) | ✅ (Bark, VITS) | ✅ (Whisper) | ✅ (MusicGen) | ✅ |
| **Piper** | ❌ | ❌ | ❌ | ✅ 100+ voices | ❌ | ❌ | ❌ |
| **Kokoro** | ❌ | ❌ | ❌ | ✅ multi-voice | ❌ | ❌ | ❌ |
| **Whisper** | ❌ | ❌ | ❌ | ❌ | ✅ 9 sizes | ❌ | ❌ |

### Web Catalogs to Fetch

| Source | URL/API | What it provides |
|---|---|---|
| Ollama Library | `ollama.com/api/tags` + `/library` scrape | 215+ LLM families, all tags/sizes |
| HuggingFace Models | `huggingface.co/api/models?pipeline_tag={tag}` | 100K+ models across all modalities |
| CivitAI | `civitai.com/api/v1/models` | SD/SDXL/FLUX checkpoints, LoRAs, embeddings |
| Piper Voices | `huggingface.co/rhasspy/piper-voices` | 100+ TTS voices in 30+ languages |
| Kokoro Voices | `github.com/hexgrad/kokoro` releases | Multi-language voice packs |

---

## Implementation Order

```
Phase 1: Ollama Provider          [~2 days]  ← START HERE
  ├── 1a. Local model listing (api/tags)
  ├── 1b. Web catalog fetch (ollama.com)
  ├── 1c. Chat + stream
  ├── 1d. Model install/uninstall (pull/delete)
  └── 1e. Logo inference per model family

Phase 2: Diffusers Provider       [~3 days]
  ├── 2a. Python bridge script
  ├── 2b. HuggingFace catalog fetch by pipeline_tag
  ├── 2c. Local cache scanning
  ├── 2d. Image generation (text2img, img2img)
  └── 2e. Video generation (AnimateDiff, SVD)

Phase 3: ComfyUI Enhancement      [~2 days]
  ├── 3a. Dynamic model discovery (/object_info)
  ├── 3b. CivitAI catalog integration
  └── 3c. Workflow-based generation

Phase 4: Audio Suite              [~2 days]
  ├── 4a. Enhanced TTS (Piper catalog, Kokoro catalog)
  ├── 4b. Whisper STT provider
  ├── 4c. AudioCraft/MusicGen provider
  └── 4d. Bark multi-purpose audio

Phase 5: Embeddings               [~1 day]
  └── 5a. Ollama embeddings API support

Phase 6: Model Manager            [~2 days]
  ├── 6a. Hardware detection (GPU, VRAM, RAM)
  ├── 6b. Unified install/uninstall API
  ├── 6c. Download progress streaming
  └── 6d. Smart recommendations
```

**Total estimated: ~12 days of implementation**

---

## New Types Summary

```typescript
// New modalities
type Modality = 'llm' | 'image' | 'video' | 'tts' | 'stt' | 'music' | 'embedding';

// Model status for local models
type ModelStatus = 'installed' | 'available' | 'downloading' | 'running' | 'error';

// Local model metadata
interface LocalModelInfo {
  sizeBytes: number;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  format?: string;              // gguf, safetensors, onnx, pytorch
  digest?: string;
  modifiedAt?: string;
  running?: boolean;
  vramRequired?: number;
  ramRequired?: number;
  diskPath?: string;
  runtime: 'ollama' | 'diffusers' | 'comfyui' | 'piper' | 'kokoro' | 'whisper' | 'audiocraft';
}

// Hardware profile
interface HardwareProfile {
  gpu?: string;
  vramMB?: number;
  ramMB: number;
  compute: 'cuda' | 'mps' | 'cpu' | 'rocm';
  cudaVersion?: string;
  pythonVersion?: string;
}

// Install progress
interface InstallProgress {
  modelId: string;
  status: 'queued' | 'downloading' | 'extracting' | 'verifying' | 'complete' | 'error';
  completedBytes: number;
  totalBytes: number;
  percent: number;
  speed?: number;               // bytes/sec
  eta?: number;                 // seconds remaining
}

// Transcription result (STT)
interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

// Music generation options
interface MusicOptions extends BaseOptions {
  prompt: string;
  duration?: number;            // seconds (default 10)
  melody?: string;              // path to audio file for melody conditioning
  temperature?: number;
  topK?: number;
}
```

---

## Key Design Decisions

1. **Node.js ↔ Python bridge for diffusers/whisper/audiocraft:** These libraries are Python-only. We use a subprocess with JSON-RPC protocol. The bridge script is bundled with noosphere and auto-installed via `postinstall` if Python + torch are available.

2. **Ollama is the primary LLM local runtime:** It handles model downloading, quantization, GPU memory management, and serving. We don't reinvent this — we wrap its API.

3. **ComfyUI is optional, not required:** It's the most powerful for image/video but requires setup. Diffusers is the "batteries included" path.

4. **Hardware detection drives recommendations:** Don't show a user with 8GB VRAM a 70B model as "available" without warning them it won't fit.

5. **Web catalog caching:** Cache fetched catalogs for 24h to avoid hammering APIs. Store in `~/.cache/noosphere/catalogs/`.

6. **Progressive enhancement:** Everything degrades gracefully:
   - No Ollama? → Skip local LLM
   - No Python/torch? → Skip diffusers
   - No GPU? → CPU-only models still work (slower)
   - No internet? → Only show installed models
