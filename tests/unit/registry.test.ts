// tests/unit/registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Registry } from '../../src/registry.js';
import type { NoosphereProvider } from '../../src/providers/base.js';
import type { ModelInfo } from '../../src/types.js';

function createMockProvider(overrides: Partial<NoosphereProvider> = {}): NoosphereProvider {
  return {
    id: 'mock',
    name: 'Mock Provider',
    modalities: ['llm'],
    isLocal: false,
    ping: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([
      {
        id: 'mock-model', provider: 'mock', name: 'Mock Model',
        modality: 'llm', local: false, cost: { price: 0.01, unit: 'per_1m_tokens' },
      },
    ] satisfies ModelInfo[]),
    ...overrides,
  };
}

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(60);
  });

  it('registers a provider and lists its models', async () => {
    const provider = createMockProvider();
    registry.addProvider(provider);
    await registry.syncProvider('mock');

    const models = registry.getModels('llm');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('mock-model');
  });

  it('resolves provider for a modality', () => {
    const provider = createMockProvider();
    registry.addProvider(provider);
    const resolved = registry.resolveProvider('llm');
    expect(resolved?.id).toBe('mock');
  });

  it('prefers local provider over cloud', () => {
    const cloud = createMockProvider({ id: 'cloud', isLocal: false });
    const local = createMockProvider({ id: 'local', isLocal: true });
    registry.addProvider(cloud);
    registry.addProvider(local);
    const resolved = registry.resolveProvider('llm');
    expect(resolved?.id).toBe('local');
  });

  it('resolves specific provider by id', () => {
    const p1 = createMockProvider({ id: 'p1' });
    const p2 = createMockProvider({ id: 'p2' });
    registry.addProvider(p1);
    registry.addProvider(p2);
    const resolved = registry.resolveProvider('llm', 'p2');
    expect(resolved?.id).toBe('p2');
  });

  it('resolves model by id', async () => {
    const provider = createMockProvider();
    registry.addProvider(provider);
    await registry.syncProvider('mock');
    const result = registry.resolveModel('mock-model', 'llm');
    expect(result).not.toBeNull();
    expect(result!.provider.id).toBe('mock');
    expect(result!.model.id).toBe('mock-model');
  });

  it('returns null for unknown model', () => {
    const result = registry.resolveModel('unknown', 'llm');
    expect(result).toBeNull();
  });

  it('getProviders returns provider info', () => {
    const provider = createMockProvider();
    registry.addProvider(provider);
    const infos = registry.getProviderInfos();
    expect(infos).toHaveLength(1);
    expect(infos[0].id).toBe('mock');
  });
});
