# Model Descriptions & Logo Inference for Local Providers

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic `description` field to all local model providers and improve logo inference for HuggingFace models so they show the real org logo instead of the generic HF logo.

**Architecture:** Add `description?: string` to `ModelInfo`. Ollama descriptions are scraped from `ollama.com/library` page. HuggingFace descriptions come from a second API call per model to `/api/models/{id}` (the listing endpoint doesn't return descriptions, but the detail endpoint has a README card we can parse). CivitAI descriptions are extracted from the existing API response. Whisper/AudioCraft descriptions are fetched from HuggingFace API for their specific model repos. HF model logos are inferred from the `author` field (org part of model ID) mapped to known provider logos.

**Tech Stack:** TypeScript, fetch API, HTML parsing (regex for Ollama library scrape)

---

## Chunk 1: Core Type + Ollama Descriptions

### Task 1: Add `description` field to `ModelInfo`

**Files:**
- Modify: `src/types.ts:100-126`

- [ ] **Step 1: Add `description` to `ModelInfo` interface**

In `src/types.ts`, add `description?: string` after the `name` field:

```typescript
export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  description?: string;  // <-- ADD THIS
  modality: Modality;
  // ... rest unchanged
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (description is optional, existing code doesn't break)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add description field to ModelInfo interface"
```

---

### Task 2: Scrape Ollama library descriptions

**Files:**
- Modify: `src/providers/ollama.ts:141-181`

The Ollama API at `ollama.com/api/tags` does NOT return descriptions. But `ollama.com/library` page renders descriptions for each model. We scrape that page and build a name→description map, then merge it in `listModels()`.

- [ ] **Step 1: Add `fetchOllamaDescriptions` function**

Add above the `OllamaProvider` class in `ollama.ts`:

```typescript
async function fetchOllamaDescriptions(timeoutMs = 8000): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://ollama.com/library', { signal: controller.signal });
      if (!res.ok) return descriptions;
      const html = await res.text();

      // The library page renders model cards with name + description.
      // Each model has an <h2> with the name and a <p> with the description.
      // Pattern: <span ...>modelname</span> ... <p ...>description text</p>
      const modelBlocks = html.match(/<li[^>]*>[\s\S]*?<\/li>/gi) ?? [];
      for (const block of modelBlocks) {
        // Extract model name from the link href="/library/modelname"
        const nameMatch = block.match(/href="\/library\/([^"]+)"/);
        // Extract description from <p> tag inside the block
        const descMatch = block.match(/<p[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        if (nameMatch && descMatch) {
          const name = nameMatch[1].trim();
          const desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
          if (name && desc) descriptions.set(name, desc);
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* library page unreachable */ }
  return descriptions;
}
```

- [ ] **Step 2: Integrate descriptions into `listModels`**

Modify `listModels` to fetch descriptions in parallel with the other sources. Update the parallel fetch:

```typescript
async listModels(_modality?: Modality): Promise<ModelInfo[]> {
  if (_modality && _modality !== 'llm') return [];

  const [localData, catalogData, runningData, descriptions] = await Promise.all([
    fetchJson(`${this.baseUrl}/api/tags`, { timeoutMs: 5000 }).catch(() => null),
    fetchJson('https://ollama.com/api/tags', { timeoutMs: 5000 }).catch(() => null),
    fetchJson(`${this.baseUrl}/api/ps`, { timeoutMs: 5000 }).catch(() => null),
    fetchOllamaDescriptions().catch(() => new Map<string, string>()),
  ]);

  // ... runningNames unchanged ...

  const models = new Map<string, ModelInfo>();

  if (localData?.models) {
    for (const m of localData.models) {
      const isRunning = runningNames.has(m.name) || runningNames.has(m.model);
      models.set(m.name, this.toModelInfo(m, isRunning ? 'running' : 'installed', true, descriptions));
    }
  }

  if (catalogData?.models) {
    for (const m of catalogData.models) {
      const name = m.name;
      if (!models.has(name)) {
        models.set(name, this.toModelInfo(m, 'available', false, descriptions));
      }
    }
  }

  return Array.from(models.values());
}
```

- [ ] **Step 3: Update `toModelInfo` to accept and use descriptions**

```typescript
private toModelInfo(
  m: any,
  status: 'installed' | 'available' | 'running',
  isLocal: boolean,
  descriptions?: Map<string, string>,
): ModelInfo {
  const name = m.name ?? m.model ?? 'unknown';
  const family = m.details?.family;
  const logoProvider = inferLogoProvider(name, family);

  // Match description by base model name (strip tag like ":8b")
  const baseName = name.split(':')[0];
  const description = descriptions?.get(baseName) ?? descriptions?.get(name);

  return {
    id: name,
    provider: 'ollama',
    name,
    description,
    modality: 'llm',
    // ... rest unchanged
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/ollama.ts
git commit -m "feat: scrape Ollama library for model descriptions"
```

---

## Chunk 2: HuggingFace Descriptions + Logo Inference

### Task 3: Add descriptions and org logos to HuggingFace local provider

**Files:**
- Modify: `src/providers/hf-local.ts:73-120`
- Modify: `src/logos.ts:15-31` (add new org IDs)

The HF listing API (`/api/models?pipeline_tag=...`) does NOT return descriptions. But it returns the model `id` which contains the org (e.g. `stabilityai/stable-diffusion-xl-base-1.0`). We use the org to:
1. Infer the real provider logo (stabilityai, black-forest-labs, etc.)
2. Fetch the model card README to extract a description (first paragraph)

For descriptions, we batch-fetch individual model details. The single-model endpoint (`/api/models/{id}`) doesn't return description either, so we fetch the README.md from the repo: `https://huggingface.co/{modelId}/raw/main/README.md` and extract the first meaningful paragraph after the YAML frontmatter.

- [ ] **Step 1: Add HF org logo provider IDs to logos.ts**

Add these orgs to `PROVIDER_IDS` in `src/logos.ts` (these are major HF model publishers that have uploaded logo PNGs to our CDN — we need to upload the PNGs first, or rely on the ones we already have):

```typescript
// In PROVIDER_IDS array, add to "Model orgs" section:
'stabilityai', 'black-forest-labs', 'tencent',
```

Note: Many HF orgs like `stabilityai`, `black-forest-labs` won't have logos on the CDN yet. The `getProviderLogo` function returns `undefined` for unknown IDs, which is fine — we fall back to HF logo. We can add CDN logos later.

Actually, a better approach: create a mapping from HF org names to existing provider IDs that already have logos on the CDN:

```typescript
// In hf-local.ts
const HF_ORG_TO_LOGO_PROVIDER: Record<string, string> = {
  'meta-llama': 'meta',
  'facebook': 'meta',
  'google': 'google',
  'microsoft': 'microsoft',
  'nvidia': 'nvidia',
  'mistralai': 'mistral',
  'Qwen': 'qwen',
  'deepseek-ai': 'deepseek',
  'stabilityai': 'huggingface',  // no CDN logo yet, fallback to HF
  'black-forest-labs': 'huggingface',
  'openai': 'openai',
  'CohereForAI': 'cohere',
  'tiiuae': 'huggingface',
  'allenai': 'huggingface',
  'Salesforce': 'huggingface',
  'rhasspy': 'piper',
};
```

- [ ] **Step 2: Add `fetchModelDescription` helper to hf-local.ts**

```typescript
async function fetchModelDescription(modelId: string, timeoutMs = 5000): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://huggingface.co/${modelId}/raw/main/README.md`,
        { signal: controller.signal },
      );
      if (!res.ok) return undefined;
      const text = await res.text();

      // Strip YAML frontmatter (between --- markers)
      const withoutFrontmatter = text.replace(/^---[\s\S]*?---\s*/, '');

      // Find first meaningful paragraph (skip headings, badges, links-only lines)
      const lines = withoutFrontmatter.split('\n');
      let paragraph = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (paragraph) break; // end of paragraph
          continue;
        }
        if (trimmed.startsWith('#')) {
          if (paragraph) break;
          continue;
        }
        // Skip badge/image lines
        if (/^\[?!\[/.test(trimmed) || /^<img/.test(trimmed) || /^<a/.test(trimmed)) continue;
        // Skip lines that are only links
        if (/^\[.*\]\(.*\)$/.test(trimmed)) continue;
        paragraph += (paragraph ? ' ' : '') + trimmed;
      }

      // Clean markdown artifacts and truncate
      if (paragraph) {
        paragraph = paragraph
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) → text
          .replace(/\*\*([^*]+)\*\*/g, '$1')          // **bold** → bold
          .replace(/`([^`]+)`/g, '$1')                 // `code` → code
          .replace(/<[^>]+>/g, '')                      // strip HTML tags
          .trim();
        if (paragraph.length > 300) paragraph = paragraph.slice(0, 297) + '...';
        return paragraph;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch { /* unreachable */ }
  return undefined;
}
```

