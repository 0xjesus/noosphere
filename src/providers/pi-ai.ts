// src/providers/pi-ai.ts
import { getModels, getProviders, complete, stream, setApiKey } from '@mariozechner/pi-ai';
import type { KnownProvider, Model, Api, Context, AssistantMessage } from '@mariozechner/pi-ai';
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, NoosphereResult, NoosphereStream, StreamEvent,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const KNOWN_PROVIDERS: KnownProvider[] = ['anthropic', 'google', 'openai', 'xai', 'groq', 'cerebras', 'openrouter', 'zai'];
const LOCAL_PROVIDERS = new Set(['ollama']);

const FETCH_TIMEOUT_MS = 8000;

// --- Provider-specific model filtering ---

// OpenAI: only chat/completion models (not embeddings, tts, whisper, dall-e, etc.)
const OPENAI_CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-', 'codex-'];
const OPENAI_REASONING_PREFIXES = ['o1', 'o3', 'o4'];

// Google: only generative language models
const GOOGLE_GENERATIVE_PREFIXES = ['gemini-', 'gemma-'];

// Anthropic: all models are chat models
const ANTHROPIC_CHAT_PREFIXES = ['claude-'];

// Provider API endpoint configurations
interface ProviderApiConfig {
  url: string;
  headers: (key: string) => Record<string, string>;
  piApiType: Api;
  piBaseUrl: string;
  providerName: string;
  filterChat: (id: string) => boolean;
  isReasoning: (id: string) => boolean;
  extractEntries: (data: any) => Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }>;
}

