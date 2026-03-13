// tests/unit/providers/local-tts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalTTSProvider } from '../../../src/providers/local-tts.js';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('LocalTTSProvider', () => {
  let provider: LocalTTSProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalTTSProvider({
      id: 'piper',
      name: 'Piper TTS',
      host: 'http://localhost',
      port: 5500,
    });
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('piper');
    expect(provider.modalities).toEqual(['tts']);
    expect(provider.isLocal).toBe(true);
  });

  it('ping returns true when server responds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await provider.ping()).toBe(true);
  });

  it('listModels fetches voices from server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 'es_MX-claude-high', name: 'Spanish Mexico Claude' },
        { id: 'en_US-lessac-medium', name: 'English US Lessac' },
      ]),
    });

    const models = await provider.listModels();
    expect(models).toHaveLength(2);
    expect(models[0].local).toBe(true);
    expect(models[0].cost.price).toBe(0);
    expect(models[0].modality).toBe('tts');
  });

  it('speak calls OpenAI-compatible endpoint', async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(audioBytes.buffer),
      headers: new Map([['content-type', 'audio/mp3']]),
    });

    const result = await provider.speak!({
      text: 'Hello world',
      voice: 'en_US-lessac-medium',
    });

    expect(result.provider).toBe('piper');
    expect(result.modality).toBe('tts');
    expect(result.buffer).toBeDefined();
    expect(result.usage.cost).toBe(0);
    expect(result.usage.input).toBe(11); // "Hello world".length
  });
});
