import { ForumChannel, ThreadChannel } from 'discord.js';
import { MessageStreamer } from './MessageStreamer.js';
import { StreamEvent, TimeRangeOptions, FormattedMessage } from './types.js';

export interface ForumOptions extends TimeRangeOptions {
  includeArchived?: boolean;
  archiveLimit?: number;
}

export interface ThreadResult {
  threadId: string;
  threadName: string;
  messages: FormattedMessage[];
}

export class ForumStreamer {
  private forumChannel: ForumChannel;
  private options: ForumOptions;

  constructor(forumChannel: ForumChannel, options: ForumOptions) {
    this.forumChannel = forumChannel;
    this.options = {
      ...options,
      includeArchived: options.includeArchived ?? false,
      archiveLimit: options.archiveLimit ?? 100,
    };
  }

  async getAllThreads(): Promise<ThreadChannel[]> {
    const threads: ThreadChannel[] = [];
    const seenIds = new Set<string>();

    // Fetch active threads
    const activeThreads = await this.forumChannel.threads.fetchActive();
    activeThreads.threads.forEach((thread) => {
      if (!seenIds.has(thread.id)) {
        threads.push(thread);
        seenIds.add(thread.id);
      }
    });

    // Fetch archived threads if requested
    if (this.options.includeArchived) {
      const archivedThreads = await this.forumChannel.threads.fetchArchived({
        limit: this.options.archiveLimit,
      });
      archivedThreads.threads.forEach((thread) => {
        if (!seenIds.has(thread.id)) {
          threads.push(thread);
          seenIds.add(thread.id);
        }
      });
    }

    return threads;
  }

  async *streamForum(): AsyncGenerator<StreamEvent> {
    // 1. Get all threads
    const threads = await this.getAllThreads();

    yield {
      type: 'threads_found',
      count: threads.length,
      estimated: `~${threads.length * 50} messages`,
    };

    // 2. Process each thread
    const results: ThreadResult[] = [];

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];

      yield {
        type: 'thread_progress',
        current: i + 1,
        total: threads.length,
        threadName: thread.name,
      };

      // Stream messages from this thread
      const streamer = new MessageStreamer(thread as any, this.options);
      const messages: FormattedMessage[] = [];

      for await (const event of streamer.stream()) {
        if (event.type === 'batch') {
          messages.push(...event.messages);
        } else if (event.type === 'rate_limited') {
          // Hit rate limit, return partial results
          yield {
            type: 'partial_complete',
            threadsProcessed: i,
            totalThreads: threads.length,
            retryAfter: event.retryAfter,
          };
          return;
        }
        // Ignore progress and complete events from inner streamer
      }

      results.push({
        threadId: thread.id,
        threadName: thread.name,
        messages,
      });
    }

    yield {
      type: 'complete',
      totalFetched: results.reduce((sum, r) => sum + r.messages.length, 0),
      duration: '0s', // Duration tracking will be added by handler
    };
  }
}
