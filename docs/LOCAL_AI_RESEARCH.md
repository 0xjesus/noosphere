# Local AI Model Ecosystem Research for Noosphere

> Research compiled: March 2026
> Purpose: Comprehensive guide for building a unified local AI library supporting all modalities

---

## Table of Contents

1. [Local LLM Runtimes](#1-local-llm-runtimes)
2. [Local Image Generation](#2-local-image-generation)
3. [Local Video Generation](#3-local-video-generation)
4. [Local Audio/Music Generation](#4-local-audiomusic-generation)
5. [Local Embedding Models](#5-local-embedding-models)
6. [Model Catalogs & Registries](#6-model-catalogs--registries)
7. [Hardware Requirements](#7-hardware-requirements)
8. [Unified Integration Strategy](#8-unified-integration-strategy)

---

## 1. Local LLM Runtimes

### 1.1 llama.cpp

- **Repo**: https://github.com/ggml-org/llama.cpp (97.8k+ stars)
- **Description**: C/C++ inference engine for GGUF-format LLMs. The foundational runtime that most other tools build upon.
- **HTTP Server**: Built-in `llama-server` binary
  - Default port: `http://localhost:8080`
  - OpenAI-compatible endpoints:
    - `POST /v1/chat/completions`
    - `POST /v1/completions`
    - `POST /v1/embeddings`
    - `POST /completion` (native API)
    - `POST /tokenize`, `POST /detokenize`
    - `GET /health`
    - `GET /props` (server properties)
    - `GET /slots` (KV cache slot info)
  - Supports streaming, grammar-constrained output (GBNF), multimodal (llava), speculative decoding
- **Model Format**: GGUF (quantized: Q2_K through Q8_0, F16, F32)
- **Detection**: `which llama-server` or `which llama-cli` or check for `llama.cpp` directory
- **List models**: No built-in model management; user points to GGUF files directly
- **Differs from Ollama**: llama.cpp is the raw engine; Ollama wraps it with model management, Modelfile abstractions, and a simplified API. llama.cpp gives more control (GPU layers, context size, batch size, grammar) but requires manual model file management.
- **VRAM**: Depends on model size and quantization. ~4GB for 7B Q4, ~8GB for 13B Q4, ~24GB for 70B Q4
- **Platforms**: Linux, macOS, Windows. CUDA, Metal, Vulkan, ROCm, SYCL support
- **Status**: ✅ Extremely active, updated daily

### 1.2 Ollama

- **Website**: https://ollama.com
- **Repo**: https://github.com/ollama/ollama
- **API Base**: `http://localhost:11434`
- **API Endpoints**:
  - `POST /api/generate` — text completion
  - `POST /api/chat` — chat completion
  - `POST /api/embeddings` — generate embeddings
  - `POST /api/create` — create model from Modelfile
  - `GET /api/tags` — list local models
  - `POST /api/show` — show model info
  - `POST /api/pull` — pull model from registry
  - `POST /api/push` — push model to registry
  - `DELETE /api/delete` — delete local model
  - `POST /api/copy` — copy model
  - `GET /api/ps` — list running models
  - `GET /api/version` — version info
  - **Experimental**: Image generation support added
  - **OpenAI-compatible**: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`
- **Model naming**: `model:tag` format (e.g., `llama3.2:7b`, `mistral:latest`)
- **Detection**: `which ollama` or `curl http://localhost:11434/api/version`
- **List available**: `ollama list` or `GET /api/tags`
- **List remote**: Browse https://ollama.com/library
- **VRAM**: Auto-manages GPU offloading
- **Status**: ✅ Very active, most popular local LLM runtime

### 1.3 vLLM

- **Website**: https://docs.vllm.ai
- **Repo**: https://github.com/vllm-project/vllm
- **Description**: High-throughput LLM serving with PagedAttention. Best for production/multi-user serving.
- **API Base**: `http://localhost:8000`
- **Start**: `vllm serve <model_name> --dtype auto --api-key <key>`
- **Supported APIs**:
  - `POST /v1/completions` — text completion
  - `POST /v1/chat/completions` — chat completion
  - `POST /v1/embeddings` — embeddings
  - `POST /v1/responses` — responses API
  - `POST /v1/audio/transcriptions` — ASR
  - `POST /v1/audio/translations` — translation
  - `GET /v1/models` — list models
  - `POST /tokenize`, `POST /detokenize` — tokenization
  - `POST /pooling` — pooling models
  - `POST /classify` — classification
  - `POST /score` — scoring
  - `POST /rerank`, `/v1/rerank`, `/v2/rerank` — re-ranking (Jina/Cohere compatible)
  - `/v1/realtime` — WebSocket realtime API
- **Model format**: HuggingFace transformers (FP16, BF16, AWQ, GPTQ, FP8)
- **Detection**: `python -c "import vllm"` or `which vllm`
- **Key feature**: Dynamic batching, continuous batching, tensor parallelism for multi-GPU
- **VRAM**: Needs full model in VRAM. 7B FP16 ≈ 14GB, 13B ≈ 26GB. AWQ/GPTQ reduces by ~4x
- **Platforms**: Linux primarily (CUDA). ROCm experimental. No macOS Metal support.
- **Status**: ✅ Very active, industry standard for LLM serving

### 1.4 LM Studio

- **Website**: https://lmstudio.ai
- **Description**: Desktop app + headless daemon (`llmster`) for running LLMs locally with GUI and API
- **API Base**: `http://localhost:1234`
- **APIs**:
  - **OpenAI-compatible**: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`
  - **Anthropic-compatible**: `/v1/messages`
  - **LM Studio REST API**: `/api/v1/chat` (stateful chats, MCP support)
  - TypeScript SDK: `@lmstudio/sdk`
  - Python SDK: `lmstudio`
- **CLI**: `lms` command
  - `lms daemon up` — start headless daemon
  - `lms get <model>` — download model
  - `lms server start` — start API server
  - `lms chat` — interactive chat
  - `lms ls` — list downloaded models
- **Model format**: GGUF (via llama.cpp), MLX (on Apple Silicon)
- **Model catalog**: Built-in model discovery from HuggingFace
- **Detection**: `which lms` or check for LM Studio app
- **Features**: Tool calling, structured output (JSON schema), MCP integration, model management
- **Headless**: `llmster` daemon for server/CI deployments
- **VRAM**: Same as llama.cpp (GGUF quantized models)
- **Status**: ✅ Very active, popular desktop solution

### 1.5 LocalAI

- **Website**: https://localai.io
- **Repo**: https://github.com/mudler/LocalAI
- **Description**: OpenAI-compatible local API server supporting multiple backends and modalities
- **API Base**: `http://localhost:8080`
- **APIs**: Full OpenAI API compatibility:
  - `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`
  - `/v1/images/generations` — image generation (Stable Diffusion)
  - `/v1/audio/transcriptions` — Whisper STT
  - `/v1/audio/speech` — TTS
  - `/v1/audio/generations` — sound/music generation
  - Video generation
  - GPT Vision (multimodal)
  - OpenAI Functions / tool calling
  - Realtime API (WebSocket)
  - Reranker, object detection, classification
  - MCP support, agents
  - P2P distributed inference
- **Supported backends**: llama.cpp, transformers, diffusers, whisper, bark, piper, and more
- **Model Gallery**: Pre-configured model gallery at https://localai.io/models/
- **Detection**: `docker ps | grep localai` or `curl http://localhost:8080/v1/models`
- **Deployment**: Docker-first (single container for all modalities)
- **Status**: ✅ Active, excellent for multi-modal unified API

### 1.6 Jan.ai

- **Website**: https://jan.ai
- **Repo**: https://github.com/janhq/jan
- **Description**: Desktop ChatGPT alternative with local model management
- **API Base**: `http://localhost:1337`
- **APIs**:
  - OpenAI-compatible: `/v1/chat/completions`, `/v1/models`
  - Model management endpoints
- **Engine**: Uses llama.cpp (via Nitro engine) and TensorRT-LLM
- **Model format**: GGUF
- **Detection**: Check for Jan app or `curl http://localhost:1337/v1/models`
- **Features**: Model hub, conversation management, extensions system
- **Status**: ✅ Active development

### 1.7 GPT4All

- **Website**: https://gpt4all.io
- **Repo**: https://github.com/nomic-ai/gpt4all
- **Description**: Desktop app + Python SDK for local LLMs, by Nomic AI
- **Python API**:
  ```python
  from gpt4all import GPT4All
  model = GPT4All("Meta-Llama-3-8B-Instruct.Q4_0.gguf")
  with model.chat_session():
      print(model.generate("Hello!", max_tokens=1024))
  ```
- **Embeddings**:
  ```python
  from nomic import embed
  embeddings = embed.text(["text"], inference_mode="local")['embeddings']
  ```
- **Model catalog** (built-in):
  - Meta-Llama-3-8B-Instruct.Q4_0.gguf (4.66GB, 8GB RAM)
  - Nous-Hermes-2-Mistral-7B-DPO.Q4_0.gguf (4.11GB, 8GB RAM)
  - Phi-3-mini-4k-instruct.Q4_0.gguf (2.18GB, 4GB RAM)
  - orca-mini-3b-gguf2-q4_0.gguf (1.98GB, 4GB RAM)
  - gpt4all-13b-snoozy-q4_0.gguf (7.37GB, 16GB RAM)
- **Embedding models**: Nomic Embed (768-dim, GGUF, 2048+ context)
- **API server**: Includes OpenAI-compatible server
- **Detection**: `python -c "from gpt4all import GPT4All"`
- **List models**: `GPT4All.list_models()`
- **Status**: ✅ Active, good for simple local inference

### 1.8 Llamafile

- **Website**: https://github.com/mozilla-ai/llamafile
- **Description**: Single-file executable LLM runner. Combines llama.cpp + Cosmopolitan Libc for cross-platform binaries.
- **Usage**:
  ```bash
  chmod +x model.llamafile
  ./model.llamafile  # Opens browser UI + API server
  ```
- **API**: Same as llama.cpp server (OpenAI-compatible endpoints)
- **Key feature**: Zero-install, single file contains model + runtime
- **Platforms**: macOS, Linux, Windows, BSD — single binary runs everywhere
- **Detection**: Check for `.llamafile` files or `which llamafile`
- **License**: Apache 2.0
- **Status**: ✅ Active (now maintained by Mozilla AI)

### 1.9 MLX / mlx-lm (Apple Silicon)

- **Repo**: https://github.com/ml-explore/mlx-lm
- **Description**: Apple's framework for ML on Apple Silicon. `mlx-lm` is the LLM package.
- **Install**: `pip install mlx-lm`
- **Python API**:
  ```python
  from mlx_lm import load, generate, stream_generate
  model, tokenizer = load("mlx-community/Mistral-7B-Instruct-v0.3-4bit")
  text = generate(model, tokenizer, prompt="Hello", verbose=True)
  ```
- **CLI**:
  - `mlx_lm.generate --model <model> --prompt "Hello"`
  - `mlx_lm.chat` — interactive chat REPL
  - `mlx_lm.convert --model <hf_model> -q` — quantize and convert
- **Server**: `mlx_lm.server` provides OpenAI-compatible API
- **Model format**: MLX format (converted from HuggingFace). Thousands on [mlx-community](https://huggingface.co/mlx-community)
- **Features**: Quantization (4-bit, 8-bit), LoRA fine-tuning, distributed inference, prompt caching, rotating KV cache
- **Detection**: `python -c "import mlx_lm"` (only works on Apple Silicon)
- **VRAM**: Uses unified memory. 7B-4bit ≈ 4GB, 70B-4bit ≈ 40GB
- **Status**: ✅ Very active, Apple-maintained

### 1.10 ExLlamaV2 → ExLlamaV3

- **Repo**: https://github.com/turboderp-org/exllamav2 (archived; successor: [ExLlamaV3](https://github.com/turboderp-org/exllamav3))
- **Description**: Fastest local LLM inference library for NVIDIA GPUs
- **Quantization format**: EXL2 (variable bits-per-weight, 2-8 bpw) and EXL3
- **Python API**:
  ```python
  from exllamav2 import ExLlamaV2, ExLlamaV2Config
  # Dynamic generator with batching, caching, speculative decoding
  output = generator.generate(prompt="Hello", max_new_tokens=200)
  ```
- **Server**: Use TabbyAPI (see below) — the official server
- **Performance** (single token generation):
  - 7B EXL2 4.0bpw: ~211 t/s on 4090
  - 70B EXL2 2.5bpw: ~38 t/s on 4090
  - 1.1B EXL2 4.0bpw: ~700 t/s on 4090
- **Supports**: Paged attention (Flash Attention 2.5.7+), Q4 KV cache, speculative decoding
- **Detection**: `python -c "from exllamav2 import ExLlamaV2"`
- **VRAM**: Very efficient. 70B at 2.5bpw fits in 24GB
- **Platforms**: NVIDIA GPUs only (CUDA)
- **Status**: ⚠️ ExLlamaV2 archived; ExLlamaV3 is the active successor

### 1.11 TabbyAPI

- **Repo**: https://github.com/theroyallab/tabbyAPI
- **Description**: Official API server for ExLlamaV2/V3. FastAPI-based, OpenAI-compatible.
- **API Base**: Configurable (default `http://localhost:5000`)
- **APIs**:
  - OpenAI-compatible: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`
  - Model loading/unloading endpoints
  - HuggingFace model downloading
  - Tool/function calling
- **Supported model types**: EXL2, EXL3, GPTQ, FP16
- **Features**: Continuous batching, paged attention, JSON schema + regex + EBNF, multi-LoRA, speculative decoding, Jinja2 chat templates, HF model downloading
- **Sister project**: [YALS](https://github.com/theroyallab/YALS) for GGUF models
- **Detection**: Check for running TabbyAPI process or API endpoint
- **Status**: ✅ Active

### 1.12 KoboldCpp

- **Repo**: https://github.com/LostRuins/koboldcpp
- **Description**: All-in-one AI runtime. Single executable, zero install. Built on llama.cpp.
- **API Base**: `http://localhost:5001`
- **APIs** (multi-protocol):
  - KoboldAI API
  - OpenAI-compatible API
  - Ollama-compatible API
  - A1111/Forge-compatible API (for image gen)
  - ComfyUI-compatible API
  - Whisper Transcribe API
  - XTTS-compatible API
  - OpenAI Speech API
- **Multi-modal features**:
  - LLM text generation (all GGUF/GGML models)
  - Image generation (SD 1.5, SDXL, SD3, Flux, Qwen Image, Z-Image, Klein)
  - Video generation (WAN 2.2)
  - Speech-to-text (Whisper)
  - Text-to-speech (Qwen3TTS, Kokoro, OuteTTS, Parler, Dia)
  - Music generation (ACE Step 1.5)
  - Image recognition/vision
  - MCP server + tool calling
- **UI**: Bundled KoboldAI Lite (chat, adventure, instruct, storywriter modes)
- **Detection**: `which koboldcpp` or check for running process
- **Platforms**: Windows, macOS (ARM64), Linux. Colab, Docker, Android (Termux)
- **Status**: ✅ Very active, impressively comprehensive single-file solution

### 1.13 Other Notable Runtimes

| Runtime | Description | URL |
|---------|-------------|-----|
| **Aphrodite Engine** | Production LLM serving (fork of vLLM) | https://github.com/PygmalionAI/Aphrodite-engine |
| **text-generation-inference (TGI)** | HuggingFace's production server | https://github.com/huggingface/text-generation-inference |
| **TensorRT-LLM** | NVIDIA optimized inference | https://github.com/NVIDIA/TensorRT-LLM |
| **MLC LLM** | Universal LLM deployment | https://github.com/mlc-ai/mlc-llm |
| **PowerInfer** | CPU+GPU sparse inference | https://github.com/SJTU-IPADS/PowerInfer |
| **Candle** | Rust ML framework | https://github.com/huggingface/candle |
| **Ollama.js** | Run models in browser/Node | Via WebGPU |
| **WebLLM** | In-browser LLM via WebGPU | https://github.com/mlc-ai/web-llm |
| **llm.c** | Karpathy's C training/inference | https://github.com/karpathy/llm.c |
| **SGLang** | Fast serving with RadixAttention | https://github.com/sgl-project/sglang |
| **Nitro** | Jan.ai's C++ inference engine | https://github.com/janhq/nitro |

---

## 2. Local Image Generation

### 2.1 ComfyUI

- **Repo**: https://github.com/Comfy-Org/ComfyUI
- **Website**: https://www.comfy.org
- **API Base**: `http://localhost:8188`
- **API Endpoints**:
  - `POST /prompt` — queue a workflow for execution
  - `GET /history` — get generation history
  - `GET /queue` — get queue status
  - `GET /view?filename=<name>` — view generated image
  - `GET /object_info` — list all available nodes
  - `GET /system_stats` — system information
  - `POST /upload/image` — upload image
  - `POST /upload/mask` — upload mask
  - `WS /ws` — WebSocket for real-time progress
  - `GET /embeddings` — list embeddings
  - `GET /extensions` — list extensions
- **Workflow API**: Submit JSON workflows programmatically via `/prompt`. Each workflow is a graph of nodes.
- **Supported models (2025-2026)**:
  - **Image**: SD 1.x, SD 2.x, SDXL, SD3/SD3.5, FLUX (1, 2), Stable Cascade, PixArt Alpha/Sigma, AuraFlow, HunyuanDiT, HunyuanImage 2.1, Lumina Image 2.0, HiDream, Qwen Image, Z-Image
  - **Image Editing**: OmniGen 2, Flux Kontext, HiDream E1.1, Qwen Image Edit
  - **Video**: SVD, Mochi, LTX-Video, HunyuanVideo (1.0, 1.5), Wan 2.1/2.2
  - **Audio**: Stable Audio, ACE Step
  - **3D**: Hunyuan3D 2.0
- **Features**: Node-based workflow editor, smart VRAM management (runs on 1GB+), LoRA/hypernetwork/embedding support
- **Detection**: Check for `main.py` or `comfyui` process, or `curl http://localhost:8188/system_stats`
- **Platforms**: Windows, Linux, macOS (NVIDIA, AMD, Intel, Apple Silicon, Ascend)
- **Status**: ✅ Extremely active, dominant image gen UI

### 2.2 Automatic1111 / Stable Diffusion WebUI

- **Repo**: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- **API Base**: `http://localhost:7860` (launch with `--api` flag)
- **API Endpoints**:
  - `POST /sdapi/v1/txt2img` — text to image
  - `POST /sdapi/v1/img2img` — image to image
  - `POST /sdapi/v1/extra-single-image` — upscale single image
  - `POST /sdapi/v1/extra-batch-images` — upscale batch
  - `GET /sdapi/v1/sd-models` — list available models
  - `GET /sdapi/v1/samplers` — list samplers
  - `GET /sdapi/v1/options` — get/set settings
  - `POST /sdapi/v1/options` — update settings (change model, CLIP skip, etc.)
  - `POST /sdapi/v1/interrogate` — CLIP interrogate
  - `GET /sdapi/v1/progress` — generation progress
  - `POST /sdapi/v1/interrupt` — interrupt generation
  - Full Swagger docs at `/docs`
- **Response format**: Images returned as base64-encoded strings in JSON
- **Features**: ControlNet, LoRA, textual inversion, inpainting, outpainting, upscaling
- **Detection**: `curl http://localhost:7860/sdapi/v1/sd-models`
- **Status**: ⚠️ Less active (Forge fork more popular now: https://github.com/lllyasviel/stable-diffusion-webui-forge)

### 2.3 Fooocus

- **Repo**: https://github.com/lllyasviel/Fooocus
- **Description**: Simplified Stable Diffusion interface focused on quality defaults
- **API**: No official REST API. Community forks add API support (e.g., Fooocus-API: https://github.com/mrhan1993/Fooocus-API)
  - Fooocus-API endpoints: `/v1/generation/text-to-image`, `/v1/generation/image-to-image`, etc.
- **Status**: ⚠️ Maintenance mode; author now works on Forge

### 2.4 InvokeAI

- **Website**: https://invoke.ai
- **Repo**: https://github.com/invoke-ai/InvokeAI
- **Description**: Professional creative engine with node-based workflow system
- **API**: Full REST API + WebSocket
  - Swagger docs available at `/docs` when running
  - Session-based generation pipeline
  - Node/workflow API for programmatic access
- **Features**: Unified Canvas, workflow/node editor, board/gallery management, ControlNet, LoRA
- **Installation**: Launcher-based installer
- **Status**: ✅ Active, commercially-oriented

### 2.5 SwarmUI

- **Repo**: https://github.com/mcmonkeyprojects/SwarmUI
- **Description**: Modular Stable Diffusion web UI with multi-backend support
- **API**: REST API available, WebSocket for real-time
- **Backends**: ComfyUI (primary), Auto1111, direct diffusers
- **Status**: ✅ Active

### 2.6 Stable Diffusion via diffusers (Programmatic)

- **Library**: https://github.com/huggingface/diffusers
- **Install**: `pip install diffusers`
- **Usage**:
  ```python
  from diffusers import StableDiffusionPipeline, FluxPipeline, StableDiffusion3Pipeline
  
  # SD 1.5
  pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5")
  image = pipe("a photo of a cat").images[0]
  
  # FLUX
  pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-dev")
  image = pipe("a photo of a cat").images[0]
  
  # SD3.5
  pipe = StableDiffusion3Pipeline.from_pretrained("stabilityai/stable-diffusion-3.5-large")
  image = pipe("a photo of a cat").images[0]
  ```
- **Supports all major models**: SD 1.x/2.x/XL/3.x, FLUX, PixArt, Playground, Kolors, Wan, CogVideoX, etc.
- **Detection**: `python -c "import diffusers"`
- **Status**: ✅ Very active, canonical Python library for diffusion models

### 2.7 FLUX Models (Local Availability)

| Model | Parameters | License | VRAM (FP16) | VRAM (Quantized) | Notes |
|-------|-----------|---------|-------------|-------------------|-------|
| FLUX.1-schnell | 12B | Apache 2.0 | ~24GB | ~8GB (NF4) | Fast (1-4 steps), open |
| FLUX.1-dev | 12B | Non-commercial | ~24GB | ~8GB (NF4) | High quality, guidance distilled |
| FLUX.1-pro | 12B | API only | N/A | N/A | Not available locally (API only) |
| FLUX.2 | — | — | — | — | Announced, available in ComfyUI |
| FLUX Kontext | — | — | — | — | Image editing model |

- Available via: ComfyUI, diffusers, Forge, KoboldCpp
- Quantized versions (NF4, GGUF) available on HuggingFace for lower VRAM

### 2.8 SD3.5 (Local Availability)

| Model | Parameters | License | VRAM |
|-------|-----------|---------|------|
| SD3.5-Large | 8B | Stability Community | ~18GB FP16 |
| SD3.5-Large-Turbo | 8B | Stability Community | ~18GB FP16 |
| SD3.5-Medium | 2.5B | Stability Community | ~8GB FP16 |

- Available via: ComfyUI, diffusers, Forge

### 2.9 Other Local Image Models

| Model | Source | VRAM | Notes |
|-------|--------|------|-------|
| **Kolors** | Kwai (Kuaishou) | ~16GB | Chinese text-to-image, diffusers support |
| **PixArt-α/Σ** | PixArt | ~12GB | Fast DiT-based, in ComfyUI + diffusers |
| **Playground v2.5** | Playground AI | ~16GB | SDXL-based, high aesthetic quality |
| **HunyuanDiT** | Tencent | ~16GB | Chinese+English, in ComfyUI |
| **AuraFlow** | Fal.ai | ~12GB | Open FLUX alternative |
| **HiDream** | HiDream | ~16GB | In ComfyUI |
| **Qwen Image** | Alibaba | ~16GB | In ComfyUI + KoboldCpp |
| **Lumina Image 2.0** | — | ~16GB | In ComfyUI |

### 2.10 State of Local Image Quality (2025-2026)

Local image generation has **reached parity with Midjourney/DALL-E 3** for most use cases:
- **FLUX.1-dev** produces images comparable to MJ v6 quality
- **SD3.5-Large** competitive with DALL-E 3
- **Custom LoRAs** on CivitAI enable style-specific results that surpass commercial APIs
- **SDXL + fine-tunes** (e.g., Juggernaut, RealVisXL) excellent for photorealistic
- **FLUX + LoRA training** is the current state-of-the-art for local custom generation
- Main gap: FLUX Pro and Midjourney v7 still slightly ahead in prompt adherence and coherence

### 2.11 CivitAI API

- **Base URL**: `https://civitai.com/api/v1`
- **Endpoints**:
  - `GET /models` — search/list models
    - Query params: `limit`, `page`, `query`, `tag`, `types` (Checkpoint, TextualInversion, LORA, etc.)
    - Returns: model info, versions, files, stats, images
  - `GET /models/:id` — get specific model
  - `GET /model-versions/:id` — get specific version
  - `GET /model-versions/by-hash/:hash` — find by hash (AutoV2, SHA256, CRC32, BLAKE3)
  - `GET /images` — browse images
  - `GET /creators` — list creators
  - `GET /tags` — list tags
  - Download: `GET /api/download/models/:versionId`
- **Model types**: Checkpoint, TextualInversion, Hypernetwork, AestheticGradient, LORA, LoCon, DoRA, Controlnet, Poses, Wildcards, Workflows, VAE, MotionModule
- **Authentication**: API key via `Authorization: Bearer <key>` header
- **No rate limit documentation** publicly available; be respectful
- **Status**: ✅ Active, largest SD model repository

---

## 3. Local Video Generation

### 3.1 CogVideoX (Zhipu AI / THUDM)

- **Repo**: https://github.com/THUDM/CogVideo
- **Models**: CogVideoX-2B, CogVideoX-5B, CogVideoX1.5-5B
- **Run locally**: Via diffusers or ComfyUI
  ```python
  from diffusers import CogVideoXPipeline
  pipe = CogVideoXPipeline.from_pretrained("THUDM/CogVideoX-5b")
  video = pipe("A cat walking", num_frames=49).frames[0]
  ```
- **VRAM**: 5B model ≈ 18-24GB (FP16), ~12GB with quantization
- **Features**: T2V, I2V; 6-second clips at 480p-720p
- **Status**: ✅ Active

### 3.2 Wan 2.1 / 2.2 (Alibaba)

- **Repo**: https://github.com/Wan-Video/Wan2.1
- **Models**:
  - T2V-1.3B (8.19GB VRAM! — consumer GPU friendly)
  - T2V-14B (high quality, needs ~40GB+)
  - I2V models
  - VACE (video creation & editing)
  - FLF2V (first-last-frame to video)
- **Run locally**: Direct Python, diffusers, ComfyUI (native support)
  ```python
  # Via diffusers
  from diffusers import WanPipeline
  pipe = WanPipeline.from_pretrained("Wan-AI/Wan2.1-T2V-1.3B")
  ```
- **Features**: T2V, I2V, video editing (VACE), text in video (Chinese+English), V2A
- **VRAM**: 1.3B ≈ 8.19GB, 14B ≈ 40GB+
- **Status**: ✅ Very active, best open video model as of early 2026

### 3.3 HunyuanVideo (Tencent)

- **Repo**: https://github.com/Tencent-Hunyuan/HunyuanVideo
- **Models**: HunyuanVideo (base), HunyuanVideo-1.5, HunyuanVideo-I2V, HunyuanVideo-Avatar
- **Run locally**: Direct Python, diffusers, ComfyUI
  ```python
  from diffusers import HunyuanVideoPipeline
  pipe = HunyuanVideoPipeline.from_pretrained("tencent/HunyuanVideo")
  ```
- **Features**: T2V, I2V, avatar animation (audio-driven), custom video generation
- **VRAM**: ~40GB+ FP16, FP8 weights available (~24GB)
- **Status**: ✅ Very active

### 3.4 Mochi (Genmo)

- **Repo**: https://github.com/genmo/mochi
- **Description**: High-quality open video generation model
- **Run locally**: Via diffusers, ComfyUI
- **VRAM**: ~24GB+
- **Status**: ✅ Active

### 3.5 LTX-Video (Lightricks)

- **Repo**: https://github.com/Lightricks/LTX-Video
- **Description**: Fast video generation model
- **Run locally**: Via diffusers, ComfyUI
- **Features**: Real-time capable on high-end GPUs
- **VRAM**: ~12-16GB
- **Status**: ✅ Active

### 3.6 Stable Video Diffusion (SVD)

- **Source**: Stability AI
- **Models**: SVD, SVD-XT (25 frames)
- **Run locally**: Via diffusers, ComfyUI
- **VRAM**: ~16GB
- **Status**: ⚠️ Older, superseded by newer models

### 3.7 AnimateDiff

- **Repo**: https://github.com/guoyww/AnimateDiff
- **Description**: Motion modules that add animation to SD/SDXL images
- **Run locally**: ComfyUI (most popular), A1111 extension
- **VRAM**: Base model + ~2GB for motion module
- **Status**: ⚠️ Still used but newer models preferred

### 3.8 Open-Sora

- **Repo**: https://github.com/hpcaitech/Open-Sora
- **Description**: Open reproduction of Sora-like video generation
- **Models**: Open-Sora 1.0, 1.1, 1.2
- **VRAM**: ~24GB+
- **Status**: ✅ Active research project

### 3.9 Other Video Models

| Model | Source | Notes |
|-------|--------|-------|
| **Latte** | Monash/Shanghai AI Lab | DiT-based video |
| **ModelScope Text2Video** | Alibaba | Early open T2V |
| **Pyramid Flow** | — | Efficient video diffusion |
| **Allegro** | Rhymes AI | Open T2V |

---

## 4. Local Audio/Music Generation

### 4.1 AudioCraft / MusicGen (Meta)

- **Repo**: https://github.com/facebookresearch/audiocraft
- **Install**: `pip install audiocraft`
- **Models**:
  - **MusicGen**: Text-to-music (small/medium/large/melody variants)
  - **AudioGen**: Text-to-sound effects
  - **EnCodec**: Audio codec/tokenizer
  - **Multi Band Diffusion**: Enhanced audio decoder
  - **MAGNeT**: Non-autoregressive music/audio
  - **MusicGen Style**: Style-conditioned music
  - **JASCO**: Chord/melody/drum conditioned music
- **Python API**:
  ```python
  from audiocraft.models import MusicGen
  model = MusicGen.get_pretrained('facebook/musicgen-medium')
  model.set_generation_params(duration=30)
  wav = model.generate(["happy rock song"])
  ```
- **VRAM**: Small ≈ 4GB, Medium ≈ 8GB, Large ≈ 16GB
- **Detection**: `python -c "from audiocraft.models import MusicGen"`
- **Status**: ✅ Active, best open music generation

### 4.2 Bark (Suno)

- **Repo**: https://github.com/suno-ai/bark
- **License**: MIT (commercial use OK)
- **Description**: Text-to-audio model. Generates speech, music, sound effects, nonverbal sounds.
- **Python API**:
  ```python
  from bark import generate_audio, SAMPLE_RATE, preload_models
  preload_models()
  audio = generate_audio("Hello, my name is Suno. [laughs]")
  ```
- **Features**: Multilingual, voice presets, laughing/sighing/crying, music generation
- **VRAM**: ~4-8GB (small model available for low VRAM)
- **Status**: ⚠️ No longer actively developed (Suno focused on commercial product)

### 4.3 Stable Audio Open

- **Source**: Stability AI
- **Repo**: https://huggingface.co/stabilityai/stable-audio-open-1.0
- **Description**: Text-to-audio/music generation
- **Run locally**: Via diffusers, ComfyUI
  ```python
  from diffusers import StableAudioPipeline
  pipe = StableAudioPipeline.from_pretrained("stabilityai/stable-audio-open-1.0")
  audio = pipe("ambient forest sounds", audio_length_in_s=30.0).audios[0]
  ```
- **VRAM**: ~8GB
- **Status**: ✅ Available, limited updates

### 4.4 ACE Step

- **Description**: Music generation model
- **Run locally**: ComfyUI (native support), KoboldCpp (ACE Step 1.5)
- **Status**: ✅ Newer, growing adoption

### 4.5 MusicLDM

- **Run locally**: Via diffusers pipeline
  ```python
  from diffusers import MusicLDMPipeline
  pipe = MusicLDMPipeline.from_pretrained("ucsd-reach/musicldm")
  audio = pipe("funky electronic beat").audios[0]
  ```
- **VRAM**: ~8GB
- **Status**: ⚠️ Research, limited updates

### 4.6 Riffusion

- **Repo**: https://github.com/riffusion/riffusion
- **Description**: Generates music via spectrogram diffusion (fine-tuned SD)
- **VRAM**: ~4-8GB
- **Status**: ⚠️ Novel approach but limited practical use

### 4.7 Text-to-Speech (TTS) Models

#### XTTS v2 (Coqui TTS)
- **Repo**: https://github.com/coqui-ai/TTS
- **Install**: `pip install TTS`
- **Features**: Voice cloning with 6-second reference, multilingual (17 languages)
- **API**: Python API + CLI + optional server
  ```python
  from TTS.api import TTS
  tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
  tts.tts_to_file(text="Hello", speaker_wav="reference.wav", language="en", file_path="output.wav")
  ```
- **VRAM**: ~4GB
- **Status**: ⚠️ Coqui (company) shut down; community forks continue

#### Fish Speech
- **Repo**: https://github.com/fishaudio/fish-speech
- **Description**: Fast, high-quality TTS with voice cloning
- **Features**: Zero-shot voice cloning, streaming, multiple languages
- **VRAM**: ~2-4GB
- **Status**: ✅ Active

#### F5-TTS
- **Repo**: https://github.com/SWivid/F5-TTS
- **Description**: Zero-shot text-to-speech with flow matching
- **Features**: Voice cloning, high quality, fast inference
- **VRAM**: ~4GB
- **Status**: ✅ Active, excellent quality

#### Parler-TTS
- **Repo**: https://github.com/huggingface/parler-tts
- **Description**: Describe the voice you want in natural language
- **Usage**:
  ```python
  from parler_tts import ParlerTTSForConditionalGeneration
  model = ParlerTTSForConditionalGeneration.from_pretrained("parler-tts/parler-tts-large-v1")
  ```
- **VRAM**: ~4-8GB
- **Status**: ✅ Active (HuggingFace maintained)

#### Kokoro TTS
- **Description**: High-quality lightweight TTS
- **Run locally**: Standalone, KoboldCpp integration
- **Status**: ✅ Active, very popular

#### Dia (Nari Labs)
- **Description**: Dialogue-focused TTS with multiple speakers
- **Status**: ✅ New, integrated into KoboldCpp

### 4.8 Speech-to-Text (STT)

#### Whisper (OpenAI)
- **Repo**: https://github.com/openai/whisper
- **Install**: `pip install openai-whisper`
- **Models**: tiny, base, small, medium, large, large-v2, large-v3
- **VRAM**: tiny ≈ 1GB, large-v3 ≈ 10GB
- **Status**: ✅ Standard

#### Faster-Whisper
- **Repo**: https://github.com/SYSTRAN/faster-whisper
- **Description**: CTranslate2-based, 4x faster than OpenAI Whisper
- **Install**: `pip install faster-whisper`
  ```python
  from faster_whisper import WhisperModel
  model = WhisperModel("large-v3", device="cuda", compute_type="float16")
  segments, info = model.transcribe("audio.mp3")
  ```
- **Status**: ✅ Very popular

#### WhisperX
- **Repo**: https://github.com/m-bain/whisperX
- **Description**: Whisper + word-level timestamps + speaker diarization
- **Features**: Forced alignment, VAD, speaker diarization
- **Status**: ✅ Active

#### Insanely-Fast-Whisper
- **Repo**: https://github.com/Vaibhavs10/insanely-fast-whisper
- **Description**: Uses Flash Attention 2 + batched inference for extreme speed
- **Status**: ✅ Active

---

## 5. Local Embedding Models

### 5.1 Sentence-Transformers

- **Repo**: https://github.com/UKPLab/sentence-transformers
- **Install**: `pip install sentence-transformers`
- **Key models**:
  | Model | Dimensions | Max Tokens | Size |
  |-------|-----------|------------|------|
  | all-MiniLM-L6-v2 | 384 | 256 | 80MB |
  | all-mpnet-base-v2 | 768 | 384 | 420MB |
  | bge-large-en-v1.5 | 1024 | 512 | 1.3GB |
  | gte-large-en-v1.5 | 1024 | 8192 | 1.6GB |
  | nomic-embed-text-v1.5 | 768 | 8192 | 550MB |
  | mxbai-embed-large-v1 | 1024 | 512 | 1.3GB |
  | e5-mistral-7b-instruct | 4096 | 32768 | 14GB |
  | jina-embeddings-v3 | 1024 | 8192 | 570MB |
- **Usage**:
  ```python
  from sentence_transformers import SentenceTransformer
  model = SentenceTransformer("all-MiniLM-L6-v2")
  embeddings = model.encode(["Hello", "World"])
  ```
- **VRAM/RAM**: Tiny models run on CPU. Larger ones benefit from GPU.
- **Status**: ✅ Standard library

### 5.2 ONNX Runtime

- **Install**: `pip install onnxruntime` (CPU) or `pip install onnxruntime-gpu`
- **Usage**: Convert models to ONNX for 2-4x faster inference
- **Key benefit**: CPU-optimized inference, quantized models
- **Supported**: Most sentence-transformers can be exported to ONNX
- **Status**: ✅ Production-ready

### 5.3 FastEmbed (Qdrant)

- **Repo**: https://github.com/qdrant/fastembed
- **Install**: `pip install fastembed`
- **Description**: Lightweight, fast embedding library using ONNX Runtime
- **Usage**:
  ```python
  from fastembed import TextEmbedding
  model = TextEmbedding("BAAI/bge-small-en-v1.5")
  embeddings = list(model.embed(["Hello", "World"]))
  ```
- **Features**: Automatic ONNX model download, quantized models, batch processing
- **Supports**: Text, image (CLIP), sparse embeddings, late interaction (ColBERT)
- **Status**: ✅ Active, great for production

### 5.4 Embedding via LLM Runtimes

Most LLM runtimes also support embeddings:
- **Ollama**: `POST /api/embeddings` with models like `nomic-embed-text`, `mxbai-embed-large`
- **vLLM**: `POST /v1/embeddings`
- **llama.cpp**: `POST /v1/embeddings` (with embedding models in GGUF)
- **LM Studio**: `POST /v1/embeddings`
- **LocalAI**: `POST /v1/embeddings`

---

## 6. Model Catalogs & Registries

### 6.1 HuggingFace Hub API

- **Base URL**: `https://huggingface.co/api`
- **OpenAPI spec**: https://huggingface.co/.well-known/openapi.json
- **Key endpoints**:
  - `GET /api/models` — list/search models
    - Params: `search`, `author`, `filter`, `sort`, `direction`, `limit`, `pipeline_tag`, `library`
    - Pipeline tags: `text-generation`, `text-to-image`, `text-to-video`, `text-to-audio`, `text-to-speech`, `automatic-speech-recognition`, `feature-extraction`, `image-classification`, `object-detection`, `text-classification`, `token-classification`, `translation`, `summarization`, `fill-mask`, `sentence-similarity`, `audio-classification`, `image-to-text`, `image-segmentation`, `depth-estimation`, etc.
  - `GET /api/models/{repo_id}` — model info
  - `GET /api/models/{repo_id}/tree/{revision}` — file listing
  - `GET /{repo_id}/resolve/{revision}/{filename}` — download file
  - `GET /api/datasets` — list datasets
  - `GET /api/spaces` — list spaces
- **Python client**: `huggingface_hub`
  ```python
  from huggingface_hub import HfApi
  api = HfApi()
  models = api.list_models(pipeline_tag="text-to-image", sort="downloads", limit=10)
  ```
- **Status**: ✅ Largest model registry

### 6.2 Ollama Library API

- **Website**: https://ollama.com/library
- **API endpoints**:
  - `GET /api/tags` (local) — list installed models
  - `POST /api/pull` — pull model from registry
  - `POST /api/show` — show model details
  - No official public search API for the registry
  - Registry at: `https://registry.ollama.ai`
- **Model naming**: `library/model:tag` (e.g., `llama3.2:7b`)
- **Status**: ✅ Growing rapidly

### 6.3 CivitAI API

- **Base URL**: `https://civitai.com/api/v1`
- **Endpoints** (see Section 2.11 above for detail):
  - `GET /models` — search models
  - `GET /models/:id` — model details
  - `GET /model-versions/:id` — version details
  - `GET /model-versions/by-hash/:hash` — find by hash
  - `GET /images` — browse images
  - `GET /creators` — list creators
  - `GET /tags` — browse tags
  - Download files via model version download URLs
- **Status**: ✅ Largest Stable Diffusion model registry

### 6.4 Replicate

- **Website**: https://replicate.com
- **API**: Cloud-based inference API, not for local model discovery
- **Local relevance**: Links to source repos; many models have weights on HuggingFace
- **Status**: Cloud-only, not directly useful for local

### 6.5 ModelScope (Alibaba)

- **Website**: https://modelscope.cn
- **Description**: Chinese alternative to HuggingFace
- **API**: Similar model hub API
  ```python
  from modelscope import snapshot_download
  model_dir = snapshot_download("Wan-AI/Wan2.1-T2V-14B")
  ```
- **Key models**: Wan2.1, Qwen, many Chinese models appear here first
- **Status**: ✅ Active, important for Chinese AI models

---

## 7. Hardware Requirements

### 7.1 VRAM Requirements by Model Size

| Model Size | FP16 VRAM | Q8 VRAM | Q4 VRAM | CPU RAM (Q4) |
|-----------|-----------|---------|---------|-------------|
| 1-3B | 2-6 GB | 1-3 GB | 1-2 GB | 4-8 GB |
| 7-8B | 14-16 GB | 8-9 GB | 4-5 GB | 8-16 GB |
| 13B | 26 GB | 14 GB | 7-8 GB | 16 GB |
| 30-34B | 60-68 GB | 34 GB | 18-20 GB | 32 GB |
| 70B | 140 GB | 70 GB | 35-40 GB | 64 GB |

### 7.2 Image/Video Model VRAM

| Model | Minimum VRAM | Recommended | Notes |
|-------|-------------|-------------|-------|
| SD 1.5 | 4 GB | 6 GB | Runs on almost anything |
| SDXL | 6 GB | 8 GB | With optimizations |
| SD3.5-Medium | 6 GB | 8 GB | |
| SD3.5-Large | 12 GB | 16 GB | |
| FLUX.1-schnell (NF4) | 6 GB | 8 GB | Quantized |
| FLUX.1-dev (FP16) | 20 GB | 24 GB | Full precision |
| Wan2.1 T2V-1.3B | 8 GB | 10 GB | Consumer-friendly video |
| Wan2.1 T2V-14B | 40 GB | 48 GB | Multi-GPU recommended |
| HunyuanVideo | 24 GB (FP8) | 40 GB+ | FP8 weights available |
| CogVideoX-5B | 18 GB | 24 GB | |

### 7.3 CPU-Only Options

- **llama.cpp**: Full CPU support, all GGUF models. Slow but functional.
- **Ollama**: CPU fallback automatic
- **GPT4All**: Designed for CPU usage
- **Llamafile**: CPU support built-in
- **KoboldCpp**: CPU mode
- **ONNX Runtime**: Optimized CPU inference for embeddings
- **Faster-Whisper**: CTranslate2 CPU mode is very efficient
- **ComfyUI**: `--cpu` flag (very slow for image gen)

### 7.4 Apple Silicon (M1/M2/M3/M4)

| Runtime | Apple Silicon Support | Notes |
|---------|----------------------|-------|
| **MLX / mlx-lm** | ✅ Native, optimal | Designed for Apple Silicon, uses unified memory |
| **llama.cpp** | ✅ Metal acceleration | Very good performance |
| **Ollama** | ✅ Metal acceleration | Seamless |
| **LM Studio** | ✅ Metal + MLX | Best desktop experience on Mac |
| **KoboldCpp** | ✅ Metal | ARM64 binary available |
| **Llamafile** | ✅ Universal binary | Works on all Macs |
| **ComfyUI** | ✅ MPS backend | Slower than CUDA but functional |
| **vLLM** | ❌ | No Metal/MPS support |
| **ExLlamaV2** | ❌ | CUDA only |
| **diffusers** | ⚠️ MPS backend | Works but slower, some ops unsupported |

**Unified Memory advantage**: M1 Max (64GB), M2 Ultra (192GB), M3 Max (128GB), M4 Max (128GB) can run large models that don't fit in discrete GPU VRAM.

### 7.5 AMD ROCm Support

| Runtime | ROCm Support | Notes |
|---------|-------------|-------|
| **llama.cpp** | ✅ | HIP/ROCm backend |
| **Ollama** | ✅ | Auto-detects AMD GPUs |
| **vLLM** | ⚠️ Experimental | Limited model support |
| **PyTorch/diffusers** | ✅ | ROCm 5.x/6.x |
| **ComfyUI** | ✅ | Via PyTorch ROCm |
| **ExLlamaV2** | ❌ | CUDA only |
| **KoboldCpp** | ✅ | HIP backend available |
| **TGI** | ✅ | Official ROCm support |

Supported AMD GPUs: RX 7900 XTX (24GB), RX 7900 XT (20GB), RX 7800 XT (16GB), Instinct MI250/MI300

---

## 8. Unified Integration Strategy for Noosphere

### 8.1 Recommended Architecture

```
noosphere
├── providers/
│   ├── llm/
│   │   ├── ollama.ts      # Ollama API (most popular, easiest)
│   │   ├── llamacpp.ts    # llama.cpp server (raw performance)
│   │   ├── vllm.ts        # vLLM (production serving)
│   │   ├── lmstudio.ts    # LM Studio API
│   │   ├── localai.ts     # LocalAI (multi-modal)
│   │   ├── koboldcpp.ts   # KoboldCpp (all-in-one)
│   │   ├── openai.ts      # Generic OpenAI-compatible
│   │   └── mlx.ts         # MLX (Apple Silicon)
│   ├── image/
│   │   ├── comfyui.ts     # ComfyUI workflow API
│   │   ├── a1111.ts       # Automatic1111/Forge API
│   │   ├── diffusers.ts   # Python diffusers bridge
│   │   └── koboldcpp.ts   # KoboldCpp image gen
│   ├── video/
│   │   ├── comfyui.ts     # ComfyUI (supports all video models)
│   │   ├── diffusers.ts   # Python diffusers bridge
│   │   └── koboldcpp.ts   # KoboldCpp video gen
│   ├── audio/
│   │   ├── tts/
│   │   │   ├── kokoro.ts
│   │   │   ├── fish.ts
│   │   │   ├── f5tts.ts
│   │   │   ├── xtts.ts
│   │   │   ├── parler.ts
│   │   │   └── koboldcpp.ts
│   │   ├── stt/
│   │   │   ├── whisper.ts
│   │   │   ├── faster_whisper.ts
│   │   │   └── koboldcpp.ts
│   │   └── music/
│   │       ├── audiocraft.ts
│   │       ├── stable_audio.ts
│   │       └── koboldcpp.ts
│   └── embedding/
│       ├── ollama.ts
│       ├── sentence_transformers.ts
│       ├── fastembed.ts
│       └── openai_compat.ts
├── registry/
│   ├── huggingface.ts
│   ├── ollama.ts
│   ├── civitai.ts
│   └── modelscope.ts
└── discovery/
    └── detect.ts          # Auto-detect running services
```

### 8.2 Detection Strategy

```typescript
// Auto-detect available providers by checking common endpoints
const DETECTION_MAP = {
  ollama:    { url: "http://localhost:11434/api/version", method: "GET" },
  llamacpp:  { url: "http://localhost:8080/health", method: "GET" },
  vllm:      { url: "http://localhost:8000/v1/models", method: "GET" },
  lmstudio:  { url: "http://localhost:1234/v1/models", method: "GET" },
  localai:   { url: "http://localhost:8080/v1/models", method: "GET" },
  comfyui:   { url: "http://localhost:8188/system_stats", method: "GET" },
  a1111:     { url: "http://localhost:7860/sdapi/v1/sd-models", method: "GET" },
  koboldcpp: { url: "http://localhost:5001/api/v1/info/version", method: "GET" },
  jan:       { url: "http://localhost:1337/v1/models", method: "GET" },
};
```

### 8.3 Priority Recommendations

**For LLM text generation:**
1. Ollama (easiest, broadest model support)
2. llama.cpp server (most control)
3. KoboldCpp (if multi-modal needed)
4. vLLM (if production throughput needed)

**For image generation:**
1. ComfyUI (most models, most flexible)
2. KoboldCpp (simple, built-in)
3. Forge/A1111 (good API, lots of extensions)
4. diffusers (programmatic)

**For video generation:**
1. ComfyUI (best support for all video models)
2. diffusers (programmatic)

**For TTS:**
1. Fish Speech or F5-TTS (best quality/speed balance)
2. Kokoro (lightweight)
3. KoboldCpp (built-in, multiple engines)

**For STT:**
1. Faster-Whisper (best speed)
2. WhisperX (if diarization needed)
3. Ollama/KoboldCpp (built-in)

**For embeddings:**
1. Ollama (simplest)
2. FastEmbed (fastest, production-ready)
3. sentence-transformers (most models)

### 8.4 Key Insight: KoboldCpp as Universal Backend

KoboldCpp deserves special attention as it implements **7+ API protocols** and supports **all modalities** (text, image, video, audio, music, vision, STT, TTS) in a single zero-install binary. For a unified library like noosphere, KoboldCpp could serve as a single backend covering all needs, with specialized tools for better performance in specific modalities.

### 8.5 Key Insight: OpenAI API Compatibility

Almost all LLM runtimes now implement OpenAI-compatible APIs. A single `OpenAICompatibleProvider` with configurable base URL can work with: Ollama, vLLM, llama.cpp, LM Studio, LocalAI, TabbyAPI, KoboldCpp, Jan, and TGI. This should be the primary integration pattern.

---

## Appendix: Quick Reference — API Ports

| Service | Default Port | API Style |
|---------|-------------|-----------|
| Ollama | 11434 | Ollama + OpenAI |
| llama.cpp server | 8080 | OpenAI + native |
| vLLM | 8000 | OpenAI |
| LM Studio | 1234 | OpenAI + Anthropic + LMS |
| LocalAI | 8080 | OpenAI |
| ComfyUI | 8188 | Custom REST + WebSocket |
| A1111/Forge | 7860 | Custom REST |
| KoboldCpp | 5001 | KoboldAI + OpenAI + Ollama + A1111 + ComfyUI |
| TabbyAPI | 5000 | OpenAI |
| Jan.ai | 1337 | OpenAI |
| InvokeAI | 9090 | Custom REST |
| GPT4All | — | Python SDK (no default server) |
