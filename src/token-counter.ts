// src/token-counter.ts
// Pre-request token counting for OpenAI (tiktoken) and Google (API).

import { encoding_for_model, type TiktokenModel } from 'tiktoken';

export interface TokenCountResult {
  tokens: number;
  model: string;
  provider: 'openai' | 'google' | 'anthropic' | 'unknown';
  cached?: boolean;
}

export interface TokenCountOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  provider?: string;
}

// --- OpenAI token counting (local, via tiktoken) ---

const OPENAI_MODEL_MAP: Record<string, TiktokenModel> = {
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4': 'gpt-4',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
};

function resolveOpenAIModel(model: string): TiktokenModel {
  // Exact match
  if (model in OPENAI_MODEL_MAP) return OPENAI_MODEL_MAP[model];
  // Prefix match
  for (const [prefix, tikModel] of Object.entries(OPENAI_MODEL_MAP)) {
    if (model.startsWith(prefix)) return tikModel;
  }
  // Default to gpt-4o encoding for unknown models (o1, o3, o4, gpt-5, etc.)
  return 'gpt-4o';
}

export function countTokensOpenAI(
  messages: Array<{ role: string; content: string }>,
  model = 'gpt-4o',
): number {
  const tikModel = resolveOpenAIModel(model);
  const enc = encoding_for_model(tikModel);

  let tokens = 0;
  // Every message has overhead: <|start|>role<|end|> content <|end|>
  for (const msg of messages) {
    tokens += 4; // message overhead
    tokens += enc.encode(msg.role).length;
    tokens += enc.encode(msg.content).length;
  }
  tokens += 2; // reply priming

  enc.free();
  return tokens;
}

// --- Google token counting (API call) ---

export async function countTokensGoogle(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model = 'gemini-2.5-flash',
): Promise<number> {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:countTokens?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google countTokens failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as { totalTokens: number };
  return data.totalTokens;
}

// --- Anthropic token counting (estimate: ~4 chars per token) ---

export function countTokensAnthropic(
  messages: Array<{ role: string; content: string }>,
): number {
  let chars = 0;
  for (const msg of messages) {
    chars += msg.content.length + msg.role.length;
  }
  // Anthropic averages ~4 characters per token
  return Math.ceil(chars / 4);
}

// --- Unified counter ---

export async function countTokens(
  options: TokenCountOptions,
  apiKeys?: Record<string, string>,
): Promise<TokenCountResult> {
  const model = options.model ?? 'gpt-4o';
  const provider = options.provider ?? inferProvider(model);

  if (provider === 'google' && apiKeys?.google) {
    const tokens = await countTokensGoogle(options.messages, apiKeys.google, model);
    return { tokens, model, provider: 'google' };
  }

  if (provider === 'anthropic') {
    const tokens = countTokensAnthropic(options.messages);
    return { tokens, model, provider: 'anthropic' };
  }

  // Default: OpenAI (local tiktoken, no API key needed)
  const tokens = countTokensOpenAI(options.messages, model);
  return { tokens, model, provider: 'openai' };
}

function inferProvider(model: string): 'openai' | 'google' | 'anthropic' | 'unknown' {
  if (model.startsWith('gemini') || model.startsWith('imagen')) return 'google';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  return 'unknown';
}