- [ ] **Step 3: Batch-fetch descriptions in `fetchCatalog` with concurrency limit**

We don't want to fire 270 concurrent requests. Fetch descriptions in batches of 10:

```typescript
private async fetchCatalog(): Promise<ModelInfo[]> {
  const seen = new Set<string>();
  const models: ModelInfo[] = [];

  const results = await Promise.allSettled(
    CATALOG_QUERIES.map(async (q) => {
      const params = new URLSearchParams({
        pipeline_tag: q.pipeline_tag,
        sort: 'downloads',
        limit: String(q.limit),
      });
      if (q.library) params.set('library', q.library);
      return fetchJsonTimeout(`${HF_HUB_API}?${params}`);
    }),
  );

  // Collect all unique model entries first
  const entries: Array<{ id: string; pipelineTag: string; libraryName?: string }> = [];
  for (const result of results) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const entry of result.value) {
      const id = entry.id ?? entry.modelId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push({
        id,
        pipelineTag: entry.pipeline_tag ?? '',
        libraryName: entry.library_name,
      });
    }
  }

  // Batch-fetch descriptions (10 concurrent)
  const descriptionMap = new Map<string, string>();
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const descs = await Promise.allSettled(
      batch.map(async (e) => {
        const desc = await fetchModelDescription(e.id);
        return { id: e.id, desc };
      }),
    );
    for (const d of descs) {
      if (d.status === 'fulfilled' && d.value.desc) {
        descriptionMap.set(d.value.id, d.value.desc);
      }
    }
  }

  // Build ModelInfo array
  for (const entry of entries) {
    const modality = PIPELINE_TAG_TO_MODALITY[entry.pipelineTag] ?? 'image';
    const org = entry.id.includes('/') ? entry.id.split('/')[0] : undefined;
    const logoProvider = org ? (HF_ORG_TO_LOGO_PROVIDER[org] ?? 'huggingface') : 'huggingface';

    models.push({
      id: entry.id,
      provider: 'hf-local',
      name: entry.id.split('/').pop() ?? entry.id,
      description: descriptionMap.get(entry.id),
      modality,
      local: true,
      cost: { price: 0, unit: 'free' },
      logo: getProviderLogo(logoProvider),
      status: 'available',
      localInfo: {
        sizeBytes: 0,
        runtime: 'huggingface',
        family: entry.libraryName,
      },
      capabilities: {},
    });
  }

  return models;
}
```

