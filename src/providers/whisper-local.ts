// src/providers/whisper-local.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo } from '../types.js';
import type { TranscriptionOptions, TranscriptionResult } from '../types.js';
import { getProviderLogo } from '../logos.js';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3', 'turbo'];

function runPython(code: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = execFile('python3', ['-c', code], { timeout: timeoutMs }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export class WhisperLocalProvider implements NoosphereProvider {
  readonly id = 'whisper-local';
  readonly name = 'Whisper (Local)';
  readonly modalities: Modality[] = ['stt'];
  readonly isLocal = true;

  private runtime: 'whisper' | 'faster-whisper' | null = null;

  async ping(): Promise<boolean> {
    return (await this.detectRuntime()) !== null;
  }

  private async detectRuntime(): Promise<'whisper' | 'faster-whisper' | null> {
    if (this.runtime) return this.runtime;
    try {
      await runPython('import faster_whisper; print("ok")');
      this.runtime = 'faster-whisper';
      return this.runtime;
    } catch { /* not installed */ }
    try {
      await runPython('import whisper; print(whisper.__version__)');
      this.runtime = 'whisper';
      return this.runtime;
    } catch { /* not installed */ }
    return null;
  }

  async listModels(_modality?: Modality): Promise<ModelInfo[]> {
    if (_modality && _modality !== 'stt') return [];

    const runtime = await this.detectRuntime();
    if (!runtime) return [];

    const logo = getProviderLogo('huggingface');
    const models: ModelInfo[] = [];

    for (const name of WHISPER_MODELS) {
      const installed = await this.isModelCached(name, runtime);
      models.push({
        id: `whisper-${name}`,
        provider: 'whisper-local',
        name: `Whisper ${name}`,
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

  private async isModelCached(name: string, runtime: string): Promise<boolean> {
    if (runtime === 'whisper') {
      return fileExists(join(homedir(), '.cache', 'whisper', `${name}.pt`));
    }
    // faster-whisper uses HF cache
    const hfDir = join(homedir(), '.cache', 'huggingface', 'hub', `models--Systran--faster-whisper-${name}`);
    return fileExists(hfDir);
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const runtime = await this.detectRuntime();
    if (!runtime) throw new Error('Whisper is not installed');

    const model = options.model?.replace('whisper-', '') ?? 'base';
    const lang = options.language ? `--language ${options.language}` : '';
    const task = options.task ?? 'transcribe';

    if (runtime === 'faster-whisper') {
      const code = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel("${model}")
segments, info = model.transcribe("${options.audio}", task="${task}"${options.language ? `, language="${options.language}"` : ''})
segs = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
print(json.dumps({"text": " ".join(s["text"] for s in segs), "language": info.language, "duration": info.duration, "segments": segs}))
`;
      const output = await runPython(code, 120000);
      return JSON.parse(output);
    } else {
      const code = `
import json, whisper
model = whisper.load_model("${model}")
result = model.transcribe("${options.audio}", task="${task}"${options.language ? `, language="${options.language}"` : ''})
segs = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result.get("segments", [])]
print(json.dumps({"text": result["text"], "language": result.get("language", ""), "duration": 0, "segments": segs}))
`;
      const output = await runPython(code, 120000);
      return JSON.parse(output);
    }
  }
}
