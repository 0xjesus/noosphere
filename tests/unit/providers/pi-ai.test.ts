// tests/unit/providers/pi-ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pi-ai before importing the provider
vi.mock('@mariozechner/pi-ai', () => ({
  setApiKey: vi.fn(),
  getProviders: vi.fn().mockReturnValue(['openai', 'ollama']),
  getModels: vi.fn().mockReturnValue([
    {
      id: 'gpt-4o',
      provider: 'openai',
      name: 'GPT-4o',
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
      input: ['text', 'image'],
      reasoning: false,
      api: 'openai-completions',
      baseUrl: 'https://api.openai.com',
    },
    {
      id: 'llama3.2:3b',
      provider: 'ollama',
      name: 'Llama 3.2 3B',
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      input: ['text'],
      reasoning: false,
      api: 'openai-completions',
      baseUrl: 'http://localhost:11434',
    },
  ]),
  complete: vi.fn().mockResolvedValue({
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello from pi-ai!' }],
    usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    model: 'gpt-4o',
    provider: 'openai',
    api: 'openai-completions',
    stopReason: 'stop',
    timestamp: Date.now(),
  }),
  stream: vi.fn().mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield { type: 'text_delta', delta: 'Hello', contentIndex: 0, partial: {} };
      yield { type: 'text_delta', delta: ' world', contentIndex: 0, partial: {} };
    },
    result: vi.fn().mockResolvedValue({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }],
      usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      model: 'gpt-4o',
      provider: 'openai',
      api: 'openai-completions',
      stopReason: 'stop',
      timestamp: Date.now(),
    }),
  }),
}));

import { PiAiProvider } from '../../../src/providers/pi-ai.js';

describe('PiAiProvider', () => {
  let provider: PiAiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PiAiProvider({
      openai: 'sk-test',
    });
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('pi-ai');
    expect(provider.modalities).toEqual(['llm']);
    expect(provider.isLocal).toBe(false);
  });

  it('listModels returns normalized ModelInfo', async () => {
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);

    const gpt = models.find((m) => m.id === 'gpt-4o');
    expect(gpt).toBeDefined();
    expect(gpt!.provider).toBe('pi-ai');
    expect(gpt!.modality).toBe('llm');
    expect(gpt!.local).toBe(false);
    expect(gpt!.cost.price).toBe(2.5);
    expect(gpt!.cost.unit).toBe('per_1m_tokens');

    const llama = models.find((m) => m.id === 'llama3.2:3b');
    expect(llama!.local).toBe(true);
    expect(llama!.cost.price).toBe(0);
  });

  it('chat calls complete and normalizes result', async () => {
    const result = await provider.chat!({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello from pi-ai!');
    expect(result.provider).toBe('pi-ai');
    expect(result.modality).toBe('llm');
    expect(result.usage.input).toBe(10);
    expect(result.usage.output).toBe(5);
  });

  it('ping returns true', async () => {
    const result = await provider.ping();
    expect(result).toBe(true);
  });
});
