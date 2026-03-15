// src/noosphere.ts
import type {
  NoosphereConfig,
  ChatOptions,
  ImageOptions,
  VideoOptions,
  SpeakOptions,
  NoosphereResult,
  NoosphereStream,
  StreamEvent,
  ModelInfo,
  ProviderInfo,
  UsageEvent,
  UsageQueryOptions,
  UsageSummary,
  SyncResult,
  Modality,
} from './types.js';
import { NoosphereError } from './errors.js';
import { resolveConfig, type ResolvedConfig } from './config.js';
import { Registry } from './registry.js';
import { UsageTracker } from './tracking.js';
import type { NoosphereProvider } from './providers/base.js';
import { PiAiProvider } from './providers/pi-ai.js';
import { FalProvider } from './providers/fal.js';
import { ComfyUIProvider } from './providers/comfyui.js';
import { LocalTTSProvider } from './providers/local-tts.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { OllamaProvider } from './providers/ollama.js';
import { HfLocalProvider } from './providers/hf-local.js';
import { WhisperLocalProvider } from './providers/whisper-local.js';
import { AudioCraftProvider } from './providers/audiocraft.js';
import { OpenAICompatProvider, detectOpenAICompatServers } from './providers/openai-compat.js';
import { OpenAIMediaProvider } from './providers/openai-media.js';

export class Noosphere {
  private config: ResolvedConfig;
  private registry: Registry;
  private tracker: UsageTracker;
  private initialized = false;

  constructor(config: NoosphereConfig = {}) {
    this.config = resolveConfig(config);
    this.registry = new Registry(this.config.discoveryCacheTTL);
    this.tracker = new UsageTracker(this.config.onUsage);
  }

  /** Register a custom provider adapter */
  registerProvider(provider: NoosphereProvider): void {
    this.registry.addProvider(provider);
  }

  // --- Generation Methods ---

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    if (!this.initialized) await this.init();
    const provider = this.resolveProviderForModality('llm', options.provider, options.model);
    if (!provider.chat) {
      throw new NoosphereError(`Provider '${provider.id}' does not support chat`, {
        code: 'INVALID_INPUT', provider: provider.id, modality: 'llm',
      });
    }

