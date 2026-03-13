// src/providers/ollama.ts
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, NoosphereResult, NoosphereStream, StreamEvent,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

// --- Ollama-specific types ---

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface OllamaModelDetail {
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  expires_at: string;
  size_vram: number;
}

// --- Family → logo provider map ---

const OLLAMA_FAMILY_TO_PROVIDER: Record<string, string> = {
  'llama': 'meta', 'codellama': 'meta',
  'gemma': 'google', 'gemma2': 'google', 'gemma3': 'google',
  'qwen': 'qwen', 'qwen2': 'qwen', 'qwen2.5': 'qwen', 'qwen3': 'qwen',
  'deepseek': 'deepseek', 'deepcoder': 'deepseek', 'deepscaler': 'deepseek',
  'qwq': 'qwen',
  'phi': 'microsoft', 'phi3': 'microsoft', 'phi4': 'microsoft',
  'mistral': 'mistral', 'mixtral': 'mistral', 'codestral': 'mistral', 'ministral': 'mistral',
  'nemotron': 'nvidia',
  'command': 'cohere', 'command-r': 'cohere',
  'gpt-oss': 'openai',
  'starcoder': 'huggingface',
  'falcon': 'meta',
  'glm': 'zai',
  'granite': 'ibm',
  'olmo': 'meta',
  'yi': 'zai',
  'minimax': 'minimax',
  'kimi': 'meta',
  'dolphin': 'ollama',
  'wizard': 'ollama',
  'nomic': 'ollama',
  'mxbai': 'ollama',
  'bge': 'ollama',
  'all-minilm': 'ollama',
  'moondream': 'ollama',
};

const VISION_MODELS = new Set([
  'llava', 'moondream', 'minicpm-v', 'llama3.2-vision', 'qwen2.5vl', 'gemma3',
  'llava-llama3', 'llava-phi3', 'bakllava',
]);

function inferLogoProvider(modelName: string, _family?: string): string {
  // Strip namespace (e.g. "artifish/llama3.2-uncensored" → "llama3.2-uncensored")
  const base = modelName.split(':')[0].toLowerCase().replace(/^[^/]+\//, '');
  
  // Try model name prefix — longest match first to avoid "llama" matching "llava"
  const sortedPrefixes = Object.entries(OLLAMA_FAMILY_TO_PROVIDER)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, provider] of sortedPrefixes) {
    if (base === prefix || base.startsWith(prefix)) return provider;
  }
  
  // NOTE: We intentionally do NOT use the `family` field from Ollama API
  // because it represents the model architecture (e.g. qwen2), not the org.
  // deepseek-r1 has family "qwen2", mistral has family "llama", etc.
  
  return 'ollama';
}

function supportsVision(modelName: string): boolean {
  const base = modelName.split(':')[0].toLowerCase();
  for (const v of VISION_MODELS) {
    if (base === v || base.startsWith(v)) return true;
  }
  return false;
}

