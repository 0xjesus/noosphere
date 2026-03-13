import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfig } from '../../src/config.js';

describe('resolveConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when no config and no env vars', () => {
    const cfg = resolveConfig({});
    expect(cfg.autoDetectLocal).toBe(true);
    expect(cfg.discoveryCacheTTL).toBe(60);
    expect(cfg.retry.maxRetries).toBe(2);
    expect(cfg.retry.backoffMs).toBe(1000);
    expect(cfg.retry.failover).toBe(true);
    expect(cfg.timeout.llm).toBe(30000);
    expect(cfg.timeout.image).toBe(120000);
    expect(cfg.timeout.video).toBe(300000);
    expect(cfg.timeout.tts).toBe(60000);
  });

  it('reads API keys from env vars', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('FAL_KEY', 'fal-test');
    const cfg = resolveConfig({});
    expect(cfg.keys.openai).toBe('sk-test');
    expect(cfg.keys.fal).toBe('fal-test');
  });

  it('config keys override env vars', () => {
    vi.stubEnv('OPENAI_API_KEY', 'from-env');
    const cfg = resolveConfig({ keys: { openai: 'from-config' } });
    expect(cfg.keys.openai).toBe('from-config');
  });

  it('reads local service ports from env', () => {
    vi.stubEnv('OLLAMA_PORT', '9999');
    const cfg = resolveConfig({});
    expect(cfg.local.ollama.port).toBe(9999);
  });

  it('config local overrides env', () => {
    vi.stubEnv('OLLAMA_PORT', '9999');
    const cfg = resolveConfig({ local: { ollama: { port: 7777 } } });
    expect(cfg.local.ollama.port).toBe(7777);
  });

  it('resolves NOOSPHERE_AUTO_DETECT_LOCAL=false', () => {
    vi.stubEnv('NOOSPHERE_AUTO_DETECT_LOCAL', 'false');
    const cfg = resolveConfig({});
    expect(cfg.autoDetectLocal).toBe(false);
  });
});
