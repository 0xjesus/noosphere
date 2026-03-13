// src/providers/pi-ai.ts
import { getModels, getProviders, complete, stream, setApiKey } from '@mariozechner/pi-ai';
import type { KnownProvider, Model, Api, Context, AssistantMessage } from '@mariozechner/pi-ai';
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, NoosphereResult, NoosphereStream, StreamEvent,
} from '../types.js';

const KNOWN_PROVIDERS: KnownProvider[] = ['anthropic', 'google', 'openai', 'xai', 'groq', 'cerebras', 'openrouter', 'zai'];
const LOCAL_PROVIDERS = new Set(['ollama']);

function extractText(msg: AssistantMessage): string {
  return msg.content
    .filter((c): c is { type: 'text'; text: string; textSignature?: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

function extractThinking(msg: AssistantMessage): string | undefined {
  const thinking = msg.content
    .filter((c): c is { type: 'thinking'; thinking: string; thinkingSignature?: string } => c.type === 'thinking')
    .map((c) => c.thinking)
    .join('');
  return thinking || undefined;
}

export class PiAiProvider implements NoosphereProvider {
  readonly id = 'pi-ai';
  readonly name = 'pi-ai (LLM Gateway)';
  readonly modalities: Modality[] = ['llm'];
  readonly isLocal = false;

  private keys: Record<string, string>;

  constructor(keys: Record<string, string | undefined>) {
    this.keys = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v) {
        this.keys[k] = v;
        // Set API key in pi-ai for the known provider
        if (KNOWN_PROVIDERS.includes(k as KnownProvider)) {
          setApiKey(k as KnownProvider, v);
        } else {
          setApiKey(k, v);
        }
      }
    }
  }

  async ping(): Promise<boolean> {
    try {
      getProviders();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    if (modality && modality !== 'llm') return [];

    const models: ModelInfo[] = [];
    for (const provider of KNOWN_PROVIDERS) {
      try {
        const providerModels = getModels(provider);
        for (const m of providerModels as Model<Api>[]) {
          models.push({
            id: m.id,
            provider: 'pi-ai',
            name: m.name || m.id,
            modality: 'llm' as const,
            local: LOCAL_PROVIDERS.has(String(m.provider)),
            cost: {
              price: m.cost.input ?? 0,
              unit: m.cost.input > 0 ? 'per_1m_tokens' : 'free',
            },
            capabilities: {
              contextWindow: m.contextWindow,
              maxTokens: m.maxTokens,
              supportsVision: m.input.includes('image'),
              supportsStreaming: true,
            },
          });
        }
      } catch {
        // Skip providers that fail to load
      }
    }
    return models;
  }

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();

    // Find the model — we need to search through providers
    const { model, provider } = this.findModel(options.model);

    if (!model || !provider) {
      throw new Error(`Model not found: ${options.model ?? 'default'}`);
    }

    const context: Context = {
      systemPrompt: options.messages.find((m) => m.role === 'system')?.content,
      messages: options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: Date.now(),
        })),
    };

    const response = await complete(model, context);

    const inputTokens = response.usage?.input ?? 0;
    const outputTokens = response.usage?.output ?? 0;

    return {
      content: extractText(response),
      thinking: extractThinking(response),
      provider: 'pi-ai',
      model: response.model ?? options.model ?? 'unknown',
      modality: 'llm',
      latencyMs: Date.now() - start,
      usage: {
        cost: response.usage?.cost?.total ?? 0,
        input: inputTokens,
        output: outputTokens,
        unit: 'tokens',
      },
    };
  }

  stream(options: ChatOptions): NoosphereStream {
    const start = Date.now();
    const { model, provider } = this.findModel(options.model);

    if (!model || !provider) {
      throw new Error(`Model not found: ${options.model ?? 'default'}`);
    }

    const context: Context = {
      systemPrompt: options.messages.find((m) => m.role === 'system')?.content,
      messages: options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: Date.now(),
        })),
    };

    const piStream = stream(model, context);

    const self = this;
    let aborted = false;
    let resolveResult: ((r: NoosphereResult) => void) | null = null;
    let rejectResult: ((e: Error) => void) | null = null;
    const resultPromise = new Promise<NoosphereResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const asyncIterator: AsyncIterable<StreamEvent> = {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const chunk of piStream) {
            if (aborted) break;
            if (chunk.type === 'text_delta') {
              yield { type: 'text_delta', delta: chunk.delta };
            } else if (chunk.type === 'thinking_delta') {
              yield { type: 'thinking_delta', delta: chunk.delta };
            }
          }

          const final = await piStream.result();
          const inputTokens = final.usage?.input ?? 0;
          const outputTokens = final.usage?.output ?? 0;
          const result: NoosphereResult = {
            content: extractText(final),
            thinking: extractThinking(final),
            provider: 'pi-ai',
            model: final.model ?? options.model ?? 'unknown',
            modality: 'llm',
            latencyMs: Date.now() - start,
            usage: {
              cost: final.usage?.cost?.total ?? 0,
              input: inputTokens,
              output: outputTokens,
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

  private findModel(modelId?: string): { model: Model<Api> | null; provider: string | null } {
    for (const provider of KNOWN_PROVIDERS) {
      try {
        const models = getModels(provider) as Model<Api>[];
        const found = modelId
          ? models.find((m) => m.id === modelId)
          : models[0];
        if (found) return { model: found, provider };
      } catch {
        // skip
      }
    }
    return { model: null, provider: null };
  }
}
