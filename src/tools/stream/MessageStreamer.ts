import { Collection, Message as DiscordMessage, TextBasedChannel } from 'discord.js';
import {
  StreamEvent,
  TimeRangeOptions,
  TimeRange,
  FormattedMessage,
  RateLimitError,
} from './types.js';

export class MessageStreamer {
  private channel: TextBasedChannel;
  private options: TimeRangeOptions;

  constructor(channel: TextBasedChannel, options: TimeRangeOptions) {
    this.channel = channel;
    this.options = options;
  }

  calculateTimeRange(): TimeRange {
    const now = new Date();
    const defaultAfter = new Date(now.getTime() - this.options.defaultDays * 24 * 60 * 60 * 1000);

    return {
      after: this.options.afterDate || defaultAfter,
      before: this.options.beforeDate || now,
    };
  }

  filterByTime(messages: Collection<string, DiscordMessage>, timeRange: TimeRange): FormattedMessage[] {
    const filtered: FormattedMessage[] = [];

    messages.forEach((msg) => {
      const msgTime = msg.createdAt.getTime();
      if (msgTime >= timeRange.after.getTime() && msgTime <= timeRange.before.getTime()) {
        filtered.push(this.formatMessage(msg));
      }
    });

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  formatMessage(msg: DiscordMessage): FormattedMessage {
    return {
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        bot: msg.author.bot,
      },
      timestamp: msg.createdAt,
      attachments: msg.attachments.size,
      embeds: msg.embeds.length,
      replyTo: msg.reference?.messageId || null,
    };
  }

  isRateLimitError(error: any): error is RateLimitError {
    return error.httpStatus === 429 || error.code === 50035;
  }

  shouldContinue(
    batch: Collection<string, DiscordMessage>,
    filtered: FormattedMessage[],
    timeRange: TimeRange
  ): boolean {
    // No more messages
    if (batch.size === 0) return false;

    // Reached time range start
    const oldestMsg = batch.last();
    if (oldestMsg && oldestMsg.createdAt.getTime() < timeRange.after.getTime()) {
      return false;
    }

    // Batch was fully filtered (all messages out of range)
    if (batch.size > 0 && filtered.length === 0) {
      return false;
    }

    return true;
  }

  async *stream(): AsyncGenerator<StreamEvent> {
    const timeRange = this.calculateTimeRange();
    const startTime = Date.now();

    let before: string | undefined;
    let total = 0;
    let batchNumber = 0;
    let lastProgressTime = Date.now();

    while (true) {
      try {
        // Fetch batch of messages
        const batch = await this.channel.messages.fetch({ limit: 100, before });

        // Filter by time range
        const filtered = this.filterByTime(batch, timeRange);

        if (filtered.length > 0) {
          total += filtered.length;
          batchNumber++;

          // Yield batch event
          yield {
            type: 'batch',
            messages: filtered,
            batchNumber,
            total,
          };

          // Yield progress event every 3 seconds
          if (Date.now() - lastProgressTime > 3000) {
            yield {
              type: 'progress',
              fetched: total,
              oldest: filtered[filtered.length - 1]?.timestamp,
              newest: filtered[0]?.timestamp,
            };
            lastProgressTime = Date.now();
          }
        }

        // Check if should continue
        if (!this.shouldContinue(batch, filtered, timeRange)) {
          break;
        }

        before = batch.last()?.id;
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          yield {
            type: 'rate_limited',
            fetched: total,
            retryAfter: error.retryAfter || 60,
          };
          break;
        }
        throw error;
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    yield {
      type: 'complete',
      totalFetched: total,
      duration: `${duration}s`,
    };
  }
}
