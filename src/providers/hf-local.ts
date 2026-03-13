// src/providers/hf-local.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo } from '../types.js';
import { getProviderLogo } from '../logos.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const FETCH_TIMEOUT_MS = 5000;
const HF_HUB_API = 'https://huggingface.co/api/models';

const PIPELINE_TAG_TO_MODALITY: Record<string, Modality> = {
  'text-to-image': 'image',
  'text-to-video': 'video',
  'text-to-audio': 'tts',
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
  readonly modalities: Modality[] = ['image', 'video', 'tts', 'stt'];
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
    const models: ModelInfo[] = [];
    const logo = getProviderLogo('huggingface');

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

        const pipelineTag = entry.pipeline_tag ?? '';
        const modality = PIPELINE_TAG_TO_MODALITY[pipelineTag] ?? 'image';

        models.push({
          id,
          provider: 'hf-local',
          name: id.split('/').pop() ?? id,
          modality,
          local: true,
          cost: { price: 0, unit: 'free' },
          logo,
          status: 'available',
          localInfo: {
            sizeBytes: 0,
            runtime: 'huggingface',
            family: entry.library_name,
          },
          capabilities: {},
        });
      }
    }

    return models;
  }

  private async scanLocalCache(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    const cacheDir = join(homedir(), '.cache', 'huggingface', 'hub');
    const logo = getProviderLogo('huggingface');

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

        models.push({
          id: modelId,
          provider: 'hf-local',
          name: modelId.split('/').pop() ?? modelId,
          modality,
          local: true,
          cost: { price: 0, unit: 'free' },
          logo,
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
