// src/providers/audiocraft.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo } from '../types.js';
import { getProviderLogo } from '../logos.js';
import { fetchReadmeDescription } from '../utils/parse-readme.js';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const AUDIOCRAFT_MODELS = [
  { id: 'musicgen-small', name: 'MusicGen Small' },
  { id: 'musicgen-medium', name: 'MusicGen Medium' },
  { id: 'musicgen-large', name: 'MusicGen Large' },
  { id: 'musicgen-melody', name: 'MusicGen Melody' },
  { id: 'audiogen-medium', name: 'AudioGen Medium' },
];

const AUDIOCRAFT_HF_REPOS: Record<string, string> = {
  'musicgen-small': 'facebook/musicgen-small',
  'musicgen-medium': 'facebook/musicgen-medium',
  'musicgen-large': 'facebook/musicgen-large',
  'musicgen-melody': 'facebook/musicgen-melody',
  'audiogen-medium': 'facebook/audiogen-medium',
};

async function fetchAudioCraftDescriptions(): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>();
  const fetches = Object.entries(AUDIOCRAFT_HF_REPOS).map(async ([id, repo]) => {
    const desc = await fetchReadmeDescription(repo, 8000);
    if (desc) descriptions.set(id, desc);
  });
  await Promise.allSettled(fetches);
  return descriptions;
}

function runPython(code: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python3', ['-c', code], { timeout: timeoutMs }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export class AudioCraftProvider implements NoosphereProvider {
  readonly id = 'audiocraft';
  readonly name = 'AudioCraft (Local)';
  readonly modalities: Modality[] = ['music'];
  readonly isLocal = true;

  private detected: boolean | null = null;

  async ping(): Promise<boolean> {
    if (this.detected !== null) return this.detected;
    try {
      await runPython('import audiocraft; print("ok")');
      this.detected = true;
    } catch {
      this.detected = false;
    }
    return this.detected;
  }

  async listModels(_modality?: Modality): Promise<ModelInfo[]> {
    if (_modality && _modality !== 'music') return [];
    if (!(await this.ping())) return [];

    const descMap = await fetchAudioCraftDescriptions().catch(() => new Map<string, string>());
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
}
