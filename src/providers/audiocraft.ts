// src/providers/audiocraft.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo } from '../types.js';
import { getProviderLogo } from '../logos.js';
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

    const logo = getProviderLogo('meta');
    const models: ModelInfo[] = [];

    for (const m of AUDIOCRAFT_MODELS) {
      const hfDir = join(homedir(), '.cache', 'huggingface', 'hub', `models--facebook--${m.id}`);
      const installed = await fileExists(hfDir);

      models.push({
        id: m.id,
        provider: 'audiocraft',
        name: m.name,
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
