import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MessageStreamer } from '../../src/tools/stream/MessageStreamer.js';
import { mockChannel, mockMessage } from '../setup.js';
import type { Collection } from 'discord.js';

describe('MessageStreamer', () => {
  let channel: any;

  beforeEach(() => {
    channel = { ...mockChannel };
    jest.clearAllMocks();
  });

  it('should calculate default time range (10 days)', () => {
    const streamer = new MessageStreamer(channel, { defaultDays: 10 });
    const timeRange = (streamer as any).calculateTimeRange();

    const now = Date.now();
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

    expect(timeRange.before.getTime()).toBeGreaterThan(now - 1000);
    expect(timeRange.after.getTime()).toBeGreaterThan(tenDaysAgo - 1000);
    expect(timeRange.after.getTime()).toBeLessThan(tenDaysAgo + 1000);
  });

  it('should respect custom afterDate', () => {
    const afterDate = new Date('2026-02-01');
    const streamer = new MessageStreamer(channel, { afterDate, defaultDays: 10 });
    const timeRange = (streamer as any).calculateTimeRange();

    expect(timeRange.after).toEqual(afterDate);
  });

  it('should filter messages by time range', () => {
    const streamer = new MessageStreamer(channel, { defaultDays: 10 });

    const now = new Date();
    const inRange = mockMessage('1', 'test', new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
    const outOfRange = mockMessage('2', 'old', new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000));

    const mockCollection = new Map([
      ['1', inRange],
      ['2', outOfRange],
    ]) as any;

    const timeRange = {
      after: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      before: now,
    };

    const filtered = (streamer as any).filterByTime(mockCollection, timeRange);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('should format messages correctly', () => {
    const streamer = new MessageStreamer(channel, { defaultDays: 10 });
    const msg = mockMessage('1', 'Hello', new Date());

    const formatted = (streamer as any).formatMessage(msg);

    expect(formatted).toMatchObject({
      id: '1',
      content: 'Hello',
      author: {
        id: 'user-123',
        username: 'testuser',
        bot: false,
      },
      attachments: 0,
      embeds: 0,
      replyTo: null,
    });
  });

  it('should detect rate limit errors', () => {
    const streamer = new MessageStreamer(channel, { defaultDays: 10 });

    const rateLimitError: any = new Error('Rate limited');
    rateLimitError.httpStatus = 429;
    rateLimitError.retryAfter = 60;

    expect((streamer as any).isRateLimitError(rateLimitError)).toBe(true);

    const normalError = new Error('Normal error');
    expect((streamer as any).isRateLimitError(normalError)).toBe(false);
  });
});