    const start = Date.now();
    try {
      const result = await this.executeWithRetry(
        'llm', provider,
        () => provider.chat!(options),
        (alt) => alt.chat ? () => alt.chat!(options) : null,
      );
      await this.trackUsage(result, options.metadata);
      return result;
    } catch (err) {
      await this.trackError('llm', provider.id, options.model, start, err, options.metadata);
      throw err;
    }
  }

  stream(options: ChatOptions): NoosphereStream {
    const self = this;
    let innerStream: NoosphereStream | undefined;
    let finalResult: NoosphereResult | undefined;
    let providerRef: NoosphereProvider | undefined;

    const ensureInit = async () => {
      if (!self.initialized) await self.init();
      if (!providerRef) {
        providerRef = self.resolveProviderForModality('llm', options.provider, options.model);
        if (!providerRef.stream) {
          throw new NoosphereError(`Provider '${providerRef.id}' does not support streaming`, {
            code: 'INVALID_INPUT', provider: providerRef.id, modality: 'llm',
          });
        }
        innerStream = providerRef.stream(options);
      }
    };

    const wrappedIterator: AsyncIterable<StreamEvent> = {
      async *[Symbol.asyncIterator]() {
        await ensureInit();
        try {
          for await (const event of innerStream!) {
            if (event.type === 'done' && event.result) {
              finalResult = event.result;
              await self.trackUsage(event.result, options.metadata);
            }
            yield event;
          }
        } catch (err) {
          await self.trackError('llm', providerRef!.id, options.model, Date.now(), err, options.metadata);
          throw err;
        }
      },
    };

    return {
      [Symbol.asyncIterator]: () => wrappedIterator[Symbol.asyncIterator](),
      result: async () => {
        if (finalResult) return finalResult;
        for await (const event of wrappedIterator) {
          if (event.type === 'done' && event.result) return event.result;
          if (event.type === 'error' && event.error) throw event.error;
        }
        throw new NoosphereError('Stream ended without result', {
          code: 'GENERATION_FAILED', provider: providerRef?.id ?? 'unknown', modality: 'llm',
        });
      },
      abort: () => innerStream?.abort(),
    };
  }

  async image(options: ImageOptions): Promise<NoosphereResult> {
    if (!this.initialized) await this.init();
    const provider = this.resolveProviderForModality('image', options.provider, options.model);
    if (!provider.image) {
      throw new NoosphereError(`Provider '${provider.id}' does not support image generation`, {
        code: 'INVALID_INPUT', provider: provider.id, modality: 'image',
      });
    }

    const start = Date.now();
    try {
      const result = await this.executeWithRetry(
        'image', provider,
        () => provider.image!(options),
        (alt) => alt.image ? () => alt.image!(options) : null,
      );
      await this.trackUsage(result, options.metadata);
      return result;
    } catch (err) {
      await this.trackError('image', provider.id, options.model, start, err, options.metadata);
      throw err;
    }
  }

  async video(options: VideoOptions): Promise<NoosphereResult> {
    if (!this.initialized) await this.init();
    const provider = this.resolveProviderForModality('video', options.provider, options.model);
    if (!provider.video) {
      throw new NoosphereError(`Provider '${provider.id}' does not support video generation`, {
        code: 'INVALID_INPUT', provider: provider.id, modality: 'video',
      });
    }

    const start = Date.now();
    try {
      const result = await this.executeWithRetry(
        'video', provider,
        () => provider.video!(options),
        (alt) => alt.video ? () => alt.video!(options) : null,
      );
      await this.trackUsage(result, options.metadata);
      return result;
    } catch (err) {
      await this.trackError('video', provider.id, options.model, start, err, options.metadata);
      throw err;
    }
  }

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    if (!this.initialized) await this.init();
    const provider = this.resolveProviderForModality('tts', options.provider, options.model);
    if (!provider.speak) {
      throw new NoosphereError(`Provider '${provider.id}' does not support TTS`, {
        code: 'INVALID_INPUT', provider: provider.id, modality: 'tts',
      });
    }

    const start = Date.now();
    try {
      const result = await this.executeWithRetry(
        'tts', provider,
        () => provider.speak!(options),
        (alt) => alt.speak ? () => alt.speak!(options) : null,
      );
      await this.trackUsage(result, options.metadata);
      return result;
    } catch (err) {
      await this.trackError('tts', provider.id, options.model, start, err, options.metadata);
      throw err;
    }
  }

  // --- Discovery Methods ---

  async getProviders(modality?: Modality): Promise<ProviderInfo[]> {
    if (!this.initialized) await this.init();
    return this.registry.getProviderInfos(modality);
  }

  async getModels(modality?: Modality): Promise<ModelInfo[]> {
    if (!this.initialized) await this.init();
    return this.registry.getModels(modality);
  }

  async getModel(provider: string, modelId: string): Promise<ModelInfo | null> {
    if (!this.initialized) await this.init();
    return this.registry.getModel(provider, modelId);
  }

  async syncModels(modality?: Modality): Promise<SyncResult> {
    if (!this.initialized) await this.init();
    return this.registry.syncAll(modality);
  }

  // --- Tracking Methods ---

  getUsage(options?: UsageQueryOptions): UsageSummary {
    return this.tracker.getSummary(options);
  }

  // --- Local Model Management ---

  async installModel(name: string): Promise<AsyncGenerator<import('./providers/ollama.js').OllamaPullProgress>> {
    if (!this.initialized) await this.init();
    const provider = this.registry.getProvider('ollama') as OllamaProvider | undefined;
    if (!provider) throw new NoosphereError('Ollama provider not available', { code: 'PROVIDER_UNAVAILABLE', provider: 'ollama', modality: 'llm' });
    return provider.pullModel(name);
  }

  async uninstallModel(name: string): Promise<void> {
    if (!this.initialized) await this.init();
    const provider = this.registry.getProvider('ollama') as OllamaProvider | undefined;
    if (!provider) throw new NoosphereError('Ollama provider not available', { code: 'PROVIDER_UNAVAILABLE', provider: 'ollama', modality: 'llm' });
    await provider.deleteModel(name);
  }

  async getHardware(): Promise<{ ollama: boolean; runningModels: import('./providers/ollama.js').OllamaRunningModel[] }> {
    if (!this.initialized) await this.init();
    const provider = this.registry.getProvider('ollama') as OllamaProvider | undefined;
    if (!provider) return { ollama: false, runningModels: [] };
    try {
      const runningModels = await provider.getRunningModels();
      return { ollama: true, runningModels };
    } catch {
      return { ollama: false, runningModels: [] };
    }
  }

  // --- Lifecycle ---

  async dispose(): Promise<void> {
    for (const provider of this.registry.getAllProviders()) {
      if (provider.dispose) {
        await provider.dispose();
      }
    }
    this.registry.clearCache();
    this.tracker.clear();
  }

  // --- Internal ---

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const { keys, local, autoDetectLocal } = this.config;

    // Register cloud providers based on available keys
    const llmKeys: Record<string, string | undefined> = {
      openai: keys.openai,
      anthropic: keys.anthropic,
      google: keys.google,
      openrouter: keys.openrouter,
      groq: keys.groq,
      mistral: keys.mistral,
      xai: keys.xai,
    };
    const hasAnyLLMKey = Object.values(llmKeys).some(Boolean);
    if (hasAnyLLMKey) {
      this.registry.addProvider(new PiAiProvider(llmKeys));
    }

    if (keys.openai) {
      this.registry.addProvider(new OpenAIMediaProvider(keys.openai));
    }

    if (keys.fal) {
      this.registry.addProvider(new FalProvider(keys.fal));
    }

    if (keys.huggingface) {
      this.registry.addProvider(new HuggingFaceProvider(keys.huggingface));
    }

    // Auto-detect local services in parallel
    if (autoDetectLocal) {
      const PING_TIMEOUT_MS = 2000;

      const pingUrl = async (url: string): Promise<boolean> => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
          try {
            const res = await fetch(url, { signal: controller.signal });
            return res.ok;
          } finally {
            clearTimeout(timer);
          }
        } catch {
          return false;
        }
      };

      const ollamaCfg = local['ollama'];
      const comfyuiCfg = local['comfyui'];
      const piperCfg = local['piper'];
      const kokoroCfg = local['kokoro'];

      await Promise.allSettled([
        // Ollama — auto-detect even without explicit config
        (async () => {
          const host = ollamaCfg?.host ?? 'http://localhost';
          const port = ollamaCfg?.port ?? 11434;
          const provider = new OllamaProvider({ host, port });
          const ok = await provider.ping();
          if (ok) {
            this.registry.addProvider(provider);
          }
        })(),
        // ComfyUI
        (async () => {
          if (comfyuiCfg?.enabled) {
            const ok = await pingUrl(`${comfyuiCfg.host}:${comfyuiCfg.port}/system_stats`);
            if (ok) {
              this.registry.addProvider(new ComfyUIProvider({ host: comfyuiCfg.host, port: comfyuiCfg.port }));
            }
          }
        })(),
        // Piper TTS
        (async () => {
          if (piperCfg?.enabled) {
            const ok = await pingUrl(`${piperCfg.host}:${piperCfg.port}/health`);
            if (ok) {
              this.registry.addProvider(new LocalTTSProvider({ id: 'piper', name: 'Piper TTS', host: piperCfg.host, port: piperCfg.port }));
            }
          }
        })(),
        // Kokoro TTS
        (async () => {
          if (kokoroCfg?.enabled) {
            const ok = await pingUrl(`${kokoroCfg.host}:${kokoroCfg.port}/health`);
            if (ok) {
              this.registry.addProvider(new LocalTTSProvider({ id: 'kokoro', name: 'Kokoro TTS', host: kokoroCfg.host, port: kokoroCfg.port }));
            }
          }
        })(),
        // HuggingFace local model catalog
        (async () => {
          this.registry.addProvider(new HfLocalProvider());
        })(),
        // Whisper local STT
        (async () => {
          const whisper = new WhisperLocalProvider();
          const ok = await whisper.ping();
          if (ok) this.registry.addProvider(whisper);
        })(),
        // AudioCraft local music generation
        (async () => {
          const audiocraft = new AudioCraftProvider();
          const ok = await audiocraft.ping();
          if (ok) this.registry.addProvider(audiocraft);
        })(),
        // Auto-detect OpenAI-compatible servers
        (async () => {
          const servers = await detectOpenAICompatServers();
          for (const server of servers) {
            this.registry.addProvider(server);
          }
        })(),
      ]);
    }
  }

  private resolveProviderForModality(modality: Modality, preferredId?: string, modelId?: string): NoosphereProvider {
    // 1. If a specific model was requested, look it up in the registry
    if (modelId && !preferredId) {
      const resolved = this.registry.resolveModel(modelId, modality);
      if (resolved) return resolved.provider;
    }

    // 2. Check defaults if no preference
    if (!preferredId) {
      const defaultCfg = (this.config.defaults as Record<string, { provider: string; model: string } | undefined>)[modality];
      if (defaultCfg) {
        preferredId = defaultCfg.provider;
      }
    }

    // 3. Resolve by provider ID (local-first, then cloud)
    const provider = this.registry.resolveProvider(modality, preferredId);
    if (!provider) {
      throw new NoosphereError(
        `No provider available for modality '${modality}'${preferredId ? ` (requested: ${preferredId})` : ''}`,
        { code: 'NO_PROVIDER', provider: preferredId ?? 'none', modality },
      );
    }
    return provider;
  }

  private async executeWithRetry<T>(
    modality: Modality,
    provider: NoosphereProvider,
    fn: () => Promise<T>,
    failoverFnFactory?: (alt: NoosphereProvider) => (() => Promise<T>) | null,
  ): Promise<T> {
    const { maxRetries, backoffMs, retryableErrors, failover } = this.config.retry;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const isNoosphereErr = err instanceof NoosphereError;
        const code = isNoosphereErr ? err.code : 'GENERATION_FAILED';

        // GENERATION_FAILED: retryable same-provider only, no cross-provider failover
        const isRetryable = retryableErrors.includes(code) || code === 'GENERATION_FAILED';
        const allowsFailover = code !== 'GENERATION_FAILED' && retryableErrors.includes(code);

        if (!isRetryable || attempt === maxRetries) {
          // Failover to another provider (only for non-GENERATION_FAILED errors)
          if (failover && allowsFailover && failoverFnFactory) {
            const altProviders = this.registry.getAllProviders()
              .filter((p) => p.id !== provider.id && p.modalities.includes(modality));
            for (const alt of altProviders) {
              try {
                const altFn = failoverFnFactory(alt);
                if (altFn) return await altFn();
              } catch {
                // Continue to next provider
              }
            }
          }
          break;
        }

        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new NoosphereError('Generation failed', {
      code: 'GENERATION_FAILED', provider: provider.id, modality,
    });
  }

  private async trackUsage(result: NoosphereResult, metadata?: Record<string, unknown>): Promise<void> {
    const event: UsageEvent = {
      modality: result.modality,
      provider: result.provider,
      model: result.model,
      cost: result.usage.cost,
      latencyMs: result.latencyMs,
      input: result.usage.input,
      output: result.usage.output,
      unit: result.usage.unit,
      timestamp: new Date().toISOString(),
      success: true,
      metadata,
    };
    await this.tracker.record(event);
  }

  private async trackError(
    modality: Modality, provider: string, model: string | undefined,
    startMs: number, err: unknown, metadata?: Record<string, unknown>,
  ): Promise<void> {
    const event: UsageEvent = {
      modality, provider, model: model ?? 'unknown',
      cost: 0, latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
      success: false,
      error: err instanceof Error ? err.message : String(err),
      metadata,
    };
    await this.tracker.record(event);
  }
}
