# Discord MCP Streaming Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 streaming tools to mcp-discord for full historical message retrieval with real-time progress feedback

**Architecture:** Create async generator-based streamers in `src/tools/stream/` directory. Each streamer yields progress/batch/complete events. New tools wrap streamers and return formatted responses via MCP.

**Tech Stack:** TypeScript, Discord.js 14.19.3, Zod schemas, MCP SDK 1.11.0, Jest for testing

---

## Task 1: Set Up Testing Framework

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `tests/setup.ts`
- Create: `tests/__mocks__/discord.js.ts`

**Step 1: Install Jest dependencies**

```bash
npm install --save-dev jest @types/jest ts-jest @jest/globals
```

**Step 2: Create Jest configuration**

Create `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
  ],
};
```

**Step 3: Create test setup file**

Create `tests/setup.ts`:

```typescript
// Test utilities and mocks setup
export const mockClient = {
  isReady: () => true,
  guilds: {
    fetch: jest.fn(),
  },
  channels: {
    fetch: jest.fn(),
  },
};

export const mockChannel = {
  id: 'test-channel-123',
  messages: {
    fetch: jest.fn(),
  },
  isTextBased: () => true,
};

export const mockMessage = (id: string, content: string, createdAt: Date) => ({
  id,
  content,
  author: {
    id: 'user-123',
    username: 'testuser',
    bot: false,
  },
  createdAt,
  attachments: new Map(),
  embeds: [],
  reference: null,
});
```

**Step 4: Update package.json test script**

Modify `package.json` line 11:

```json
"test": "NODE_OPTIONS=--experimental-vm-modules jest",
"test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
"test:coverage": "NODE_OPTIONS=--experimental-vm-modules jest --coverage"
```

**Step 5: Verify test setup**

Create `tests/example.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';

describe('Test Framework', () => {
  it('should run tests', () => {
    expect(true).toBe(true);
  });
});
```

Run: `npm test`
Expected: PASS with "Test Framework > should run tests"

**Step 6: Commit**

```bash
git add package.json jest.config.js tests/
git commit -m "chore: set up Jest testing framework

Add Jest with TypeScript ESM support for testing streaming tools.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create Stream Types and Utilities

**Files:**
- Create: `src/tools/stream/types.ts`
- Create: `tests/stream/types.test.ts`

**Step 1: Write type definitions test**

Create `tests/stream/types.test.ts`:

```typescript
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
```

Run: `npm test`
Expected: FAIL with "Cannot find module '../../src/tools/stream/types.js'"

**Step 2: Create type definitions**

Create `src/tools/stream/types.ts`:

```typescript
import { Message as DiscordMessage, TextBasedChannel, ThreadChannel } from 'discord.js';

export interface TimeRangeOptions {
  afterDate?: Date;
  beforeDate?: Date;
  defaultDays: number;
}

export interface TimeRange {
  after: Date;
  before: Date;
}

export interface FormattedMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    bot: boolean;
  };
  timestamp: Date;
  attachments: number;
  embeds: number;
  replyTo: string | null;
}

export type ProgressEvent = {
  type: 'progress';
  fetched: number;
  oldest?: Date;
  newest?: Date;
};

export type BatchEvent = {
  type: 'batch';
  messages: FormattedMessage[];
  batchNumber: number;
  total: number;
};

export type RateLimitedEvent = {
  type: 'rate_limited';
  fetched: number;
  retryAfter: number;
};

export type CompleteEvent = {
  type: 'complete';
  totalFetched: number;
  duration: string;
};

export type ThreadsFoundEvent = {
  type: 'threads_found';
  count: number;
  estimated: string;
};

export type ThreadProgressEvent = {
  type: 'thread_progress';
  current: number;
  total: number;
  threadName: string;
};

export type PartialCompleteEvent = {
  type: 'partial_complete';
  threadsProcessed: number;
  totalThreads: number;
  retryAfter: number;
};

export type StreamEvent =
  | ProgressEvent
  | BatchEvent
  | RateLimitedEvent
  | CompleteEvent
  | ThreadsFoundEvent
  | ThreadProgressEvent
  | PartialCompleteEvent;

export interface RateLimitError extends Error {
  httpStatus?: number;
  retryAfter?: number;
}
```

**Step 3: Run test to verify it passes**

Run: `npm test tests/stream/types.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/stream/types.ts tests/stream/types.test.ts
git commit -m "feat: add streaming types and interfaces

Define TypeScript types for stream events and time range options.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create MessageStreamer Core Logic

