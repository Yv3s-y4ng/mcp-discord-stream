import { describe, it, expect } from '@jest/globals';
import type { StreamEvent, TimeRangeOptions } from '../../src/tools/stream/types.js';

describe('Stream Types', () => {
  it('should have correct ProgressEvent shape', () => {
    const event: StreamEvent = {
      type: 'progress',
      fetched: 100,
      oldest: new Date(),
      newest: new Date(),
    };
    expect(event.type).toBe('progress');
    expect(event.fetched).toBe(100);
  });

  it('should have correct BatchEvent shape', () => {
    const event: StreamEvent = {
      type: 'batch',
      messages: [],
      batchNumber: 1,
      total: 100,
    };
    expect(event.type).toBe('batch');
    expect(event.messages).toEqual([]);
  });

  it('should have correct RateLimitedEvent shape', () => {
    const event: StreamEvent = {
      type: 'rate_limited',
      fetched: 500,
      retryAfter: 60,
    };
    expect(event.type).toBe('rate_limited');
    expect(event.retryAfter).toBe(60);
  });

  it('should have correct CompleteEvent shape', () => {
    const event: StreamEvent = {
      type: 'complete',
      totalFetched: 1523,
      duration: '45s',
    };
    expect(event.type).toBe('complete');
  });
});
