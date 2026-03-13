import { describe, it, expect } from 'vitest';
import { NoosphereError } from '../../src/errors.js';

describe('NoosphereError', () => {
  it('creates error with all fields', () => {
    const cause = new Error('upstream');
    const err = new NoosphereError('Connection refused', {
      code: 'PROVIDER_UNAVAILABLE',
      provider: 'fal',
      modality: 'image',
      model: 'flux-2-pro',
      cause,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NoosphereError);
    expect(err.message).toBe('Connection refused');
    expect(err.code).toBe('PROVIDER_UNAVAILABLE');
    expect(err.provider).toBe('fal');
    expect(err.modality).toBe('image');
    expect(err.model).toBe('flux-2-pro');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('NoosphereError');
  });

  it('is retryable for PROVIDER_UNAVAILABLE', () => {
    const err = new NoosphereError('down', {
      code: 'PROVIDER_UNAVAILABLE', provider: 'fal', modality: 'image',
    });
    expect(err.isRetryable()).toBe(true);
  });

  it('is NOT retryable for AUTH_FAILED', () => {
    const err = new NoosphereError('bad key', {
      code: 'AUTH_FAILED', provider: 'fal', modality: 'image',
    });
    expect(err.isRetryable()).toBe(false);
  });
});