**Files:**
- Create: `src/tools/stream/MessageStreamer.ts`
- Create: `tests/stream/MessageStreamer.test.ts`

**Step 1: Write MessageStreamer tests**

Create `tests/stream/MessageStreamer.test.ts`:

```typescript
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
```

Run: `npm test tests/stream/MessageStreamer.test.ts`
Expected: FAIL with "Cannot find module '../../src/tools/stream/MessageStreamer.js'"

**Step 2: Implement MessageStreamer**

Create `src/tools/stream/MessageStreamer.ts`:

```typescript
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
```

**Step 3: Run tests**

Run: `npm test tests/stream/MessageStreamer.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/stream/MessageStreamer.ts tests/stream/MessageStreamer.test.ts
git commit -m "feat: implement MessageStreamer core logic

Add async generator for streaming channel messages with time filtering
and rate limit handling.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create ForumStreamer Core Logic

**Files:**
- Create: `src/tools/stream/ForumStreamer.ts`
- Create: `tests/stream/ForumStreamer.test.ts`

**Step 1: Write ForumStreamer tests**

Create `tests/stream/ForumStreamer.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ForumStreamer } from '../../src/tools/stream/ForumStreamer.js';
import { ChannelType } from 'discord.js';

describe('ForumStreamer', () => {
  let mockForumChannel: any;

  beforeEach(() => {
    mockForumChannel = {
      id: 'forum-123',
      type: ChannelType.GuildForum,
      threads: {
        fetchActive: jest.fn(),
        fetchArchived: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  it('should fetch active threads', async () => {
    const mockThreads = new Map([
      ['thread-1', { id: 'thread-1', name: 'Thread 1', messages: { fetch: jest.fn() } }],
      ['thread-2', { id: 'thread-2', name: 'Thread 2', messages: { fetch: jest.fn() } }],
    ]);

    mockForumChannel.threads.fetchActive.mockResolvedValue({ threads: mockThreads });
    mockForumChannel.threads.fetchArchived.mockResolvedValue({ threads: new Map() });

    const streamer = new ForumStreamer(mockForumChannel, { defaultDays: 10 });
    const threads = await (streamer as any).getAllThreads();

    expect(threads).toHaveLength(2);
    expect(threads[0].id).toBe('thread-1');
  });

  it('should fetch archived threads when requested', async () => {
    const activeThreads = new Map([
      ['thread-1', { id: 'thread-1', name: 'Active' }],
    ]);
    const archivedThreads = new Map([
      ['thread-2', { id: 'thread-2', name: 'Archived' }],
    ]);

    mockForumChannel.threads.fetchActive.mockResolvedValue({ threads: activeThreads });
    mockForumChannel.threads.fetchArchived.mockResolvedValue({ threads: archivedThreads });

    const streamer = new ForumStreamer(mockForumChannel, { defaultDays: 10, includeArchived: true });
    const threads = await (streamer as any).getAllThreads();

    expect(threads).toHaveLength(2);
    expect(mockForumChannel.threads.fetchArchived).toHaveBeenCalled();
  });

  it('should not fetch archived threads by default', async () => {
    const activeThreads = new Map([
      ['thread-1', { id: 'thread-1', name: 'Active' }],
    ]);

    mockForumChannel.threads.fetchActive.mockResolvedValue({ threads: activeThreads });

    const streamer = new ForumStreamer(mockForumChannel, { defaultDays: 10 });
    const threads = await (streamer as any).getAllThreads();

    expect(threads).toHaveLength(1);
    expect(mockForumChannel.threads.fetchArchived).not.toHaveBeenCalled();
  });

  it('should deduplicate threads', async () => {
    const duplicateThread = { id: 'thread-1', name: 'Duplicate' };
    const activeThreads = new Map([['thread-1', duplicateThread]]);
    const archivedThreads = new Map([['thread-1', duplicateThread]]);

    mockForumChannel.threads.fetchActive.mockResolvedValue({ threads: activeThreads });
    mockForumChannel.threads.fetchArchived.mockResolvedValue({ threads: archivedThreads });

    const streamer = new ForumStreamer(mockForumChannel, { defaultDays: 10, includeArchived: true });
    const threads = await (streamer as any).getAllThreads();

    expect(threads).toHaveLength(1);
  });
});
```

Run: `npm test tests/stream/ForumStreamer.test.ts`
Expected: FAIL with "Cannot find module '../../src/tools/stream/ForumStreamer.js'"

**Step 2: Implement ForumStreamer**

Create `src/tools/stream/ForumStreamer.ts`:

```typescript
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
      const streamer = new MessageStreamer(thread, this.options);
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
```

**Step 3: Run tests**

Run: `npm test tests/stream/ForumStreamer.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/stream/ForumStreamer.ts tests/stream/ForumStreamer.test.ts
git commit -m "feat: implement ForumStreamer for forum archiving

Add async generator for streaming all threads in a forum with progress
updates and rate limit handling.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add Streaming Schemas

**Files:**
- Modify: `src/schemas.ts`

**Step 1: Add new schemas for streaming tools**

Edit `src/schemas.ts`, add after line 100:

```typescript
// Streaming tool schemas
export const ReadMessagesStreamSchema = z.object({
  channelId: z.string(),
  afterDate: z.string().optional(),
  beforeDate: z.string().optional(),
});

export const ReadMultipleChannelsSchema = z.object({
  channelIds: z.array(z.string()).min(1).max(10),
  afterDate: z.string().optional(),
  beforeDate: z.string().optional(),
});

export const GetForumPostStreamSchema = z.object({
  threadId: z.string(),
  afterDate: z.string().optional(),
  beforeDate: z.string().optional(),
});

export const ArchiveForumStreamSchema = z.object({
  forumChannelId: z.string(),
  afterDate: z.string().optional(),
  beforeDate: z.string().optional(),
  includeArchived: z.boolean().optional().default(true),
});

export const ArchiveMultipleForumsSchema = z.object({
  forumChannelIds: z.array(z.string()).min(1).max(5),
  afterDate: z.string().optional(),
  beforeDate: z.string().optional(),
  includeArchived: z.boolean().optional().default(true),
});

export const GetChannelListSchema = z.object({
  guildId: z.string(),
  channelType: z.enum(['text', 'forum', 'all']).optional().default('all'),
});
```

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: SUCCESS (no errors)

**Step 3: Commit**

```bash
git add src/schemas.ts
git commit -m "feat: add Zod schemas for streaming tools

Define input validation schemas for 6 new streaming tools.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Implement discord_read_messages_stream Tool

**Files:**
- Modify: `src/tools/channel.ts`
- Create: `tests/tools/channel-stream.test.ts`

**Step 1: Write test for readMessagesStreamHandler**

Create `tests/tools/channel-stream.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readMessagesStreamHandler } from '../../src/tools/channel.js';
import { mockClient, mockChannel, mockMessage } from '../setup.js';

describe('readMessagesStreamHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error if not logged in', async () => {
    const client = { ...mockClient, isReady: () => false };
    const result = await readMessagesStreamHandler(
      { channelId: 'test-123' },
      { client }
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not logged in');
  });

  it('should return error if channel not found', async () => {
    const client = { ...mockClient };
    client.channels.fetch.mockResolvedValue(null);

    const result = await readMessagesStreamHandler(
      { channelId: 'invalid' },
      { client }
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Cannot find channel');
  });

  it('should stream messages and return results', async () => {
    const client = { ...mockClient };
    const channel = { ...mockChannel };

    const now = new Date();
    const messages = new Map([
      ['1', mockMessage('1', 'Hello', new Date(now.getTime() - 1000))],
      ['2', mockMessage('2', 'World', new Date(now.getTime() - 2000))],
    ]);

    channel.messages.fetch.mockResolvedValue(messages);
    client.channels.fetch.mockResolvedValue(channel);

    const result = await readMessagesStreamHandler(
      { channelId: 'test-123' },
      { client }
    );

    expect(result.isError).not.toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.events).toBeDefined();
    expect(data.events.some((e: any) => e.type === 'complete')).toBe(true);
  });
});
```

Run: `npm test tests/tools/channel-stream.test.ts`
Expected: FAIL with "readMessagesStreamHandler is not exported"

**Step 2: Implement readMessagesStreamHandler**

Edit `src/tools/channel.ts`, add at the end:

```typescript
import { MessageStreamer } from './stream/MessageStreamer.js';
import { ReadMessagesStreamSchema } from '../schemas.js';

export async function readMessagesStreamHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { channelId, afterDate, beforeDate } = ReadMessagesStreamSchema.parse(args);

  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await context.client.channels.fetch(channelId);
    if (!channel) {
      return {
        content: [{ type: "text", text: `Cannot find channel with ID: ${channelId}` }],
        isError: true
      };
    }

    if (!channel.isTextBased() || !('messages' in channel)) {
      return {
        content: [{ type: "text", text: `Channel type does not support reading messages` }],
        isError: true
      };
    }

    // Create streamer
    const streamer = new MessageStreamer(channel, {
      afterDate: afterDate ? new Date(afterDate) : undefined,
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
      defaultDays: 10,
    });

    // Collect all events
    const events = [];
    for await (const event of streamer.stream()) {
      events.push(event);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          channelId,
          events,
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}
```

**Step 3: Run test**

Run: `npm test tests/tools/channel-stream.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/channel.ts tests/tools/channel-stream.test.ts
git commit -m "feat: add discord_read_messages_stream handler

Implement streaming message reader for channels with time range support.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Implement discord_get_channel_list Tool

**Files:**
- Modify: `src/tools/server.ts`
- Create: `tests/tools/server-channels.test.ts`

**Step 1: Write test**

Create `tests/tools/server-channels.test.ts`:

```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { getChannelListHandler } from '../../src/tools/server.js';
import { mockClient } from '../setup.js';
import { ChannelType } from 'discord.js';

describe('getChannelListHandler', () => {
  it('should list all channels', async () => {
    const client = { ...mockClient };
    const guild = {
      channels: {
        fetch: jest.fn().mockResolvedValue(new Map([
          ['1', { id: '1', name: 'general', type: ChannelType.GuildText }],
          ['2', { id: '2', name: 'bugs', type: ChannelType.GuildForum }],
        ])),
      },
    };
    client.guilds.fetch.mockResolvedValue(guild);

    const result = await getChannelListHandler(
      { guildId: 'guild-123' },
      { client }
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.channels).toHaveLength(2);
  });

  it('should filter by channel type', async () => {
    const client = { ...mockClient };
    const guild = {
      channels: {
        fetch: jest.fn().mockResolvedValue(new Map([
          ['1', { id: '1', name: 'general', type: ChannelType.GuildText }],
          ['2', { id: '2', name: 'bugs', type: ChannelType.GuildForum }],
        ])),
      },
    };
    client.guilds.fetch.mockResolvedValue(guild);

    const result = await getChannelListHandler(
      { guildId: 'guild-123', channelType: 'forum' },
      { client }
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.channels).toHaveLength(1);
    expect(data.channels[0].name).toBe('bugs');
  });
});
```

Run: `npm test tests/tools/server-channels.test.ts`
Expected: FAIL with "getChannelListHandler is not exported"

**Step 2: Implement handler**

Edit `src/tools/server.ts`, add at the end:

```typescript
import { GetChannelListSchema } from '../schemas.js';
import { ChannelType } from 'discord.js';

export const getChannelListHandler: ToolHandler = async (args, { client }) => {
  const { guildId, channelType } = GetChannelListSchema.parse(args);

  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      return {
        content: [{ type: "text", text: `Cannot find guild with ID: ${guildId}` }],
        isError: true
      };
    }

    const channels = await guild.channels.fetch();

    let filteredChannels = Array.from(channels.values()).filter(ch => ch !== null);

    // Filter by type if specified
    if (channelType === 'text') {
      filteredChannels = filteredChannels.filter(ch => ch!.type === ChannelType.GuildText);
    } else if (channelType === 'forum') {
      filteredChannels = filteredChannels.filter(ch => ch!.type === ChannelType.GuildForum);
    }

    const channelList = filteredChannels.map(ch => ({
      id: ch!.id,
      name: ch!.name,
      type: ch!.type === ChannelType.GuildText ? 'text' :
            ch!.type === ChannelType.GuildForum ? 'forum' : 'other',
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          guildId,
          channels: channelList,
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};
```

**Step 3: Run test**

Run: `npm test tests/tools/server-channels.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/server.ts tests/tools/server-channels.test.ts
git commit -m "feat: add discord_get_channel_list handler

List all channels in a server with optional type filtering.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Implement Remaining Stream Tools (Batch)

**Files:**
- Modify: `src/tools/channel.ts` (add readMultipleChannelsHandler)
- Modify: `src/tools/forum.ts` (add 3 stream handlers)

**Step 1: Implement readMultipleChannelsHandler**

Edit `src/tools/channel.ts`, add:

```typescript
import { ReadMultipleChannelsSchema } from '../schemas.js';

export async function readMultipleChannelsHandler(
  args: unknown,
  context: ToolContext
): Promise<ToolResponse> {
  const { channelIds, afterDate, beforeDate } = ReadMultipleChannelsSchema.parse(args);

  try {
    if (!context.client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const results = [];

    for (const channelId of channelIds) {
      const result = await readMessagesStreamHandler(
        { channelId, afterDate, beforeDate },
        context
      );

      if (result.isError) {
        results.push({ channelId, error: result.content[0].text });
      } else {
        results.push({ channelId, ...JSON.parse(result.content[0].text) });
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ channels: results }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
}
```

**Step 2: Implement getForumPostStreamHandler**

Edit `src/tools/forum.ts`, add:

```typescript
import { MessageStreamer } from './stream/MessageStreamer.js';
import { GetForumPostStreamSchema } from '../schemas.js';

export const getForumPostStreamHandler: ToolHandler = async (args, { client }) => {
  const { threadId, afterDate, beforeDate } = GetForumPostStreamSchema.parse(args);

  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const thread = await client.channels.fetch(threadId);
    if (!thread || !thread.isThread()) {
      return {
        content: [{ type: "text", text: `Cannot find thread with ID: ${threadId}` }],
        isError: true
      };
    }

    const streamer = new MessageStreamer(thread, {
      afterDate: afterDate ? new Date(afterDate) : undefined,
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
      defaultDays: 10,
    });

    const events = [];
    for await (const event of streamer.stream()) {
      events.push(event);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          threadId,
          threadName: thread.name,
          events,
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};
```

**Step 3: Implement archiveForumStreamHandler**

Edit `src/tools/forum.ts`, add:

```typescript
import { ForumStreamer } from './stream/ForumStreamer.js';
import { ArchiveForumStreamSchema } from '../schemas.js';

export const archiveForumStreamHandler: ToolHandler = async (args, { client }) => {
  const { forumChannelId, afterDate, beforeDate, includeArchived } = ArchiveForumStreamSchema.parse(args);

  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const channel = await client.channels.fetch(forumChannelId);
    if (!channel || channel.type !== ChannelType.GuildForum) {
      return {
        content: [{ type: "text", text: `Channel ID ${forumChannelId} is not a forum channel.` }],
        isError: true
      };
    }

    const forumChannel = channel as ForumChannel;
    const streamer = new ForumStreamer(forumChannel, {
      afterDate: afterDate ? new Date(afterDate) : undefined,
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
      defaultDays: 10,
      includeArchived,
    });

    const events = [];
    for await (const event of streamer.streamForum()) {
      events.push(event);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          forumChannelId,
          events,
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};
```

**Step 4: Implement archiveMultipleForumsHandler**

Edit `src/tools/forum.ts`, add:

```typescript
import { ArchiveMultipleForumsSchema } from '../schemas.js';

export const archiveMultipleForumsHandler: ToolHandler = async (args, { client }) => {
  const { forumChannelIds, afterDate, beforeDate, includeArchived } = ArchiveMultipleForumsSchema.parse(args);

  try {
    if (!client.isReady()) {
      return {
        content: [{ type: "text", text: "Discord client not logged in." }],
        isError: true
      };
    }

    const results = [];

    for (const forumChannelId of forumChannelIds) {
      const result = await archiveForumStreamHandler(
        { forumChannelId, afterDate, beforeDate, includeArchived },
        { client }
      );

      if (result.isError) {
        results.push({ forumChannelId, error: result.content[0].text });
      } else {
        results.push({ forumChannelId, ...JSON.parse(result.content[0].text) });
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ forums: results }, null, 2)
      }]
    };
  } catch (error) {
    return handleDiscordError(error);
  }
};
```

**Step 5: Build to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/tools/channel.ts src/tools/forum.ts
git commit -m "feat: implement remaining streaming tool handlers

Add handlers for:
- discord_read_multiple_channels
- discord_get_forum_post_stream
- discord_archive_forum_stream
- discord_archive_multiple_forums

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Register New Tools in toolList

**Files:**
- Modify: `src/toolList.ts`

**Step 1: Add tool definitions**

Edit `src/toolList.ts`, add before the closing `]`:

```typescript
  {
    name: "discord_read_messages_stream",
    description: "Stream all messages from a Discord channel with time-range filtering. Returns messages in batches with progress updates. Default: last 10 days.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "The ID of the channel to read from" },
        afterDate: { type: "string", description: "ISO date string (e.g., '2026-02-21'). Only fetch messages after this date. Default: 10 days ago" },
        beforeDate: { type: "string", description: "ISO date string. Only fetch messages before this date. Default: now" }
      },
      required: ["channelId"]
    }
  },
  {
    name: "discord_read_multiple_channels",
    description: "Stream messages from multiple channels at once. Processes channels sequentially and returns combined results.",
    inputSchema: {
      type: "object",
      properties: {
        channelIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10, description: "Array of channel IDs (max 10)" },
        afterDate: { type: "string", description: "ISO date string. Default: 10 days ago" },
        beforeDate: { type: "string", description: "ISO date string. Default: now" }
      },
      required: ["channelIds"]
    }
  },
  {
    name: "discord_get_forum_post_stream",
    description: "Stream all messages from a single forum thread/post with time-range filtering. Returns complete thread history.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "The ID of the forum thread/post" },
        afterDate: { type: "string", description: "ISO date string. Default: 10 days ago" },
        beforeDate: { type: "string", description: "ISO date string. Default: now" }
      },
      required: ["threadId"]
    }
  },
  {
    name: "discord_archive_forum_stream",
    description: "Archive an entire forum channel by streaming all threads and their messages. Returns complete forum history with progress updates.",
    inputSchema: {
      type: "object",
      properties: {
        forumChannelId: { type: "string", description: "The ID of the forum channel" },
        afterDate: { type: "string", description: "ISO date string. Default: 10 days ago" },
        beforeDate: { type: "string", description: "ISO date string. Default: now" },
        includeArchived: { type: "boolean", description: "Include archived threads. Default: true", default: true }
      },
      required: ["forumChannelId"]
    }
  },
  {
    name: "discord_archive_multiple_forums",
    description: "Archive multiple forum channels at once. Processes forums sequentially.",
    inputSchema: {
      type: "object",
      properties: {
        forumChannelIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5, description: "Array of forum channel IDs (max 5)" },
        afterDate: { type: "string", description: "ISO date string. Default: 10 days ago" },
        beforeDate: { type: "string", description: "ISO date string. Default: now" },
        includeArchived: { type: "boolean", description: "Include archived threads. Default: true", default: true }
      },
      required: ["forumChannelIds"]
    }
  },
  {
    name: "discord_get_channel_list",
    description: "List all channels in a Discord server with optional type filtering. Use this to discover channel IDs before reading messages.",
    inputSchema: {
      type: "object",
      properties: {
        guildId: { type: "string", description: "The ID of the Discord server" },
        channelType: { type: "string", enum: ["text", "forum", "all"], description: "Filter by channel type. Default: all", default: "all" }
      },
      required: ["guildId"]
    }
  }