- [ ] **Step 4: Update `scanLocalCache` to also infer org logo**

In the `scanLocalCache` method, the `modelId` already has the format `org/name`. Use the org for logo inference:

```typescript
// In scanLocalCache, replace:
//   const logo = getProviderLogo('huggingface');
// with per-model logo inference:

// Remove the shared `logo` const at the top of scanLocalCache.
// Inside the loop, after parsing modelId:
const org = modelId.includes('/') ? modelId.split('/')[0] : undefined;
const logoProvider = org ? (HF_ORG_TO_LOGO_PROVIDER[org] ?? 'huggingface') : 'huggingface';

models.push({
  // ...
  logo: getProviderLogo(logoProvider),
  // ...
});
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/providers/hf-local.ts
git commit -m "feat: add descriptions and org logo inference for HuggingFace models"
```

---

## Chunk 3: CivitAI, Whisper, AudioCraft Descriptions

### Task 4: Extract CivitAI descriptions in ComfyUI provider

**Files:**
- Modify: `src/providers/comfyui.ts:112-141`

The CivitAI API already returns a `description` field per model — we just don't extract it.

- [ ] **Step 1: Extract description from CivitAI response**

In the CivitAI catalog loop in `listModels()`, add description extraction:

```typescript
// In the CivitAI loop, change the models.push to include description:
models.push({
  id: `civitai-${item.id}`, provider: 'comfyui',
  name: item.name ?? `CivitAI Model ${item.id}`,
  description: item.description
    ? item.description.replace(/<[^>]+>/g, '').trim().slice(0, 300) || undefined
    : undefined,
  modality: 'image', local: true, cost: { price: 0, unit: 'free' }, logo,
  status: 'available',
  localInfo: {
    sizeBytes: version?.files?.[0]?.sizeKB ? version.files[0].sizeKB * 1024 : 0,
    runtime: 'comfyui',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/providers/comfyui.ts
git commit -m "feat: extract CivitAI model descriptions in ComfyUI provider"
```

---

### Task 5: Fetch Whisper model descriptions from HuggingFace

**Files:**
- Modify: `src/providers/whisper-local.ts:53-81`

Whisper models have HuggingFace repos with README descriptions. Fetch dynamically from HF.

- [ ] **Step 1: Add description fetcher for Whisper models**

Add at the top of `whisper-local.ts`, after imports:

