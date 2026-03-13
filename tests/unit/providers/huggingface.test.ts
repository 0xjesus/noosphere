// tests/unit/providers/huggingface.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@huggingface/inference', () => ({
  HfInference: vi.fn().mockImplementation(() => ({
    textToImage: vi.fn().mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])])),
    textToSpeech: vi.fn().mockResolvedValue(new Blob([new Uint8Array([4, 5, 6])])),
    chatCompletion: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'HF response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  })),
}));

import { HuggingFaceProvider } from '../../../src/providers/huggingface.js';

describe('HuggingFaceProvider', () => {
  let provider: HuggingFaceProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new HuggingFaceProvider('hf-test-token');
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('huggingface');
    expect(provider.modalities).toEqual(['image', 'tts', 'llm']);
    expect(provider.isLocal).toBe(false);
  });

  it('image calls textToImage', async () => {
    const result = await provider.image!({ prompt: 'a cat' });
    expect(result.provider).toBe('huggingface');
    expect(result.modality).toBe('image');
    expect(result.buffer).toBeDefined();
  });

  it('speak calls textToSpeech', async () => {
    const result = await provider.speak!({ text: 'Hello' });
    expect(result.provider).toBe('huggingface');
    expect(result.modality).toBe('tts');
    expect(result.buffer).toBeDefined();
  });

  it('chat calls chatCompletion', async () => {
    const result = await provider.chat!({
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(result.content).toBe('HF response');
    expect(result.provider).toBe('huggingface');
  });
});
