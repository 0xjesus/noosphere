import { describe, it, expect, vi } from 'vitest';
import { UsageTracker } from '../../src/tracking.js';

describe('UsageTracker', () => {
  it('records events and computes totals', () => {
    const tracker = new UsageTracker();
    tracker.record({
      modality: 'llm', provider: 'pi-ai', model: 'gpt-4o',
      cost: 0.05, latencyMs: 200, input: 100, output: 50,
      unit: 'tokens', timestamp: '2026-03-12T10:00:00Z', success: true,
    });
    tracker.record({
      modality: 'image', provider: 'fal', model: 'flux-2-pro',
      cost: 0.10, latencyMs: 3000,
      timestamp: '2026-03-12T10:01:00Z', success: true,
    });

    const usage = tracker.getSummary();
    expect(usage.totalCost).toBeCloseTo(0.15);
    expect(usage.totalRequests).toBe(2);
    expect(usage.byProvider['pi-ai']).toBeCloseTo(0.05);
    expect(usage.byProvider['fal']).toBeCloseTo(0.10);
    expect(usage.byModality.llm).toBeCloseTo(0.05);
    expect(usage.byModality.image).toBeCloseTo(0.10);
  });

  it('filters by since/until', () => {
    const tracker = new UsageTracker();
    tracker.record({
      modality: 'llm', provider: 'pi-ai', model: 'gpt-4o',
      cost: 0.05, latencyMs: 200, timestamp: '2026-03-10T10:00:00Z', success: true,
    });
    tracker.record({
      modality: 'llm', provider: 'pi-ai', model: 'gpt-4o',
      cost: 0.10, latencyMs: 200, timestamp: '2026-03-12T10:00:00Z', success: true,
    });

    const usage = tracker.getSummary({ since: '2026-03-11' });
    expect(usage.totalCost).toBeCloseTo(0.10);
    expect(usage.totalRequests).toBe(1);
  });

  it('filters by provider', () => {
    const tracker = new UsageTracker();
    tracker.record({
      modality: 'llm', provider: 'pi-ai', model: 'gpt-4o',
      cost: 0.05, latencyMs: 200, timestamp: '2026-03-12T10:00:00Z', success: true,
    });
    tracker.record({
      modality: 'image', provider: 'fal', model: 'flux',
      cost: 0.10, latencyMs: 200, timestamp: '2026-03-12T10:00:00Z', success: true,
    });

    const usage = tracker.getSummary({ provider: 'fal' });
    expect(usage.totalRequests).toBe(1);
    expect(usage.totalCost).toBeCloseTo(0.10);
  });

  it('calls onUsage callback', async () => {
    const cb = vi.fn();
    const tracker = new UsageTracker(cb);
    const event = {
      modality: 'llm' as const, provider: 'pi-ai', model: 'gpt-4o',
      cost: 0.05, latencyMs: 200, timestamp: '2026-03-12T10:00:00Z', success: true,
    };
    await tracker.record(event);
    expect(cb).toHaveBeenCalledWith(event);
  });
});
