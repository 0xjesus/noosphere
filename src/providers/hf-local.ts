// src/providers/hf-local.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo } from '../types.js';
import { getProviderLogo } from '../logos.js';
import { fetchReadmeDescription } from '../utils/parse-readme.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const FETCH_TIMEOUT_MS = 5000;
const HF_HUB_API = 'https://huggingface.co/api/models';

const HF_ORG_TO_LOGO_PROVIDER: Record<string, string> = {
  'meta-llama': 'meta',
  'facebook': 'meta',
  'google': 'google',
  'microsoft': 'microsoft',
  'nvidia': 'nvidia',
  'mistralai': 'mistral',
  'Qwen': 'qwen',
  'deepseek-ai': 'deepseek',
  'openai': 'openai',
  'CohereForAI': 'cohere',
  'rhasspy': 'piper',
  'stabilityai': 'huggingface',
  'black-forest-labs': 'huggingface',
  'tiiuae': 'huggingface',
  'allenai': 'huggingface',
  'Salesforce': 'huggingface',
};

const PIPELINE_TAG_TO_MODALITY: Record<string, Modality> = {
  'text-to-image': 'image',
  'text-to-video': 'video',
  'text-to-audio': 'music',
  'text-to-speech': 'tts',
  'automatic-speech-recognition': 'stt',
};

const CATALOG_QUERIES: Array<{ pipeline_tag: string; limit: number; library?: string }> = [
  { pipeline_tag: 'text-to-image', limit: 50 },
  { pipeline_tag: 'text-to-video', limit: 30 },
  { pipeline_tag: 'text-to-audio', limit: 30 },
  { pipeline_tag: 'text-to-speech', limit: 30 },
  { pipeline_tag: 'automatic-speech-recognition', limit: 30 },
  { pipeline_tag: 'text-to-image', limit: 100, library: 'diffusers' },
];

async function fetchJsonTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class HfLocalProvider implements NoosphereProvider {
  readonly id = 'hf-local';
  readonly name = 'HuggingFace Local Models';
  readonly modalities: Modality[] = ['image', 'video', 'tts', 'stt', 'music'];
  readonly isLocal = true;

  private cachedModels: ModelInfo[] | null = null;

  async ping(): Promise<boolean> {
    return true;
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    if (!this.cachedModels) {
      const [catalog, installed] = await Promise.all([
        this.fetchCatalog(),
        this.scanLocalCache(),
      ]);

      // Merge: installed models override catalog entries
      const modelMap = new Map<string, ModelInfo>();
      for (const m of catalog) modelMap.set(m.id, m);
      for (const m of installed) modelMap.set(m.id, m);
      this.cachedModels = Array.from(modelMap.values());
    }

    if (modality) return this.cachedModels.filter((m) => m.modality === modality);
    return this.cachedModels;
  }

  private async fetchCatalog(): Promise<ModelInfo[]> {
    const seen = new Set<string>();
    const entries: Array<{ id: string; pipelineTag: string; libraryName?: string }> = [];

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

    // Batch-fetch descriptions (10 concurrent at a time)
    const descriptionMap = new Map<string, string>();
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      const descs = await Promise.allSettled(
        batch.map(async (e) => {
          const desc = await fetchReadmeDescription(e.id);
          return { id: e.id, desc };
        }),
      );
      for (const d of descs) {
        if (d.status === 'fulfilled' && d.value.desc) {
          descriptionMap.set(d.value.id, d.value.desc);
        }
      }
    }

    // Build ModelInfo with descriptions and per-org logos
    const models: ModelInfo[] = [];
    for (const e of entries) {
      const modality = PIPELINE_TAG_TO_MODALITY[e.pipelineTag] ?? 'image';
      const org = e.id.includes('/') ? e.id.split('/')[0] : undefined;
      const logoProvider = org ? (HF_ORG_TO_LOGO_PROVIDER[org] ?? 'huggingface') : 'huggingface';

      models.push({
        id: e.id,
        provider: 'hf-local',
        name: e.id.split('/').pop() ?? e.id,
        modality,
        local: true,
        cost: { price: 0, unit: 'free' },
        logo: getProviderLogo(logoProvider),
        description: descriptionMap.get(e.id),
        status: 'available',
        localInfo: {
          sizeBytes: 0,
          runtime: 'huggingface',
          family: e.libraryName,
        },
        capabilities: {},
      });
    }

    return models;
  }

  private async scanLocalCache(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    const cacheDir = join(homedir(), '.cache', 'huggingface', 'hub');

    try {
      const entries = await readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('models--')) continue;

        // Parse "models--org--name" → "org/name"
        const parts = entry.name.replace('models--', '').split('--');
        const modelId = parts.join('/');
        const modelDir = join(cacheDir, entry.name);

        // Read refs/main to get snapshot hash
        let snapshotHash: string | undefined;
        try {
          snapshotHash = (await readFile(join(modelDir, 'refs', 'main'), 'utf-8')).trim();
        } catch { continue; }

        // Try to detect pipeline from model_index.json or config.json
        let pipelineTag = '';
        const snapshotDir = join(modelDir, 'snapshots', snapshotHash!);
        try {
          const modelIndex = JSON.parse(await readFile(join(snapshotDir, 'model_index.json'), 'utf-8'));
          if (modelIndex._class_name?.includes('Stable') || modelIndex._class_name?.includes('Flux')) {
            pipelineTag = 'text-to-image';
          } else if (modelIndex._class_name?.includes('Video') || modelIndex._class_name?.includes('Animate')) {
            pipelineTag = 'text-to-video';
          }
        } catch {
          try {
            const config = JSON.parse(await readFile(join(snapshotDir, 'config.json'), 'utf-8'));
            if (config.task_specific_params?.['text-to-image']) pipelineTag = 'text-to-image';
            else if (config.model_type?.includes('whisper')) pipelineTag = 'automatic-speech-recognition';
          } catch { /* skip */ }
        }

        const modality = PIPELINE_TAG_TO_MODALITY[pipelineTag] ?? 'image';
        const org = modelId.includes('/') ? modelId.split('/')[0] : undefined;
        const logoProvider = org ? (HF_ORG_TO_LOGO_PROVIDER[org] ?? 'huggingface') : 'huggingface';

        models.push({
          id: modelId,
          provider: 'hf-local',
          name: modelId.split('/').pop() ?? modelId,
          modality,
          local: true,
          cost: { price: 0, unit: 'free' },
          logo: getProviderLogo(logoProvider),
          status: 'installed',
          localInfo: {
            sizeBytes: 0,
            runtime: 'huggingface',
            diskPath: snapshotDir,
          },
        });
      }
    } catch { /* cache dir doesn't exist */ }

    return models;
  }
}
