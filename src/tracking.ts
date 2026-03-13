import type { UsageEvent, UsageQueryOptions, UsageSummary, Modality } from './types.js';

export class UsageTracker {
  private events: UsageEvent[] = [];
  private onUsage?: (event: UsageEvent) => void | Promise<void>;

  constructor(onUsage?: (event: UsageEvent) => void | Promise<void>) {
    this.onUsage = onUsage;
  }

  async record(event: UsageEvent): Promise<void> {
    this.events.push(event);
    if (this.onUsage) {
      await this.onUsage(event);
    }
  }

  getSummary(options?: UsageQueryOptions): UsageSummary {
    let filtered = this.events;

    if (options?.since) {
      const since = new Date(options.since).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= since);
    }
    if (options?.until) {
      const until = new Date(options.until).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= until);
    }
    if (options?.provider) {
      filtered = filtered.filter((e) => e.provider === options.provider);
    }
    if (options?.modality) {
      filtered = filtered.filter((e) => e.modality === options.modality);
    }

    const byProvider: Record<string, number> = {};
    const byModality: Record<Modality, number> = { llm: 0, image: 0, video: 0, tts: 0 };
    let totalCost = 0;

    for (const event of filtered) {
      totalCost += event.cost;
      byProvider[event.provider] = (byProvider[event.provider] ?? 0) + event.cost;
      byModality[event.modality] += event.cost;
    }

    return {
      totalCost,
      totalRequests: filtered.length,
      byProvider,
      byModality,
    };
  }

  clear(): void {
    this.events = [];
  }
}