```typescript
const WHISPER_HF_REPOS: Record<string, string> = {
  'tiny': 'openai/whisper-tiny',
  'base': 'openai/whisper-base',
  'small': 'openai/whisper-small',
  'medium': 'openai/whisper-medium',
  'large': 'openai/whisper-large',
  'large-v2': 'openai/whisper-large-v2',
  'large-v3': 'openai/whisper-large-v3',
  'turbo': 'openai/whisper-large-v3-turbo',
};

async function fetchWhisperDescriptions(timeoutMs = 8000): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  const fetches = Object.entries(WHISPER_HF_REPOS).map(async ([size, repo]) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(
          `https://huggingface.co/${repo}/raw/main/README.md`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const text = await res.text();
        const withoutFrontmatter = text.replace(/^---[\s\S]*?---\s*/, '');
        const lines = withoutFrontmatter.split('\n');
        let paragraph = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { if (paragraph) break; continue; }
          if (trimmed.startsWith('#')) { if (paragraph) break; continue; }
          if (/^\[?!\[/.test(trimmed) || /^</.test(trimmed)) continue;
          if (/^\[.*\]\(.*\)$/.test(trimmed)) continue;
          paragraph += (paragraph ? ' ' : '') + trimmed;
        }
        if (paragraph) {
          paragraph = paragraph
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/<[^>]+>/g, '')
            .trim();
          if (paragraph.length > 300) paragraph = paragraph.slice(0, 297) + '...';
          descriptions.set(size, paragraph);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch { /* skip */ }
  });
  await Promise.allSettled(fetches);
  return descriptions;
}
```

- [ ] **Step 2: Integrate descriptions into `listModels`**

```typescript
async listModels(_modality?: Modality): Promise<ModelInfo[]> {
  if (_modality && _modality !== 'stt') return [];

  const runtime = await this.detectRuntime();
  if (!runtime) return [];

  const [descriptions] = await Promise.allSettled([fetchWhisperDescriptions()]);
  const descMap = descriptions.status === 'fulfilled' ? descriptions.value : new Map<string, string>();

  const logo = getProviderLogo('openai'); // Whisper is by OpenAI
  const models: ModelInfo[] = [];

  for (const name of WHISPER_MODELS) {
    const installed = await this.isModelCached(name, runtime);
    models.push({
      id: `whisper-${name}`,
      provider: 'whisper-local',
      name: `Whisper ${name}`,
      description: descMap.get(name),
      modality: 'stt',
      local: true,
      cost: { price: 0, unit: 'free' },
      logo,
      status: installed ? 'installed' : 'available',
      localInfo: {
        sizeBytes: 0,
        runtime,
      },
    });
  }

  return models;
}
```

Note: Also changed logo from `huggingface` to `openai` since Whisper is by OpenAI.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/whisper-local.ts
git commit -m "feat: fetch Whisper descriptions from HuggingFace, fix logo to OpenAI"
```

---

### Task 6: Fetch AudioCraft descriptions from HuggingFace

**Files:**
- Modify: `src/providers/audiocraft.ts:10-78`

AudioCraft models are all from Facebook/Meta on HuggingFace. Fetch descriptions from their README.

- [ ] **Step 1: Add description fetcher for AudioCraft models**

Add after the `AUDIOCRAFT_MODELS` array:

