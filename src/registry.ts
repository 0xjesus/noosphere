// src/registry.ts
import type { Modality, ModelInfo, ProviderInfo, SyncResult } from './types.js';
import type { NoosphereProvider } from './providers/base.js';

interface CachedModels {
  models: ModelInfo[];
  syncedAt: number;
}

export class Registry {
  private providers = new Map<string, NoosphereProvider>();
  private modelCache = new Map<string, CachedModels>(); // providerId -> cached models
  private cacheTTLMs: number;

  constructor(cacheTTLMinutes: number) {
    this.cacheTTLMs = cacheTTLMinutes * 60 * 1000;
  }

  addProvider(provider: NoosphereProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): NoosphereProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): NoosphereProvider[] {
    return Array.from(this.providers.values());
  }

  resolveProvider(modality: Modality, preferredId?: string): NoosphereProvider | null {
    if (preferredId) {
      const p = this.providers.get(preferredId);
      if (p && p.modalities.includes(modality)) return p;
      return null;
    }

    // Priority: local first, then cloud
    let bestCloud: NoosphereProvider | null = null;
    for (const p of this.providers.values()) {
      if (!p.modalities.includes(modality)) continue;
      if (p.isLocal) return p;
      if (!bestCloud) bestCloud = p;
    }
    return bestCloud;
  }

  resolveModel(
    modelId: string,
    modality: Modality,
  ): { provider: NoosphereProvider; model: ModelInfo } | null {
    for (const [providerId, cached] of this.modelCache) {
      const model = cached.models.find(
        (m) => m.id === modelId && m.modality === modality,
      );
      if (model) {
        const provider = this.providers.get(providerId);
        if (provider) return { provider, model };
      }
    }
    return null;
  }

  getModels(modality?: Modality): ModelInfo[] {
    const all: ModelInfo[] = [];
    for (const cached of this.modelCache.values()) {
      for (const model of cached.models) {
        if (!modality || model.modality === modality) {
          all.push(model);
        }
      }
    }
    return all;
  }

  getModel(provider: string, modelId: string): ModelInfo | null {
    const cached = this.modelCache.get(provider);
    return cached?.models.find((m) => m.id === modelId) ?? null;
  }

  async syncProvider(providerId: string): Promise<number> {
    const provider = this.providers.get(providerId);
    if (!provider) return 0;

    const models = await provider.listModels();
    this.modelCache.set(providerId, { models, syncedAt: Date.now() });
    return models.length;
  }

  async syncAll(): Promise<SyncResult> {
    const byProvider: Record<string, number> = {};
    const errors: string[] = [];
    let synced = 0;

    for (const provider of this.providers.values()) {
      try {
        const count = await this.syncProvider(provider.id);
        byProvider[provider.id] = count;
        synced += count;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.id}: ${msg}`);
        byProvider[provider.id] = 0;
      }
    }

    return { synced, byProvider, errors };
  }

  isCacheStale(providerId: string): boolean {
    const cached = this.modelCache.get(providerId);
    if (!cached) return true;
    return Date.now() - cached.syncedAt > this.cacheTTLMs;
  }

  clearCache(): void {
    this.modelCache.clear();
  }

  getProviderInfos(modality?: Modality): ProviderInfo[] {
    const infos: ProviderInfo[] = [];
    for (const provider of this.providers.values()) {
      if (modality && !provider.modalities.includes(modality)) continue;
      const cached = this.modelCache.get(provider.id);
      infos.push({
        id: provider.id,
        name: provider.name,
        modalities: provider.modalities,
        local: provider.isLocal,
        status: 'online', // ping-based status is set externally
        modelCount: cached?.models.length ?? 0,
      });
    }
    return infos;
  }
}