const PROVIDER_APIS: Record<string, (key: string) => ProviderApiConfig> = {
  openai: () => ({
    url: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-responses' as Api,
    piBaseUrl: 'https://api.openai.com/v1',
    providerName: 'openai',
    filterChat: (id) => OPENAI_CHAT_PREFIXES.some((p) => id.startsWith(p)),
    isReasoning: (id) => OPENAI_REASONING_PREFIXES.some((p) => id.startsWith(p)),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.id })),
  }),
  anthropic: () => ({
    url: 'https://api.anthropic.com/v1/models?limit=100',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    piApiType: 'anthropic-messages' as Api,
    piBaseUrl: 'https://api.anthropic.com/v1',
    providerName: 'anthropic',
    filterChat: (id) => ANTHROPIC_CHAT_PREFIXES.some((p) => id.startsWith(p)),
    isReasoning: (id) => id.includes('opus') || id.includes('sonnet'),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.display_name ?? e.id })),
  }),
  google: (key) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    headers: () => ({}),
    piApiType: 'google-generative-ai' as Api,
    piBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    providerName: 'google',
    filterChat: (id) => GOOGLE_GENERATIVE_PREFIXES.some((p) => id.startsWith(p)),
    isReasoning: (id) => id.includes('thinking') || id.includes('2.5'),
    extractEntries: (data) =>
      (data?.models ?? [])
        .filter((e: any) => !e.supportedGenerationMethods || e.supportedGenerationMethods.includes('generateContent'))
        .map((e: any) => ({
          id: (e.name as string).replace(/^models\//, ''),
          name: e.displayName ?? (e.name as string).replace(/^models\//, ''),
          contextWindow: e.inputTokenLimit,
          maxTokens: e.outputTokenLimit,
        })),
  }),
  groq: () => ({
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-completions' as Api,
    piBaseUrl: 'https://api.groq.com/openai/v1',
    providerName: 'groq',
    filterChat: () => true, // Groq only serves chat models
    isReasoning: (id) => id.includes('deepseek-r1'),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.id })),
  }),
  mistral: () => ({
    url: 'https://api.mistral.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-completions' as Api,
    piBaseUrl: 'https://api.mistral.ai/v1',
    providerName: 'mistral',
    filterChat: (id) => !id.includes('embed'),
    isReasoning: (id) => id.includes('large') || id.includes('codestral'),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.id })),
  }),
  xai: () => ({
    url: 'https://api.x.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-completions' as Api,
    piBaseUrl: 'https://api.x.ai/v1',
    providerName: 'xai',
    filterChat: (id) => id.startsWith('grok'),
    isReasoning: (id) => id.includes('think'),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.id })),
  }),
  openrouter: () => ({
    url: 'https://openrouter.ai/api/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-completions' as Api,
    piBaseUrl: 'https://openrouter.ai/api/v1',
    providerName: 'openrouter',
    filterChat: () => true, // OpenRouter only lists usable models
    isReasoning: (id) => id.includes('o1') || id.includes('o3') || id.includes('thinking') || id.includes('deepseek-r1'),
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({
        id: e.id,
        name: e.name ?? e.id,
        contextWindow: e.context_length,
        maxTokens: e.max_completion_tokens ?? e.top_provider?.max_completion_tokens,
      })),
  }),
  cerebras: () => ({
    url: 'https://api.cerebras.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    piApiType: 'openai-completions' as Api,
    piBaseUrl: 'https://api.cerebras.ai/v1',
    providerName: 'cerebras',
    filterChat: () => true,
    isReasoning: () => false,
    extractEntries: (data) =>
      (data?.data ?? []).map((e: any) => ({ id: e.id, name: e.id })),
  }),
};

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
  // Dynamically discovered models not in pi-ai's static catalog
  private dynamicModels = new Map<string, Model<Api>>();
  private dynamicModelsFetched = false;

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

    // 100% dynamic — fetch from ALL provider APIs
    await this.ensureDynamicModels();

    const models: ModelInfo[] = [];
    for (const [, m] of this.dynamicModels) {
      const providerName = String(m.provider);
      // For aggregators (openrouter), infer the real provider from model ID prefix
      const logoProvider = this.inferLogoProvider(m.id, providerName);
      models.push({
        id: m.id,
        provider: 'pi-ai',
        name: m.name || m.id,
        modality: 'llm' as const,
        local: false,
        cost: {
          price: m.cost.input ?? 0,
          unit: m.cost.input > 0 ? 'per_1m_tokens' : 'free',
        },
        logo: getProviderLogo(logoProvider),
        capabilities: {
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
          supportsVision: m.input.includes('image'),
          supportsStreaming: true,
        },
      });
    }

    return models;
  }

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();

    // Find the model — static catalog first, then dynamic
    await this.ensureDynamicModels();
    const { model, provider } = this.findModel(options.model);

    if (!model || !provider) {
      throw new Error(`Model not found: ${options.model ?? 'default'}`);
    }

    const context: Context = {
      systemPrompt: options.messages.find((m) => m.role === 'system')?.content,
      messages: options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user',
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
    const self = this;
    let innerStream: ReturnType<typeof stream> | undefined;
    let providerModel: { model: Model<Api>; provider: string } | undefined;
    let aborted = false;
    let resolveResult: ((r: NoosphereResult) => void) | null = null;
    let rejectResult: ((e: Error) => void) | null = null;
    const resultPromise = new Promise<NoosphereResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    const ensureModel = async () => {
      if (!providerModel) {
        await self.ensureDynamicModels();
        const found = self.findModel(options.model);
        if (!found.model || !found.provider) {
          throw new Error(`Model not found: ${options.model ?? 'default'}`);
        }
        providerModel = { model: found.model, provider: found.provider };

        const context: Context = {
          systemPrompt: options.messages.find((m) => m.role === 'system')?.content,
          messages: options.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role as 'user',
              content: m.content,
              timestamp: Date.now(),
            })),
        };

        innerStream = stream(providerModel.model, context);
      }
    };

    const asyncIterator: AsyncIterable<StreamEvent> = {
      async *[Symbol.asyncIterator]() {
        try {
          await ensureModel();

          for await (const chunk of innerStream!) {
            if (aborted) break;
            if (chunk.type === 'text_delta') {
              yield { type: 'text_delta', delta: chunk.delta };
            } else if (chunk.type === 'thinking_delta') {
              yield { type: 'thinking_delta', delta: chunk.delta };
            }
          }

          const final = await innerStream!.result();
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

  // --- Dynamic Model Discovery (ALL providers) ---

  private async ensureDynamicModels(): Promise<void> {
    if (this.dynamicModelsFetched) return;
    this.dynamicModelsFetched = true;

    // 100% dynamic — fetch from ALL provider APIs in parallel
    const fetchPromises: Promise<void>[] = [];
    for (const [providerKey, configFactory] of Object.entries(PROVIDER_APIS)) {
      const apiKey = this.keys[providerKey];
      if (!apiKey) continue;
      fetchPromises.push(this.fetchProviderModels(configFactory(apiKey), apiKey));
    }

    await Promise.allSettled(fetchPromises);
  }

  private async fetchProviderModels(
    config: ProviderApiConfig,
    apiKey: string,
  ): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const headers = config.headers(apiKey);
        const res = await fetch(config.url, {
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data = await res.json();
        const entries = config.extractEntries(data);

        // Try to enrich with static catalog metadata (cost data) if available
        const staticTemplate = this.findStaticTemplate(config.providerName);

        for (const entry of entries) {
          const id = entry.id;
          if (!config.filterChat(id)) continue;

          // Check if static catalog has this exact model for richer metadata
          const staticMatch = this.findStaticModel(config.providerName, id);

          this.dynamicModels.set(id, {
            id,
            name: entry.name ?? id,
            api: config.piApiType,
            provider: config.providerName,
            baseUrl: config.piBaseUrl,
            reasoning: config.isReasoning(id),
            input: staticMatch?.input ?? ['text', 'image'],
            cost: staticMatch?.cost ?? staticTemplate?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: entry.contextWindow ?? staticMatch?.contextWindow ?? staticTemplate?.contextWindow ?? 128000,
            maxTokens: entry.maxTokens ?? staticMatch?.maxTokens ?? staticTemplate?.maxTokens ?? 16384,
          } as Model<Api>);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Network failure — silently skip
    }
  }

  private findStaticTemplate(providerName: string): Model<Api> | null {
    try {
      const models = getModels(providerName as KnownProvider) as Model<Api>[];
      return models[0] ?? null;
    } catch {
      return null;
    }
  }

  private findStaticModel(providerName: string, modelId: string): Model<Api> | null {
    try {
      const models = getModels(providerName as KnownProvider) as Model<Api>[];
      return models.find((m) => m.id === modelId) ?? null;
    } catch {
      return null;
    }
  }

  /** Force re-fetch of dynamic models from provider APIs */
  async refreshDynamicModels(): Promise<void> {
    this.dynamicModelsFetched = false;
    this.dynamicModels.clear();
    await this.ensureDynamicModels();
  }

  /**
   * Infer the real provider from model ID for logo resolution.
   * e.g. "x-ai/grok-4" → "xai", "anthropic/claude-4" → "anthropic"
   */
  private inferLogoProvider(modelId: string, fallback: string): string {
    const MODEL_PREFIX_TO_PROVIDER: Record<string, string> = {
      'openai/': 'openai', 'gpt-': 'openai', 'o1-': 'openai', 'o3-': 'openai', 'o4-': 'openai', 'chatgpt-': 'openai',
      'anthropic/': 'anthropic', 'claude-': 'anthropic',
      'google/': 'google', 'gemini-': 'google', 'gemma-': 'google',
      'x-ai/': 'xai', 'grok-': 'xai',
      'meta-llama/': 'meta',
      'mistralai/': 'mistral', 'mistral-': 'mistral',
      'deepseek/': 'deepseek',
      'microsoft/': 'microsoft',
      'nvidia/': 'nvidia',
      'qwen/': 'qwen',
      'cohere/': 'cohere',
      'perplexity/': 'perplexity',
      'amazon/': 'amazon',
      'z-ai/': 'zai',
      'minimax/': 'minimax',
      'baidu/': 'baidu',
      'bytedance/': 'bytedance', 'bytedance-seed/': 'bytedance',
      'tencent/': 'tencent',
      'xiaomi/': 'xiaomi',
      'ibm-granite/': 'ibm', 'ibm/': 'ibm',
      'ai21/': 'ai21',
      'inflection/': 'inflection',
      'upstage/': 'upstage',
      'alibaba/': 'qwen',
    };

    const lower = modelId.toLowerCase();
    for (const [prefix, provider] of Object.entries(MODEL_PREFIX_TO_PROVIDER)) {
      if (lower.startsWith(prefix)) return provider;
    }
    return fallback;
  }

  private findModel(modelId?: string): { model: Model<Api> | null; provider: string | null } {
    // 1. Search dynamic models first (100% dynamic catalog)
    if (modelId) {
      const dynamic = this.dynamicModels.get(modelId);
      if (dynamic) return { model: dynamic, provider: String(dynamic.provider) };
    }

    // 2. No specific model requested — return first dynamic model available
    if (!modelId) {
      const first = this.dynamicModels.values().next();
      if (!first.done && first.value) {
        return { model: first.value, provider: String(first.value.provider) };
      }
    }

    // 3. Last resort: check static catalog for Model object (needed by pi-ai complete/stream)
    for (const provider of KNOWN_PROVIDERS) {
      try {
        const models = getModels(provider) as Model<Api>[];
        const found = modelId
          ? models.find((m) => m.id === modelId)
          : undefined;
        if (found) return { model: found, provider };
      } catch {
        // skip
      }
    }

    return { model: null, provider: null };
  }
}
