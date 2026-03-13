// src/providers/openai-compat.ts
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, NoosphereResult, NoosphereStream, StreamEvent,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const FETCH_TIMEOUT_MS = 5000;

export interface OpenAICompatConfig {
  baseUrl: string;
  apiKey?: string;
  name?: string;
  id?: string;
}

// Common local server ports and their names
export const KNOWN_LOCAL_SERVERS: Array<{ port: number; name: string; id: string }> = [
  { port: 8080, name: 'llama.cpp / LocalAI', id: 'llamacpp' },
  { port: 1234, name: 'LM Studio', id: 'lmstudio' },
  { port: 8000, name: 'vLLM', id: 'vllm' },
  { port: 5000, name: 'TabbyAPI', id: 'tabbyapi' },
  { port: 5001, name: 'KoboldCpp', id: 'koboldcpp' },
  { port: 1337, name: 'Jan', id: 'jan' },
];

async function fetchJsonTimeout(url: string, headers?: Record<string, string>, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class OpenAICompatProvider implements NoosphereProvider {
  readonly id: string;
  readonly name: string;
  readonly modalities: Modality[] = ['llm'];
  readonly isLocal = true;

  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: OpenAICompatConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.id = config.id ?? `openai-compat-${new URL(config.baseUrl).port}`;
    this.name = config.name ?? `OpenAI-Compatible (${this.baseUrl})`;
    this.headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      this.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  async ping(): Promise<boolean> {
    const data = await fetchJsonTimeout(`${this.baseUrl}/v1/models`, this.headers, 2000);
    return data !== null;
  }

  async listModels(_modality?: Modality): Promise<ModelInfo[]> {
    if (_modality && _modality !== 'llm') return [];

    const data = await fetchJsonTimeout(`${this.baseUrl}/v1/models`, this.headers);
    if (!data?.data || !Array.isArray(data.data)) return [];

    const logo = getProviderLogo('openai');
    return data.data.map((m: any) => ({
      id: m.id,
      provider: this.id,
      name: m.id,
      modality: 'llm' as const,
      local: true,
      cost: { price: 0, unit: 'free' },
      logo,
      status: 'running' as const,
      localInfo: {
        sizeBytes: 0,
        runtime: this.id,
      },
      capabilities: {
        supportsStreaming: true,
      },
    }));
  }

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const model = options.model ?? 'default';

    const body: any = {
      model,
      messages: options.messages,
      stream: false,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`OpenAI-compat chat failed: ${res.status} ${await res.text()}`);

    const data = await res.json() as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      provider: this.id,
      model,
      modality: 'llm',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
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

    const model = options.model ?? 'default';
    const body: any = {
      model,
      messages: options.messages,
      stream: true,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const asyncIterator: AsyncIterable<StreamEvent> = {
      async *[Symbol.asyncIterator]() {
        try {
          const res = await fetch(`${self.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: self.headers,
            body: JSON.stringify(body),
          });

          if (!res.ok) throw new Error(`Stream failed: ${res.status} ${await res.text()}`);

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          let buffer = '';

          while (!aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
              try {
                const chunk = JSON.parse(line.slice(6));
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  yield { type: 'text_delta', delta };
                }
              } catch { /* skip */ }
            }
          }

          const result: NoosphereResult = {
            content: fullContent,
            provider: self.id,
            model,
            modality: 'llm',
            latencyMs: Date.now() - start,
            usage: { cost: 0, unit: 'tokens' },
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
}

/** Auto-detect running OpenAI-compatible servers on common ports */
export async function detectOpenAICompatServers(): Promise<OpenAICompatProvider[]> {
  const providers: OpenAICompatProvider[] = [];

  const results = await Promise.allSettled(
    KNOWN_LOCAL_SERVERS.map(async (server) => {
      const baseUrl = `http://localhost:${server.port}`;
      const provider = new OpenAICompatProvider({
        baseUrl,
        name: server.name,
        id: server.id,
      });
      const ok = await provider.ping();
      if (ok) return provider;
      return null;
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      providers.push(result.value);
    }
  }

  return providers;
}
