// src/token-counter.ts
// Pre-request token counting for ALL providers.
// OpenAI/Groq/Cerebras/xAI/Mistral/OpenRouter/Ollama: tiktoken (local, instant)
// Google: countTokens API (exact)
// Anthropic: /messages/count_tokens API (exact)

import { encoding_for_model, type TiktokenModel } from 'tiktoken';

export type TokenCountProvider =
  | 'openai' | 'google' | 'anthropic' | 'mistral' | 'groq'
  | 'xai' | 'cerebras' | 'openrouter' | 'ollama' | 'unknown';

export interface TokenCountResult {
  tokens: number;
  model: string;
  provider: TokenCountProvider;
  method: 'tiktoken' | 'api' | 'estimate';
}

export interface TokenCountOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  provider?: string;
}

// --- tiktoken-based counting (OpenAI, Groq, Cerebras, xAI, Mistral, OpenRouter, Ollama) ---

const TIKTOKEN_MODEL_MAP: Record<string, TiktokenModel> = {
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4': 'gpt-4',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
};

function resolveTiktokenModel(model: string): TiktokenModel {
  if (model in TIKTOKEN_MODEL_MAP) return TIKTOKEN_MODEL_MAP[model];
  for (const [prefix, tikModel] of Object.entries(TIKTOKEN_MODEL_MAP)) {
    if (model.startsWith(prefix)) return tikModel;
  }
  // All modern models (o1, o3, o4, gpt-5, llama, mixtral, grok, etc.)
  // use cl100k_base or o200k_base — gpt-4o covers both well
  return 'gpt-4o';
}

function countWithTiktoken(
  messages: Array<{ role: string; content: string }>,
  model: string,
): number {
  const tikModel = resolveTiktokenModel(model);
  const enc = encoding_for_model(tikModel);
  let tokens = 0;
  for (const msg of messages) {
    tokens += 4; // message overhead (<|start|>role content<|end|>)
    tokens += enc.encode(msg.role).length;
    tokens += enc.encode(msg.content).length;
  }
  tokens += 2; // reply priming
  enc.free();
  return tokens;
}

// --- OpenAI (tiktoken, local, instant) ---

export function countTokensOpenAI(
  messages: Array<{ role: string; content: string }>,
  model = 'gpt-4o',
): number {
  return countWithTiktoken(messages, model);
}

// --- Google (API, exact) ---

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

// --- Anthropic (API, exact) ---

export async function countTokensAnthropic(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model = 'claude-sonnet-4-20250514',
): Promise<number> {
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  const systemPrompt = messages.find((m) => m.role === 'system')?.content;

  const body: Record<string, unknown> = {
    model,
    messages: anthropicMessages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Anthropic countTokens failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as { input_tokens: number };
  return data.input_tokens;
}

// --- Groq (tiktoken — runs llama, mixtral, gemma which use similar BPE) ---

export function countTokensGroq(
  messages: Array<{ role: string; content: string }>,
  model = 'llama-3.3-70b-versatile',
): number {
  return countWithTiktoken(messages, model);
}

// --- Mistral (tiktoken — Mistral uses SentencePiece BPE, tiktoken is a close approximation) ---

export function countTokensMistral(
  messages: Array<{ role: string; content: string }>,
  model = 'mistral-large-latest',
): number {
  return countWithTiktoken(messages, model);
}

// --- xAI / Grok (tiktoken — Grok uses similar tokenization) ---

export function countTokensXai(
  messages: Array<{ role: string; content: string }>,
  model = 'grok-3',
): number {
  return countWithTiktoken(messages, model);
}

// --- Cerebras (tiktoken — runs llama models) ---

export function countTokensCerebras(
  messages: Array<{ role: string; content: string }>,
  model = 'llama-3.3-70b',
): number {
  return countWithTiktoken(messages, model);
}

// --- OpenRouter (tiktoken — routes to various models, all use BPE variants) ---

export function countTokensOpenRouter(
  messages: Array<{ role: string; content: string }>,
  model = 'openai/gpt-4o',
): number {
  return countWithTiktoken(messages, model);
}

// --- Ollama (tiktoken — local models use llama/qwen/gemma tokenizers, tiktoken is close) ---

export function countTokensOllama(
  messages: Array<{ role: string; content: string }>,
  model = 'llama3.2',
): number {
  return countWithTiktoken(messages, model);
}

// --- Unified counter ---

const PROVIDER_MODEL_PREFIXES: Array<{ prefixes: string[]; provider: TokenCountProvider }> = [
  { prefixes: ['gemini', 'imagen', 'veo'], provider: 'google' },
  { prefixes: ['claude'], provider: 'anthropic' },
  { prefixes: ['gpt-', 'o1', 'o3', 'o4', 'chatgpt', 'dall-e', 'gpt-image', 'tts-', 'whisper', 'sora'], provider: 'openai' },
  { prefixes: ['grok'], provider: 'xai' },
  { prefixes: ['mistral', 'mixtral', 'codestral', 'ministral'], provider: 'mistral' },
  { prefixes: ['llama', 'gemma', 'qwen', 'deepseek', 'phi'], provider: 'groq' },
];

function inferProvider(model: string): TokenCountProvider {
  const lower = model.toLowerCase();
  for (const { prefixes, provider } of PROVIDER_MODEL_PREFIXES) {
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix)) return provider;
    }
  }
  return 'unknown';
}

export async function countTokens(
  options: TokenCountOptions,
  apiKeys?: Record<string, string>,
): Promise<TokenCountResult> {
  const model = options.model ?? 'gpt-4o';
  const provider = (options.provider as TokenCountProvider) ?? inferProvider(model);

  // Google: exact via API
  if (provider === 'google' && apiKeys?.google) {
    const tokens = await countTokensGoogle(options.messages, apiKeys.google, model);
    return { tokens, model, provider: 'google', method: 'api' };
  }

  // Anthropic: exact via API
  if (provider === 'anthropic' && apiKeys?.anthropic) {
    const tokens = await countTokensAnthropic(options.messages, apiKeys.anthropic, model);
    return { tokens, model, provider: 'anthropic', method: 'api' };
  }

  // All others: tiktoken (local, instant)
  const tokens = countWithTiktoken(options.messages, model);
  const resolvedProvider: TokenCountProvider = provider === 'unknown' ? 'openai' : provider;
  return {
    tokens,
    model,
    provider: resolvedProvider,
    method: provider === 'openai' ? 'tiktoken' : 'tiktoken',
  };
}
