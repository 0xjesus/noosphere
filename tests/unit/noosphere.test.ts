// tests/unit/noosphere.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all provider modules to prevent real imports during init()
vi.mock('../../src/providers/pi-ai.js', () => ({ PiAiProvider: vi.fn() }));
vi.mock('../../src/providers/fal.js', () => ({ FalProvider: vi.fn() }));
vi.mock('../../src/providers/comfyui.js', () => ({ ComfyUIProvider: vi.fn() }));
vi.mock('../../src/providers/local-tts.js', () => ({ LocalTTSProvider: vi.fn() }));
vi.mock('../../src/providers/huggingface.js', () => ({ HuggingFaceProvider: vi.fn() }));

import { Noosphere } from '../../src/noosphere.js';
import type { NoosphereProvider } from '../../src/providers/base.js';
import type { ModelInfo, NoosphereResult } from '../../src/types.js';

const mockResult: NoosphereResult = {
  content: 'Hello!',
  provider: 'mock',
  model: 'mock-model',
  modality: 'llm',
  latencyMs: 100,
  usage: { cost: 0.001, input: 10, output: 5, unit: 'tokens' },
};

function createMockLLMProvider(): NoosphereProvider {
  return {
    id: 'mock',
    name: 'Mock',
    modalities: ['llm'],
    isLocal: false,
    ping: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([
      {
        id: 'mock-model', provider: 'mock', name: 'Mock', modality: 'llm',
        local: false, cost: { price: 0.001, unit: 'per_1m_tokens' },
      },
    ] satisfies ModelInfo[]),
    chat: vi.fn().mockResolvedValue(mockResult),
  };
}

describe('Noosphere', () => {
  let noo: Noosphere;
  let mockProvider: NoosphereProvider;

  beforeEach(async () => {
    noo = new Noosphere({ autoDetectLocal: false });
    mockProvider = createMockLLMProvider();
    noo.registerProvider(mockProvider);
  });

  it('chat delegates to provider', async () => {
    const result = await noo.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      provider: 'mock',
    });
    expect(result.content).toBe('Hello!');
    expect(result.provider).toBe('mock');
    expect(mockProvider.chat).toHaveBeenCalled();
  });

  it('tracks usage after chat', async () => {
    const onUsage = vi.fn();
    noo = new Noosphere({ autoDetectLocal: false, onUsage });
    noo.registerProvider(mockProvider);

    await noo.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      provider: 'mock',
    });
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'mock', modality: 'llm', cost: 0.001 }),
    );
  });

  it('getUsage returns accumulated stats', async () => {
    await noo.chat({ messages: [{ role: 'user', content: 'Hi' }], provider: 'mock' });
    await noo.chat({ messages: [{ role: 'user', content: 'Hi' }], provider: 'mock' });
    const usage = noo.getUsage();
    expect(usage.totalRequests).toBe(2);
    expect(usage.totalCost).toBeCloseTo(0.002);
  });

  it('throws NO_PROVIDER when no provider available', async () => {
    const emptyNoo = new Noosphere({ autoDetectLocal: false });
    await expect(
      emptyNoo.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('No provider available');
  });

  it('throws when provider does not support modality method', async () => {
    // mockProvider has no image() method
    await expect(
      noo.image({ prompt: 'test', provider: 'mock' }),
    ).rejects.toThrow();
  });

  it('syncModels syncs all providers', async () => {
    const result = await noo.syncModels();
    expect(result.synced).toBe(1);
    expect(result.byProvider['mock']).toBe(1);
  });

  it('getModels returns discovered models', async () => {
    await noo.syncModels();
    const models = await noo.getModels('llm');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('mock-model');
  });

  it('getProviders returns provider list', async () => {
    const providers = await noo.getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('mock');
  });

  it('dispose cleans up', async () => {
    await expect(noo.dispose()).resolves.toBeUndefined();
  });
});
