// tests/unit/providers/comfyui.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComfyUIProvider } from '../../../src/providers/comfyui.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('ComfyUIProvider', () => {
  let provider: ComfyUIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ComfyUIProvider({ host: 'http://localhost', port: 8188 });
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('comfyui');
    expect(provider.modalities).toEqual(['image', 'video']);
    expect(provider.isLocal).toBe(true);
  });

  it('ping returns true when server responds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    expect(await provider.ping()).toBe(true);
  });

  it('ping returns false when server is down', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await provider.ping()).toBe(false);
  });

  it('listModels returns local models with cost 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ KSampler: {}, CheckpointLoaderSimple: {} }),
    });

    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    for (const m of models) {
      expect(m.local).toBe(true);
      expect(m.cost.price).toBe(0);
      expect(m.provider).toBe('comfyui');
    }
  });

  it('image queues prompt and returns result', async () => {
    // POST /prompt
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ prompt_id: 'pid-123' }),
    });
    // GET /history/pid-123 (polling)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        'pid-123': {
          outputs: {
            '9': { images: [{ filename: 'output.png', subfolder: '', type: 'output' }] },
          },
        },
      }),
    });
    // GET /view (image data)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const result = await provider.image!({
      prompt: 'a dragon',
    });

    expect(result.provider).toBe('comfyui');
    expect(result.modality).toBe('image');
    expect(result.buffer).toBeDefined();
    expect(result.usage.cost).toBe(0);
  });
});