async function fetchJson(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<any> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class OllamaProvider implements NoosphereProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly modalities: Modality[] = ['llm'];
  readonly isLocal = true;

  private baseUrl: string;

  constructor(config?: { host?: string; port?: number }) {
    const host = config?.host ?? 'http://localhost';
    const port = config?.port ?? 11434;
    // Build base URL: strip trailing slash, append port if not already in URL
    const cleanHost = host.replace(/\/+$/, '');
    // Check if host already has a port (after the protocol part)
    const hasPort = /:\d+$/.test(cleanHost);
    this.baseUrl = hasPort ? cleanHost : `${cleanHost}:${port}`;
  }

  async ping(): Promise<boolean> {
    try {
      await fetchJson(`${this.baseUrl}/api/version`, { timeoutMs: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(_modality?: Modality): Promise<ModelInfo[]> {
    if (_modality && _modality !== 'llm') return [];

    // Fetch all three sources in parallel, fail silently
    const [localData, catalogData, runningData] = await Promise.all([
      fetchJson(`${this.baseUrl}/api/tags`, { timeoutMs: 5000 }).catch(() => null),
      fetchJson('https://ollama.com/api/tags', { timeoutMs: 5000 }).catch(() => null),
      fetchJson(`${this.baseUrl}/api/ps`, { timeoutMs: 5000 }).catch(() => null),
    ]);

    const runningNames = new Set<string>();
    if (runningData?.models) {
      for (const m of runningData.models) {
        runningNames.add(m.name);
        // Also add without tag for matching
        runningNames.add(m.model);
      }
    }

    const models = new Map<string, ModelInfo>();

    // Local installed models
    if (localData?.models) {
      for (const m of localData.models) {
        const isRunning = runningNames.has(m.name) || runningNames.has(m.model);
        models.set(m.name, this.toModelInfo(m, isRunning ? 'running' : 'installed', true));
      }
    }

    // Web catalog models (only add if not already installed)
    if (catalogData?.models) {
      for (const m of catalogData.models) {
        const name = m.name;
        if (!models.has(name)) {
          models.set(name, this.toModelInfo(m, 'available', false));
        }
      }
    }

    return Array.from(models.values());
  }

  private toModelInfo(
    m: any,
    status: 'installed' | 'available' | 'running',
    isLocal: boolean,
  ): ModelInfo {
    const name = m.name ?? m.model ?? 'unknown';
    const family = m.details?.family;
    const logoProvider = inferLogoProvider(name, family);

    return {
      id: name,
      provider: 'ollama',
      name,
      modality: 'llm',
      local: true,
      cost: { price: 0, unit: 'free' },
      logo: getProviderLogo(logoProvider),
      status,
      localInfo: {
        sizeBytes: m.size ?? 0,
        family: family ?? m.details?.family,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
        format: m.details?.format,
        digest: m.digest,
        modifiedAt: m.modified_at,
        running: status === 'running',
        runtime: 'ollama',
      },
      capabilities: {
        contextWindow: 128000,
        supportsVision: supportsVision(name),
        supportsStreaming: true,
      },
    };
  }

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const messages = options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: any = {
      model: options.model ?? 'llama3.2',
      messages,
      stream: false,
    };
    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      body.options = {};
      if (options.temperature !== undefined) body.options.temperature = options.temperature;
      if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
    }

    const data: any = await res.json();
    return {
      content: data.message?.content ?? '',
      provider: 'ollama',
      model: options.model ?? 'llama3.2',
      modality: 'llm',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: data.prompt_eval_count ?? 0,
        output: data.eval_count ?? 0,
        unit: 'tokens',
      },
    };
  }

  stream(options: ChatOptions): NoosphereStream {
    const self = this;
    const start = Date.now();
    let aborted = false;
    let resolveResult: ((r: NoosphereResult) => void) | null = null;
    let rejectResult: ((e: Error) => void) | null = null;
    const resultPromise = new Promise<NoosphereResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const messages = options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: any = {
      model: options.model ?? 'llama3.2',
      messages,
      stream: true,
    };
    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      body.options = {};
      if (options.temperature !== undefined) body.options.temperature = options.temperature;
      if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;
    }

    const asyncIterator: AsyncIterable<StreamEvent> = {
      async *[Symbol.asyncIterator]() {
        try {
          const res = await fetch(`${self.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            throw new Error(`Ollama stream failed: ${res.status} ${await res.text()}`);
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let finalData: any = null;
          let buffer = '';

          while (!aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const chunk = JSON.parse(line);
                if (chunk.message?.content) {
                  fullContent += chunk.message.content;
                  yield { type: 'text_delta', delta: chunk.message.content };
                }
                if (chunk.done) {
                  finalData = chunk;
                }
              } catch {
                // skip malformed JSON
              }
            }
          }

          const result: NoosphereResult = {
            content: fullContent,
            provider: 'ollama',
            model: options.model ?? 'llama3.2',
            modality: 'llm',
            latencyMs: Date.now() - start,
            usage: {
              cost: 0,
              input: finalData?.prompt_eval_count ?? 0,
              output: finalData?.eval_count ?? 0,
              unit: 'tokens',
            },
          };

          resolveResult?.(result);
          yield { type: 'done', result };
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          rejectResult?.(error);
          yield { type: 'error', error };
        }
      },
    };

    return {
      [Symbol.asyncIterator]: () => asyncIterator[Symbol.asyncIterator](),
      result: () => resultPromise,
      abort: () => { aborted = true; },
    };
  }

  // --- Extra model management methods ---

  async *pullModel(name: string): AsyncGenerator<OllamaPullProgress> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Ollama pull failed: ${res.status} ${await res.text()}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line) as OllamaPullProgress;
        } catch { /* skip */ }
      }
    }
  }

  async deleteModel(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Ollama delete failed: ${res.status} ${await res.text()}`);
    }
  }

  async showModel(name: string): Promise<OllamaModelDetail> {
    const res = await fetch(`${this.baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Ollama show failed: ${res.status} ${await res.text()}`);
    }
    return await res.json() as OllamaModelDetail;
  }

  async getRunningModels(): Promise<OllamaRunningModel[]> {
    const data = await fetchJson(`${this.baseUrl}/api/ps`, { timeoutMs: 5000 });
    return data?.models ?? [];
  }
}