```typescript
const AUDIOCRAFT_HF_REPOS: Record<string, string> = {
  'musicgen-small': 'facebook/musicgen-small',
  'musicgen-medium': 'facebook/musicgen-medium',
  'musicgen-large': 'facebook/musicgen-large',
  'musicgen-melody': 'facebook/musicgen-melody',
  'audiogen-medium': 'facebook/audiogen-medium',
};

async function fetchAudioCraftDescriptions(timeoutMs = 8000): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  const fetches = Object.entries(AUDIOCRAFT_HF_REPOS).map(async ([id, repo]) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(
          `https://huggingface.co/${repo}/raw/main/README.md`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const text = await res.text();
        const withoutFrontmatter = text.replace(/^---[\s\S]*?---\s*/, '');
        const lines = withoutFrontmatter.split('\n');
        let paragraph = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { if (paragraph) break; continue; }
          if (trimmed.startsWith('#')) { if (paragraph) break; continue; }
          if (/^\[?!\[/.test(trimmed) || /^</.test(trimmed)) continue;
          if (/^\[.*\]\(.*\)$/.test(trimmed)) continue;
          paragraph += (paragraph ? ' ' : '') + trimmed;
        }
        if (paragraph) {
          paragraph = paragraph
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/<[^>]+>/g, '')
            .trim();
          if (paragraph.length > 300) paragraph = paragraph.slice(0, 297) + '...';
          descriptions.set(id, paragraph);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch { /* skip */ }
  });
  await Promise.allSettled(fetches);
  return descriptions;
}
```

- [ ] **Step 2: Integrate into `listModels`**

```typescript
async listModels(_modality?: Modality): Promise<ModelInfo[]> {
  if (_modality && _modality !== 'music') return [];
  if (!(await this.ping())) return [];

  const [descriptions] = await Promise.allSettled([fetchAudioCraftDescriptions()]);
  const descMap = descriptions.status === 'fulfilled' ? descriptions.value : new Map<string, string>();

  const logo = getProviderLogo('meta');
  const models: ModelInfo[] = [];

  for (const m of AUDIOCRAFT_MODELS) {
    const hfDir = join(homedir(), '.cache', 'huggingface', 'hub', `models--facebook--${m.id}`);
    const installed = await fileExists(hfDir);

    models.push({
      id: m.id,
      provider: 'audiocraft',
      name: m.name,
      description: descMap.get(m.id),
      modality: 'music',
      local: true,
      cost: { price: 0, unit: 'free' },
      logo,
      status: installed ? 'installed' : 'available',
      localInfo: {
        sizeBytes: 0,
        runtime: 'audiocraft',
      },
    });
  }

  return models;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/audiocraft.ts
git commit -m "feat: fetch AudioCraft descriptions from HuggingFace"
```

---

## Chunk 4: Extract shared README parser + Final verification

### Task 7: Extract shared `parseReadmeDescription` utility

**Files:**
- Create: `src/utils/parse-readme.ts`
- Modify: `src/providers/hf-local.ts` (import shared util)
- Modify: `src/providers/whisper-local.ts` (import shared util)
- Modify: `src/providers/audiocraft.ts` (import shared util)

The README parsing logic is duplicated across 3 providers. Extract to shared utility.

- [ ] **Step 1: Create shared utility**

Create `src/utils/parse-readme.ts`:

```typescript
// src/utils/parse-readme.ts

/**
 * Fetches a HuggingFace model README and extracts the first meaningful paragraph
 * as a description. Strips YAML frontmatter, headings, badges, and markdown formatting.
 */
export async function fetchReadmeDescription(
  modelId: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://huggingface.co/${modelId}/raw/main/README.md`,
        { signal: controller.signal },
      );
      if (!res.ok) return undefined;
      const text = await res.text();
      return parseReadmeDescription(text);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return undefined;
  }
}

/**
 * Parses a README markdown string and extracts the first meaningful paragraph.
 */
export function parseReadmeDescription(readme: string): string | undefined {
  // Strip YAML frontmatter
  const withoutFrontmatter = readme.replace(/^---[\s\S]*?---\s*/, '');

  const lines = withoutFrontmatter.split('\n');
  let paragraph = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (paragraph) break;
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (paragraph) break;
      continue;
    }
    // Skip badges, images, HTML tags
    if (/^\[?!\[/.test(trimmed) || /^</.test(trimmed)) continue;
    // Skip lines that are only links
    if (/^\[.*\]\(.*\)$/.test(trimmed)) continue;
    paragraph += (paragraph ? ' ' : '') + trimmed;
  }

  if (!paragraph) return undefined;

  // Clean markdown artifacts
  paragraph = paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // **bold** → bold
    .replace(/`([^`]+)`/g, '$1')                 // `code` → code
    .replace(/<[^>]+>/g, '')                      // strip HTML
    .trim();

  if (!paragraph) return undefined;
  if (paragraph.length > 300) paragraph = paragraph.slice(0, 297) + '...';

  return paragraph;
}
```

- [ ] **Step 2: Refactor providers to use shared utility**

In `hf-local.ts`, replace the inline `fetchModelDescription` function with:
```typescript
import { fetchReadmeDescription } from '../utils/parse-readme.js';
```
And replace `fetchModelDescription(e.id)` calls with `fetchReadmeDescription(e.id)`.

In `whisper-local.ts`, replace the inline `fetchWhisperDescriptions` to use:
```typescript
import { fetchReadmeDescription } from '../utils/parse-readme.js';
```
And simplify the loop to: `const desc = await fetchReadmeDescription(repo);`

Same for `audiocraft.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/parse-readme.ts src/providers/hf-local.ts src/providers/whisper-local.ts src/providers/audiocraft.ts
git commit -m "refactor: extract shared parseReadmeDescription utility"
```

---

### Task 8: Final build & verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 4: Final commit with version bump**

```bash
npm version minor --no-git-tag-version
git add -A
git commit -m "feat: dynamic descriptions and org logo inference for all local model providers"
```
