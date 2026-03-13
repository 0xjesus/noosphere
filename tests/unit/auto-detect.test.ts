// tests/unit/auto-detect.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so these refs are available inside vi.mock factories (which are hoisted)
const { MockPiAi, MockFal, MockComfyUI, MockLocalTTS, MockHf } = vi.hoisted(() => {
  const MockPiAi = vi.fn().mockReturnValue({
    id: 'pi-ai', name: 'pi-ai', modalities: ['llm'], isLocal: false,
    ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
  });
  const MockFal = vi.fn().mockReturnValue({
    id: 'fal', name: 'fal', modalities: ['image', 'video', 'tts'], isLocal: false,
    ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
  });
  const MockHf = vi.fn().mockReturnValue({
    id: 'huggingface', name: 'hf', modalities: ['llm', 'image', 'tts'], isLocal: false,
    ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
  });
  const MockComfyUI = vi.fn().mockReturnValue({
    id: 'comfyui', name: 'ComfyUI', modalities: ['image', 'video'], isLocal: true,
    ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
  });
  const MockLocalTTS = vi.fn().mockReturnValue({
    id: 'piper', name: 'Piper', modalities: ['tts'], isLocal: true,
    ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
  });
  return { MockPiAi, MockFal, MockComfyUI, MockLocalTTS, MockHf };
});

vi.mock('../../src/providers/pi-ai.js', () => ({ PiAiProvider: MockPiAi }));
vi.mock('../../src/providers/fal.js', () => ({ FalProvider: MockFal }));
vi.mock('../../src/providers/comfyui.js', () => ({ ComfyUIProvider: MockComfyUI }));
vi.mock('../../src/providers/local-tts.js', () => ({ LocalTTSProvider: MockLocalTTS }));
vi.mock('../../src/providers/huggingface.js', () => ({ HuggingFaceProvider: MockHf }));

import { Noosphere } from '../../src/noosphere.js';

describe('Noosphere auto-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values after clearAllMocks resets them
    MockPiAi.mockReturnValue({
      id: 'pi-ai', name: 'pi-ai', modalities: ['llm'], isLocal: false,
      ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
    });
    MockFal.mockReturnValue({
      id: 'fal', name: 'fal', modalities: ['image', 'video', 'tts'], isLocal: false,
      ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
    });
    MockHf.mockReturnValue({
      id: 'huggingface', name: 'hf', modalities: ['llm', 'image', 'tts'], isLocal: false,
      ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
    });
    MockComfyUI.mockReturnValue({
      id: 'comfyui', name: 'ComfyUI', modalities: ['image', 'video'], isLocal: true,
      ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
    });
    MockLocalTTS.mockReturnValue({
      id: 'piper', name: 'Piper', modalities: ['tts'], isLocal: true,
      ping: vi.fn(), listModels: vi.fn().mockResolvedValue([]),
    });
    // Default: fetch rejects (no local services)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers pi-ai when OPENAI_API_KEY env var is set', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders(); // triggers init()

    expect(MockPiAi).toHaveBeenCalledTimes(1);
    expect(MockPiAi).toHaveBeenCalledWith(
      expect.objectContaining({ openai: 'sk-test-openai' }),
    );
  });

  it('registers pi-ai when ANTHROPIC_API_KEY env var is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-anthropic');

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();

    expect(MockPiAi).toHaveBeenCalledTimes(1);
    expect(MockPiAi).toHaveBeenCalledWith(
      expect.objectContaining({ anthropic: 'sk-test-anthropic' }),
    );
  });

  it('registers fal when FAL_KEY env var is set', async () => {
    vi.stubEnv('FAL_KEY', 'fal-test-key');

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();

    expect(MockFal).toHaveBeenCalledTimes(1);
    expect(MockFal).toHaveBeenCalledWith('fal-test-key');
  });

  it('registers huggingface when HUGGINGFACE_TOKEN env var is set', async () => {
    vi.stubEnv('HUGGINGFACE_TOKEN', 'hf-test-token');

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();

    expect(MockHf).toHaveBeenCalledTimes(1);
    expect(MockHf).toHaveBeenCalledWith('hf-test-token');
  });

  it('does not register providers without keys (autoDetectLocal: false)', async () => {
    // No env vars set for any keys
    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();

    expect(MockPiAi).not.toHaveBeenCalled();
    expect(MockFal).not.toHaveBeenCalled();
    expect(MockHf).not.toHaveBeenCalled();
    expect(MockComfyUI).not.toHaveBeenCalled();
    expect(MockLocalTTS).not.toHaveBeenCalled();
  });

  it('does not ping local services when autoDetectLocal is false', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('should not be called'));
    vi.stubGlobal('fetch', fetchMock);

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockComfyUI).not.toHaveBeenCalled();
    expect(MockLocalTTS).not.toHaveBeenCalled();
  });

  it('does not register local services when pings fail', async () => {
    // fetch already mocked to reject in beforeEach
    const noo = new Noosphere({ autoDetectLocal: true });
    await noo.getProviders();

    expect(MockComfyUI).not.toHaveBeenCalled();
    expect(MockLocalTTS).not.toHaveBeenCalled();
  });

  it('init() is idempotent — calling getProviders() twice does not double-register', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');

    const noo = new Noosphere({ autoDetectLocal: false });
    await noo.getProviders();
    await noo.getProviders();

    // PiAiProvider constructor called only once
    expect(MockPiAi).toHaveBeenCalledTimes(1);
  });

  it('accepts keys from config directly (bypasses env)', async () => {
    const noo = new Noosphere({
      autoDetectLocal: false,
      keys: { openai: 'direct-openai-key', fal: 'direct-fal-key' },
    });
    await noo.getProviders();

    expect(MockPiAi).toHaveBeenCalledWith(expect.objectContaining({ openai: 'direct-openai-key' }));
    expect(MockFal).toHaveBeenCalledWith('direct-fal-key');
  });
});