```

**Step 2: Build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/toolList.ts
git commit -m "feat: register 6 new streaming tools in toolList

Add tool definitions for all streaming capabilities to MCP tool list.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Wire Up Tool Handlers

**Files:**
- Modify: `src/tools/tools.ts`

**Step 1: Import new handlers**

Edit `src/tools/tools.ts`, add imports:

```typescript
import {
  readMessagesStreamHandler,
  readMultipleChannelsHandler,
} from './channel.js';

import {
  getForumPostStreamHandler,
  archiveForumStreamHandler,
  archiveMultipleForumsHandler,
} from './forum.js';

import { getChannelListHandler } from './server.js';
```

**Step 2: Add to tool handlers map**

Edit `src/tools/tools.ts`, add to the handlers object:

```typescript
  discord_read_messages_stream: readMessagesStreamHandler,
  discord_read_multiple_channels: readMultipleChannelsHandler,
  discord_get_forum_post_stream: getForumPostStreamHandler,
  discord_archive_forum_stream: archiveForumStreamHandler,
  discord_archive_multiple_forums: archiveMultipleForumsHandler,
  discord_get_channel_list: getChannelListHandler,
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: SUCCESS (all tools wired up)

**Step 4: Commit**

```bash
git add src/tools/tools.ts
git commit -m "feat: wire up streaming tool handlers

Connect all 6 new streaming handlers to MCP tool routing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Update package.json for Publishing

**Files:**
- Modify: `package.json`

**Step 1: Update package metadata**

Edit `package.json`:

```json
{
  "name": "@yangyifei/mcp-discord-stream",
  "version": "1.0.0",
  "description": "Discord MCP with streaming support for full historical message retrieval. Forked from barryyip0625/mcp-discord.",
  "author": "Yang Yifei",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yangyifei/mcp-discord-stream.git"
  },
  "bugs": {
    "url": "https://github.com/yangyifei/mcp-discord-stream/issues"
  },
  "homepage": "https://github.com/yangyifei/mcp-discord-stream#readme",
  "bin": {
    "mcp-discord-stream": "build/index.js"
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update package.json for npm publishing

Rename package to @yangyifei/mcp-discord-stream and update metadata.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Create README Documentation

**Files:**
- Create: `README-STREAMING.md`

**Step 1: Write streaming feature documentation**

Create `README-STREAMING.md`:

```markdown
# Discord MCP Streaming Enhancement

This is a fork of [barryyip0625/mcp-discord](https://github.com/barryyip0625/mcp-discord) with added streaming capabilities for full historical message retrieval.

## New Features

### 6 New Streaming Tools

1. **discord_read_messages_stream** - Read all messages from a channel
2. **discord_read_multiple_channels** - Batch read from multiple channels
3. **discord_get_forum_post_stream** - Read all messages from a forum thread
4. **discord_archive_forum_stream** - Archive entire forum (all threads)
5. **discord_archive_multiple_forums** - Batch archive multiple forums
6. **discord_get_channel_list** - List all channels in a server

### Key Improvements

- ✅ **No message limits** - Read entire channel/forum history
- ✅ **Time-range filtering** - Specify `afterDate`/`beforeDate` (default: last 10 days)
- ✅ **Real-time progress** - See progress updates while fetching
- ✅ **Rate limit handling** - Gracefully returns partial data with retry suggestion
- ✅ **Flexible selection** - Read single or multiple channels/forums

## Installation

```bash
# Via npx (recommended)
npx @yangyifei/mcp-discord-stream --config YOUR_DISCORD_BOT_TOKEN

# Or install globally
npm install -g @yangyifei/mcp-discord-stream
mcp-discord-stream --config YOUR_DISCORD_BOT_TOKEN
```

## Usage Examples

### Read Last 10 Days from Channel

```typescript
discord_read_messages_stream({
  channelId: "1234567890"
  // Uses defaults: last 10 days
})
```

### Read Specific Date Range

```typescript
discord_read_messages_stream({
  channelId: "1234567890",
  afterDate: "2026-02-01",
  beforeDate: "2026-03-01"
})
```

### Archive Entire Forum

```typescript
discord_archive_forum_stream({
  forumChannelId: "9876543210",
  includeArchived: true  // Include archived threads
})
```

### Batch Read Multiple Channels

```typescript
discord_read_multiple_channels({
  channelIds: ["123", "456", "789"],
  afterDate: "2026-02-25"
})
```

### Discover Channel IDs

```typescript
// Step 1: List all channels
discord_get_channel_list({
  guildId: "your-server-id",
  channelType: "text"  // or "forum" or "all"
})

// Returns: [{ id: "123", name: "general", type: "text" }, ...]

// Step 2: Use channel IDs to read
discord_read_messages_stream({ channelId: "123" })
```

## Response Format

All streaming tools return events in this format:

```json
{
  "channelId": "123456",
  "events": [
    { "type": "progress", "fetched": 100, "oldest": "2026-02-25T10:00:00Z" },
    { "type": "batch", "messages": [...], "batchNumber": 1, "total": 100 },
    { "type": "complete", "totalFetched": 1523, "duration": "45s" }
  ]
}
```

### Event Types

- **progress** - Periodic updates (every 3 seconds) showing fetch progress
- **batch** - Actual message data (100 messages per batch)
- **rate_limited** - Hit Discord rate limit, returns partial data + `retryAfter` seconds
- **complete** - All messages fetched successfully
- **threads_found** - (Forum only) Number of threads discovered
- **thread_progress** - (Forum only) Current thread being processed

## Rate Limiting

If Discord rate limits your requests:

```json
{
  "type": "rate_limited",
  "fetched": 500,
  "retryAfter": 60,
  "messages": [...first 500 messages...]
}
```

**What to do:** Wait 60 seconds, then call again with same parameters to continue from where it stopped.

## Discord Bot Setup

### Required Permissions

- Read Messages/View Channels
- Read Message History
- (Optional) Send Messages - if you want to use non-streaming tools

### Enable Intents

In [Discord Developer Portal](https://discord.com/developers/applications):
1. Go to your application → Bot
2. Enable these Privileged Gateway Intents:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent

## Differences from Original

| Feature | Original mcp-discord | This Fork |
|---------|---------------------|-----------|
| Max messages per call | 100 (hard limit) | Unlimited (streaming) |
| Forum post messages | 10 (hard-coded) | Unlimited |
| Time filtering | ❌ No | ✅ Yes (afterDate/beforeDate) |
| Progress updates | ❌ No | ✅ Yes (real-time) |
| Rate limit handling | ❌ Errors | ✅ Partial return + retry |
| Batch operations | ❌ No | ✅ Multiple channels/forums |

## Credits

Original project: [barryyip0625/mcp-discord](https://github.com/barryyip0625/mcp-discord)

Streaming enhancements by Yang Yifei.
```

**Step 2: Commit**

```bash
git add README-STREAMING.md
git commit -m "docs: add streaming features documentation

Document all 6 new streaming tools with usage examples.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Manual Testing Checklist

**Prerequisites:**
- Discord bot token with required permissions
- Test server with at least 1 text channel and 1 forum channel
- Test data: 100+ messages in channel, 3+ threads in forum

**Step 1: Test discord_read_messages_stream**

```bash
# Start the server
npm run build
node build/index.js

# In Claude Desktop, test:
discord_read_messages_stream({ channelId: "YOUR_TEST_CHANNEL_ID" })
```

**Expected:**
- Returns events array with progress, batch, and complete events
- Messages sorted by timestamp (oldest first)
- No errors

**Step 2: Test discord_get_channel_list**

```
discord_get_channel_list({ guildId: "YOUR_SERVER_ID" })
```

**Expected:**
- Returns list of all channels
- Each channel has id, name, type
- No errors

**Step 3: Test discord_archive_forum_stream**

```
discord_archive_forum_stream({ forumChannelId: "YOUR_FORUM_ID" })
```

**Expected:**
- Returns threads_found event
- Returns thread_progress events
- Returns complete event with all thread messages
- No errors

**Step 4: Test time range filtering**

```
discord_read_messages_stream({
  channelId: "YOUR_CHANNEL_ID",
  afterDate: "2026-02-01",
  beforeDate: "2026-03-01"
})
```

**Expected:**
- Only returns messages within date range
- Respects both afterDate and beforeDate

**Step 5: Test rate limit simulation**

Manually edit `MessageStreamer.ts` to throw rate limit error after 200 messages:

```typescript
if (total > 200) {
  const error: any = new Error('Rate limited');
  error.httpStatus = 429;
  error.retryAfter = 60;
  throw error;
}
```

Run test, verify:
- Returns rate_limited event
- Includes retryAfter: 60
- Returns first 200 messages

**Step 6: Document test results**

Create `TESTING-NOTES.md`:

```markdown
# Testing Results

- ✅ discord_read_messages_stream: Works, fetched 150 messages
- ✅ discord_get_channel_list: Lists 5 channels correctly
- ✅ discord_archive_forum_stream: Archived 3 threads successfully
- ✅ Time filtering: Only returned Feb 2026 messages
- ✅ Rate limit handling: Returned partial data with retry suggestion
```

**Step 7: Commit**

```bash
git add TESTING-NOTES.md
git commit -m "test: manual testing complete

All 6 streaming tools tested and verified working.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Publish to npm

**Files:**
- None (publishing step)

**Step 1: Verify build is clean**

```bash
npm run build
```

Expected: SUCCESS, `build/` directory created

**Step 2: Login to npm**

```bash
npm login
```

Follow prompts to authenticate.

**Step 3: Publish package**

```bash
npm publish --access public
```

**Expected:** Package published to `@yangyifei/mcp-discord-stream@1.0.0`

**Step 4: Test installation**

```bash
npx @yangyifei/mcp-discord-stream --config YOUR_TOKEN
```

**Expected:** Server starts successfully

**Step 5: Create Git tag**

```bash
git tag v1.0.0
git push origin v1.0.0
```

**Step 6: Final commit**

```bash
git commit --allow-empty -m "release: v1.0.0

Published @yangyifei/mcp-discord-stream to npm.

Features:
- 6 streaming tools for full Discord history
- Time-range filtering (default 10 days)
- Real-time progress updates
- Graceful rate limit handling

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Success Criteria Checklist

Before considering this implementation complete, verify:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds without errors (`npm run build`)
- [ ] Manual testing of all 6 tools completed
- [ ] Documentation written (README-STREAMING.md)
- [ ] Package published to npm
- [ ] Can install via `npx @yangyifei/mcp-discord-stream`
- [ ] Time range filtering works (default 10 days)
- [ ] Rate limit returns partial data + retry suggestion
- [ ] Forum archiving processes all threads
- [ ] Channel list tool returns correct data

---

## Execution Options

Plan complete and saved to `docs/plans/2026-03-04-streaming-implementation.md`.

**Two execution approaches:**

### 1. Subagent-Driven (this session)
- Stay in this session
- I dispatch a fresh subagent per task
- You review between tasks
- Fast iteration with checkpoints
- **Use**: @superpowers:subagent-driven-development

### 2. Parallel Session (separate)
- Open new Claude Code session
- Run in `/home/node/mcp-disocrd/mcp-discord-main/`
- Batch execution with checkpoints
- **Use**: @superpowers:executing-plans

**Which approach do you prefer?**
