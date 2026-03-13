import type { Modality, NoosphereErrorCode } from './types.js';

const RETRYABLE_CODES: Set<NoosphereErrorCode> = new Set([
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'TIMEOUT',
  'GENERATION_FAILED',
]);

export class NoosphereError extends Error {
  readonly code: NoosphereErrorCode;
  readonly provider: string;
  readonly modality: Modality;
  readonly model?: string;
  override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: NoosphereErrorCode;
      provider: string;
      modality: Modality;
      model?: string;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'NoosphereError';
    this.code = options.code;
    this.provider = options.provider;
    this.modality = options.modality;
    this.model = options.model;
    this.cause = options.cause;
  }

  isRetryable(): boolean {
    return RETRYABLE_CODES.has(this.code);
  }
}
