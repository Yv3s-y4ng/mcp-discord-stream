# Discord Auto-Reply Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic hourly summaries for channels and contextual replies for forum posts with SQLite persistence and Claude Code integration.

**Architecture:** Bot collects messages to SQLite, hourly trigger writes file, Claude Code polls file and processes via AI, replies sent through existing MCP tools.

**Tech Stack:** Discord.js 14.19.3, SQLite3 (better-sqlite3), TypeScript, Jest, existing MCP infrastructure

---

## Phase 1: Database Setup & Schema

### Task 1: Add SQLite Dependencies

**Files:**
- Modify: `package.json`
- Create: `src/database/schema.ts`
- Create: `src/database/db.ts`

**Step 1: Add better-sqlite3 dependency**

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

**Step 2: Verify installation**

Run: `npm list better-sqlite3`
Expected: Shows version installed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add better-sqlite3 for message persistence"
```

---

### Task 2: Create Database Schema

**Files:**
- Create: `src/database/schema.ts`

**Step 1: Write schema definitions**

```typescript
// src/database/schema.ts
export const SCHEMA = {
  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      author_id TEXT NOT NULL,
      author_name TEXT,
      content TEXT,
      timestamp INTEGER NOT NULL,
      processed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `,
  messagesIndex: `
    CREATE INDEX IF NOT EXISTS idx_messages_channel
    ON messages(channel_id, processed)
  `,
  threads: `
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      forum_id TEXT NOT NULL,
      forum_name TEXT,
      title TEXT,
      author_id TEXT,
      created_at INTEGER,
      last_message_at INTEGER,
      bot_replied INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0
    )
  `,
  threadsIndex: `
    CREATE INDEX IF NOT EXISTS idx_threads_forum
    ON threads(forum_id, bot_replied)
  `,
  threadMessages: `
    CREATE TABLE IF NOT EXISTS thread_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT,
      content TEXT,
      timestamp INTEGER NOT NULL,
      is_bot INTEGER DEFAULT 0,
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    )
  `,
  threadMessagesIndex: `
    CREATE INDEX IF NOT EXISTS idx_thread_messages
    ON thread_messages(thread_id, timestamp)
  `
};

export interface MessageRow {
  id: string;
  channel_id: string;
  channel_name: string | null;
  author_id: string;
  author_name: string | null;
  content: string;
  timestamp: number;
  processed: number;
  created_at: number;
}

export interface ThreadRow {
  id: string;
  forum_id: string;
  forum_name: string | null;
  title: string | null;
  author_id: string | null;
  created_at: number | null;
  last_message_at: number | null;
  bot_replied: number;
  message_count: number;
}

export interface ThreadMessageRow {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  timestamp: number;
  is_bot: number;
}
```

**Step 2: Commit**

```bash
git add src/database/schema.ts
git commit -m "feat: add database schema for auto-reply"
```

---

### Task 3: Create Database Connection Manager

**Files:**
- Create: `src/database/db.ts`
- Create: `tests/database/db.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/database/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Database } from '../src/database/db.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Database', () => {
  const testDbPath = './test_messages.db';
  let db: Database;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create database file', () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  it('should initialize tables', () => {
    const tables = db.getTables();
    expect(tables).toContain('messages');
    expect(tables).toContain('threads');
    expect(tables).toContain('thread_messages');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/database/db.test.ts`
Expected: FAIL with "Cannot find module '../src/database/db.js'"

**Step 3: Write minimal implementation**

```typescript
// src/database/db.ts
import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import * as path from 'path';
import * as fs from 'fs';

export class Database {
  private db: Database.Database;

  constructor(dbPath: string = './data/discord_messages.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Create tables
    this.db.exec(SCHEMA.messages);
    this.db.exec(SCHEMA.messagesIndex);
    this.db.exec(SCHEMA.threads);
    this.db.exec(SCHEMA.threadsIndex);
    this.db.exec(SCHEMA.threadMessages);
    this.db.exec(SCHEMA.threadMessagesIndex);
  }

  public getTables(): string[] {
    const result = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as Array<{ name: string }>;
    return result.map(row => row.name);
  }

  public close(): void {
    this.db.close();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/database/db.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/database/db.ts tests/database/db.test.ts
git commit -m "feat: add Database connection manager with schema initialization"
```

---

## Phase 2: Message Collection

### Task 4: Add Message Insert Methods

**Files:**
- Modify: `src/database/db.ts`
- Modify: `tests/database/db.test.ts`

**Step 1: Write the failing tests**

```typescript
// Add to tests/database/db.test.ts
import type { MessageRow, ThreadRow, ThreadMessageRow } from '../src/database/schema.js';

describe('Database - Message Operations', () => {
  const testDbPath = './test_messages.db';
  let db: Database;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should insert channel message', () => {
    db.insertMessage({
      id: 'msg123',
      channel_id: 'ch123',
      channel_name: 'test-channel',
      author_id: 'user123',
      author_name: 'TestUser',
      content: 'Hello world',
      timestamp: Date.now()
    });

    const messages = db.getUnprocessedMessages('ch123');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello world');
  });

  it('should insert thread and messages', () => {
    db.insertThread({
      id: 'thread123',
      forum_id: 'forum123',
      forum_name: 'Tech Forum',
      title: 'Help needed',
      author_id: 'user123',
      created_at: Date.now(),
      last_message_at: Date.now()
    });

    db.insertThreadMessage({
      id: 'tmsg123',
      thread_id: 'thread123',
      author_id: 'user123',
      author_name: 'TestUser',
      content: 'I need help',
      timestamp: Date.now()
    });

    const threads = db.getUnrepliedThreads('forum123');
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe('Help needed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/database/db.test.ts`
Expected: FAIL with "db.insertMessage is not a function"

**Step 3: Write minimal implementation**

```typescript
// Add to src/database/db.ts
import type { MessageRow, ThreadRow, ThreadMessageRow } from './schema.js';

export class Database {
  // ... existing code ...

  // Channel message operations
  public insertMessage(message: Omit<MessageRow, 'processed' | 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages
      (id, channel_id, channel_name, author_id, author_name, content, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.channel_id,
      message.channel_name,
      message.author_id,
      message.author_name,
      message.content,
      message.timestamp
    );
  }

  public getUnprocessedMessages(channelId: string): MessageRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE channel_id = ? AND processed = 0
      ORDER BY timestamp ASC
    `);
    return stmt.all(channelId) as MessageRow[];
  }

  public markMessagesProcessed(channelId: string): void {
    const stmt = this.db.prepare(`
      UPDATE messages SET processed = 1
      WHERE channel_id = ? AND processed = 0
    `);
    stmt.run(channelId);
  }

  // Thread operations
  public insertThread(thread: Omit<ThreadRow, 'bot_replied' | 'message_count'>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO threads
      (id, forum_id, forum_name, title, author_id, created_at, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      thread.id,
      thread.forum_id,
      thread.forum_name,
      thread.title,
      thread.author_id,
      thread.created_at,
      thread.last_message_at
    );
  }

  public insertThreadMessage(message: ThreadMessageRow): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO thread_messages
      (id, thread_id, author_id, author_name, content, timestamp, is_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.thread_id,
      message.author_id,
      message.author_name,
      message.content,
      message.timestamp,
      message.is_bot || 0
    );

    // Update thread message count and last_message_at
    const updateStmt = this.db.prepare(`
      UPDATE threads
      SET message_count = message_count + 1,
          last_message_at = ?
      WHERE id = ?
    `);
    updateStmt.run(message.timestamp, message.thread_id);
  }

  public getUnrepliedThreads(forumId: string): ThreadRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM threads
      WHERE forum_id = ? AND bot_replied = 0
      ORDER BY last_message_at DESC
    `);
    return stmt.all(forumId) as ThreadRow[];
  }

  public getThreadMessages(threadId: string): ThreadMessageRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM thread_messages
      WHERE thread_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(threadId) as ThreadMessageRow[];
  }

  public markThreadReplied(threadId: string): void {
    const stmt = this.db.prepare(`
      UPDATE threads SET bot_replied = 1 WHERE id = ?
    `);
    stmt.run(threadId);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/database/db.test.ts`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/database/db.ts tests/database/db.test.ts
git commit -m "feat: add database CRUD operations for messages and threads"
```

---

### Task 5: Create Auto-Reply Configuration

**Files:**
- Create: `src/auto-reply/config.ts`
- Create: `auto-reply-config.json` (example)

**Step 1: Create configuration interface**

```typescript
// src/auto-reply/config.ts
export interface AutoReplyConfig {
  enabled: boolean;
  interval: number; // seconds
  channels: {
    summary: string[]; // Channel IDs for hourly summaries
    forums: string[];  // Forum IDs for individual replies
  };
  triggerFile: string;
  database: string;
  historyImport: {
    enabled: boolean;
    daysBack: number;
  };
}

export const DEFAULT_CONFIG: AutoReplyConfig = {
  enabled: true,
  interval: 3600, // 1 hour
  channels: {
    summary: [],
    forums: []
  },
  triggerFile: '/tmp/discord_triggers.json',
  database: './data/discord_messages.db',
  historyImport: {
    enabled: true,
    daysBack: 30
  }
};

export function loadConfig(path: string = './auto-reply-config.json'): AutoReplyConfig {
  try {
    const fs = require('fs');
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      const config = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (err) {
    console.warn(`Failed to load config from ${path}, using defaults`);
  }
  return DEFAULT_CONFIG;
}
```

**Step 2: Create example configuration**

```json
{
  "enabled": true,
  "interval": 3600,
  "channels": {
    "summary": [],
    "forums": []
  },
  "triggerFile": "/tmp/discord_triggers.json",
  "database": "./data/discord_messages.db",
  "historyImport": {
    "enabled": true,
    "daysBack": 30
  }
}
```

**Step 3: Commit**

```bash
git add src/auto-reply/config.ts auto-reply-config.json
git commit -m "feat: add auto-reply configuration system"
```

---

### Task 6: Implement Message Collector

**Files:**
- Create: `src/auto-reply/MessageCollector.ts`
- Create: `tests/auto-reply/MessageCollector.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/auto-reply/MessageCollector.test.ts
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MessageCollector } from '../src/auto-reply/MessageCollector.js';
import { Database } from '../src/database/db.js';
import type { Message, TextChannel, ThreadChannel, ForumChannel } from 'discord.js';
import * as fs from 'fs';

describe('MessageCollector', () => {
  const testDbPath = './test_collector.db';
  let db: Database;
  let collector: MessageCollector;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
    collector = new MessageCollector(db, {
      summary: ['ch123'],
      forums: ['forum123']
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should collect channel messages', () => {
    const mockMessage = {
      id: 'msg123',
      channelId: 'ch123',
      channel: {
        id: 'ch123',
        name: 'test-channel',
        isThread: () => false
      } as any,
      author: {
        id: 'user123',
        username: 'TestUser',
        bot: false
      },
      content: 'Hello world',
      createdTimestamp: Date.now()
    } as Message;

    collector.handleMessage(mockMessage);

    const messages = db.getUnprocessedMessages('ch123');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello world');
  });

  it('should ignore bot messages', () => {
    const mockMessage = {
      id: 'msg123',
      channelId: 'ch123',
      channel: { id: 'ch123', isThread: () => false } as any,
      author: { id: 'bot123', bot: true },
      content: 'Bot message',
      createdTimestamp: Date.now()
    } as Message;

    collector.handleMessage(mockMessage);

    const messages = db.getUnprocessedMessages('ch123');
    expect(messages).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/auto-reply/MessageCollector.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/auto-reply/MessageCollector.ts
import type { Message, TextChannel, ThreadChannel } from 'discord.js';
import { Database } from '../database/db.js';
import { info } from '../logger.js';

export interface ChannelConfig {
  summary: string[];
  forums: string[];
}

export class MessageCollector {
  constructor(
    private db: Database,
    private config: ChannelConfig
  ) {}

  public handleMessage(message: Message): void {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    const channel = message.channel;

    // Check if it's a thread in a forum
    if (channel.isThread()) {
      const threadChannel = channel as ThreadChannel;
      const parentId = threadChannel.parentId;

      if (parentId && this.config.forums.includes(parentId)) {
        this.saveThreadMessage(message, threadChannel);
        return;
      }
    }

    // Check if it's a regular channel
    if (this.config.summary.includes(message.channelId)) {
      this.saveChannelMessage(message);
    }
  }

  private saveChannelMessage(message: Message): void {
    try {
      this.db.insertMessage({
        id: message.id,
        channel_id: message.channelId,
        channel_name: (message.channel as TextChannel).name || null,
        author_id: message.author.id,
        author_name: message.author.username,
        content: message.content,
        timestamp: message.createdTimestamp
      });
      info(`Collected message ${message.id} from channel ${message.channelId}`);
    } catch (err) {
      console.error(`Failed to save channel message: ${err}`);
    }
  }

  private saveThreadMessage(message: Message, thread: ThreadChannel): void {
    try {
      // Ensure thread exists in database
      this.db.insertThread({
        id: thread.id,
        forum_id: thread.parentId!,
        forum_name: thread.parent?.name || null,
        title: thread.name,
        author_id: thread.ownerId || null,
        created_at: thread.createdTimestamp || Date.now(),
        last_message_at: message.createdTimestamp
      });

      // Insert message
      this.db.insertThreadMessage({
        id: message.id,
        thread_id: thread.id,
        author_id: message.author.id,
        author_name: message.author.username,
        content: message.content,
        timestamp: message.createdTimestamp,
        is_bot: message.author.bot ? 1 : 0
      });

      info(`Collected thread message ${message.id} from thread ${thread.id}`);
    } catch (err) {
      console.error(`Failed to save thread message: ${err}`);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/auto-reply/MessageCollector.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auto-reply/MessageCollector.ts tests/auto-reply/MessageCollector.test.ts
git commit -m "feat: implement MessageCollector for channels and forums"
```

---

## Phase 3: History Import

### Task 7: Implement History Importer

**Files:**
- Create: `src/auto-reply/HistoryImporter.ts`

**Step 1: Write implementation (no test needed - uses existing tools)**

```typescript
// src/auto-reply/HistoryImporter.ts
import type { Client } from 'discord.js';
import { Database } from '../database/db.js';
import { info, error } from '../logger.js';
import type { ChannelConfig } from './MessageCollector.js';

export class HistoryImporter {
  constructor(
    private client: Client,
    private db: Database,
    private config: ChannelConfig,
    private daysBack: number = 30
  ) {}

  public async importAll(): Promise<void> {
    info('Starting history import...');

    const afterDate = new Date(Date.now() - this.daysBack * 86400000);

    // Import channel history
    for (const channelId of this.config.summary) {
      await this.importChannelHistory(channelId, afterDate);
    }

    // Import forum history
    for (const forumId of this.config.forums) {
      await this.importForumHistory(forumId, afterDate);
    }

    info('History import complete');
  }

  private async importChannelHistory(channelId: string, afterDate: Date): Promise<void> {
    try {
      info(`Importing history for channel ${channelId}`);
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        error(`Channel ${channelId} not found or not text-based`);
        return;
      }

      let before: string | undefined;
      let totalImported = 0;

      while (true) {
        const messages = await channel.messages.fetch({
          limit: 100,
          before
        });

        if (messages.size === 0) break;

        let shouldContinue = false;

        for (const [, message] of messages) {
          if (message.createdTimestamp < afterDate.getTime()) {
            break;
          }

          if (!message.author.bot) {
            this.db.insertMessage({
              id: message.id,
              channel_id: message.channelId,
              channel_name: channel.name || null,
              author_id: message.author.id,
              author_name: message.author.username,
              content: message.content,
              timestamp: message.createdTimestamp
            });
            totalImported++;
          }

          shouldContinue = true;
        }

        if (!shouldContinue) break;
        before = messages.last()?.id;

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      info(`Imported ${totalImported} messages from channel ${channelId}`);
    } catch (err) {
      error(`Failed to import channel history: ${err}`);
    }
  }

  private async importForumHistory(forumId: string, afterDate: Date): Promise<void> {
    try {
      info(`Importing history for forum ${forumId}`);
      const channel = await this.client.channels.fetch(forumId);

      if (!channel?.isThreadOnly()) {
        error(`Channel ${forumId} is not a forum`);
        return;
      }

      // Fetch all threads (active and archived)
      const threads = await channel.threads.fetchActive();
      const archived = await channel.threads.fetchArchived();
      const allThreads = new Map([...threads.threads, ...archived.threads]);

      info(`Found ${allThreads.size} threads in forum ${forumId}`);

      for (const [, thread] of allThreads) {
        await this.importThreadMessages(thread, afterDate);
      }
    } catch (err) {
      error(`Failed to import forum history: ${err}`);
    }
  }

  private async importThreadMessages(thread: any, afterDate: Date): Promise<void> {
    try {
      // Insert thread metadata
      this.db.insertThread({
        id: thread.id,
        forum_id: thread.parentId,
        forum_name: thread.parent?.name || null,
        title: thread.name,
        author_id: thread.ownerId || null,
        created_at: thread.createdTimestamp || Date.now(),
        last_message_at: thread.createdTimestamp || Date.now()
      });

      // Fetch all messages in thread
      let before: string | undefined;
      let totalImported = 0;

      while (true) {
        const messages = await thread.messages.fetch({
          limit: 100,
          before
        });

        if (messages.size === 0) break;

        let shouldContinue = false;

        for (const [, message] of messages) {
          if (message.createdTimestamp < afterDate.getTime()) {
            break;
          }

          this.db.insertThreadMessage({
            id: message.id,
            thread_id: thread.id,
            author_id: message.author.id,
            author_name: message.author.username,
            content: message.content,
            timestamp: message.createdTimestamp,
            is_bot: message.author.bot ? 1 : 0
          });
          totalImported++;
          shouldContinue = true;
        }

        if (!shouldContinue) break;
        before = messages.last()?.id;

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      info(`Imported ${totalImported} messages from thread ${thread.id}`);
    } catch (err) {
      error(`Failed to import thread messages: ${err}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/auto-reply/HistoryImporter.ts
git commit -m "feat: implement HistoryImporter for channels and forums"
```

---

## Phase 4: Trigger Mechanism

### Task 8: Implement Hourly Trigger

**Files:**
- Create: `src/auto-reply/HourlyTrigger.ts`
- Create: `tests/auto-reply/HourlyTrigger.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/auto-reply/HourlyTrigger.test.ts
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HourlyTrigger } from '../src/auto-reply/HourlyTrigger.js';
import { Database } from '../src/database/db.js';
import * as fs from 'fs';

describe('HourlyTrigger', () => {
  const testDbPath = './test_trigger.db';
  const testTriggerFile = './test_trigger.json';
  let db: Database;
  let trigger: HourlyTrigger;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testTriggerFile)) fs.unlinkSync(testTriggerFile);

    db = new Database(testDbPath);
    trigger = new HourlyTrigger(db, {
      summary: ['ch123'],
      forums: ['forum123']
    }, testTriggerFile);
  });

  afterEach(() => {
    trigger.stop();
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testTriggerFile)) fs.unlinkSync(testTriggerFile);
  });

  it('should create trigger file when there are unprocessed messages', async () => {
    db.insertMessage({
      id: 'msg123',
      channel_id: 'ch123',
      channel_name: 'test',
      author_id: 'user123',
      author_name: 'Test',
      content: 'Hello',
      timestamp: Date.now()
    });

    await trigger.checkAndTrigger();

    expect(fs.existsSync(testTriggerFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(testTriggerFile, 'utf-8'));
    expect(content.channels).toContain('ch123');
  });

  it('should not create trigger file when no unprocessed messages', async () => {
    await trigger.checkAndTrigger();
    expect(fs.existsSync(testTriggerFile)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/auto-reply/HourlyTrigger.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/auto-reply/HourlyTrigger.ts
import { Database } from '../database/db.js';
import type { ChannelConfig } from './MessageCollector.js';
import { info, error } from '../logger.js';
import * as fs from 'fs';

export interface TriggerData {
  timestamp: number;
  channels: string[];
  forums: Array<{ forumId: string; threads: string[] }>;
}

export class HourlyTrigger {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private db: Database,
    private config: ChannelConfig,
    private triggerFile: string,
    private interval: number = 3600000 // 1 hour in ms
  ) {}

  public start(): void {
    info('Starting hourly trigger');
    this.intervalId = setInterval(() => {
      this.checkAndTrigger();
    }, this.interval);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      info('Stopped hourly trigger');
    }
  }

  public async checkAndTrigger(): Promise<void> {
    try {
      const trigger: TriggerData = {
        timestamp: Date.now(),
        channels: [],
        forums: []
      };

      // Check for unprocessed channel messages
      for (const channelId of this.config.summary) {
        const messages = this.db.getUnprocessedMessages(channelId);
        if (messages.length > 0) {
          trigger.channels.push(channelId);
        }
      }

      // Check for unreplied forum threads
      for (const forumId of this.config.forums) {
        const threads = this.db.getUnrepliedThreads(forumId);
        if (threads.length > 0) {
          trigger.forums.push({
            forumId,
            threads: threads.map(t => t.id)
          });
        }
      }

      // Write trigger file if there's anything to process
      if (trigger.channels.length > 0 || trigger.forums.length > 0) {
        const tempFile = `${this.triggerFile}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(trigger, null, 2));
        fs.renameSync(tempFile, this.triggerFile);

        info(`Created trigger file: ${trigger.channels.length} channels, ${trigger.forums.length} forums`);
      }
    } catch (err) {
      error(`Failed to create trigger file: ${err}`);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/auto-reply/HourlyTrigger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auto-reply/HourlyTrigger.ts tests/auto-reply/HourlyTrigger.test.ts
git commit -m "feat: implement HourlyTrigger for periodic processing"
```

---

## Phase 5: Integration with Bot

### Task 9: Integrate Auto-Reply into Main Server

**Files:**
- Modify: `src/server.ts`
- Modify: `src/index.ts`

**Step 1: Add auto-reply initialization to index.ts**

```typescript
// Add to src/index.ts after line 65 (after client creation)
import { loadConfig } from './auto-reply/config.js';
import { Database } from './database/db.js';
import { MessageCollector } from './auto-reply/MessageCollector.js';
import { HistoryImporter } from './auto-reply/HistoryImporter.js';
import { HourlyTrigger } from './auto-reply/HourlyTrigger.js';

// Load auto-reply configuration
const autoReplyConfig = loadConfig();
let messageCollector: MessageCollector | null = null;
let hourlyTrigger: HourlyTrigger | null = null;

// Initialize auto-reply if enabled
if (autoReplyConfig.enabled) {
  const db = new Database(autoReplyConfig.database);

  messageCollector = new MessageCollector(db, autoReplyConfig.channels);
  hourlyTrigger = new HourlyTrigger(
    db,
    autoReplyConfig.channels,
    autoReplyConfig.triggerFile,
    autoReplyConfig.interval * 1000
  );

  // Set up message listener
  client.on('messageCreate', (message) => {
    messageCollector?.handleMessage(message);
  });

  // Import history on first login
  client.once('ready', async () => {
    if (autoReplyConfig.historyImport.enabled) {
      const importer = new HistoryImporter(
        client,
        db,
        autoReplyConfig.channels,
        autoReplyConfig.historyImport.daysBack
      );
      await importer.importAll();
    }

    // Start hourly trigger
    hourlyTrigger?.start();
  });

  info('Auto-reply system initialized');
}
```

**Step 2: Add graceful shutdown**

```typescript
// Add to src/index.ts before process.exit in SIGINT/SIGTERM handlers
if (hourlyTrigger) {
  hourlyTrigger.stop();
}
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: integrate auto-reply system into main bot"
```

---

## Phase 6: Claude Code Integration

### Task 10: Create Claude Scanner Skill

**Files:**
- Create: `claude-discord-scanner.md` (skill file)

**Step 1: Create Claude skill for scanning**

```markdown
---
name: discord-auto-reply-scanner
description: Scan for Discord auto-reply triggers and process messages with AI
---

# Discord Auto-Reply Scanner

This skill scans for trigger files created by the Discord bot and processes messages using AI.

## Trigger File Location

Default: `/tmp/discord_triggers.json`

## Process Flow

1. Check if trigger file exists
2. Read trigger data
3. For each channel: Read unprocessed messages → Summarize → Reply
4. For each forum: Read thread with context → Reply individually
5. Delete trigger file

## Usage

Run this skill every 30 seconds or on demand:

```bash
# Manual check
claude --skill discord-auto-reply-scanner

# In cron (every minute)
* * * * * claude --skill discord-auto-reply-scanner
```

## Implementation

```typescript
import * as fs from 'fs';
import { Database } from './src/database/db.js';

const TRIGGER_FILE = '/tmp/discord_triggers.json';

if (!fs.existsSync(TRIGGER_FILE)) {
  console.log('No triggers found');
  process.exit(0);
}

const trigger = JSON.parse(fs.readFileSync(TRIGGER_FILE, 'utf-8'));
const db = new Database('./data/discord_messages.db');

// Process channels
for (const channelId of trigger.channels) {
  await processChannel(channelId, db);
}

// Process forums
for (const forum of trigger.forums) {
  for (const threadId of forum.threads) {
    await processThread(threadId, db);
  }
}

// Delete trigger file
fs.unlinkSync(TRIGGER_FILE);

async function processChannel(channelId: string, db: Database) {
  const messages = db.getUnprocessedMessages(channelId);

  // Build AI prompt
  const prompt = `Summarize the last hour of Discord discussion:\n\n${
    messages.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.author_name}: ${m.content}`).join('\n')
  }\n\nGenerate:\n📊 Main Topics: (3-5 points)\n❓ Q&A: (extract questions and provide answers)\n💡 Highlights:`;

  // Call Claude API or use existing MCP tools
  const summary = await generateSummary(prompt);

  // Send via discord_send
  await callTool('discord_send', {
    channelId,
    message: `【每小时总结】\n${summary}`
  });

  // Mark processed
  db.markMessagesProcessed(channelId);
}

async function processThread(threadId: string, db: Database) {
  const thread = db.getThread(threadId);
  const messages = db.getThreadMessages(threadId);

  // Build context prompt
  const prompt = `You are a Discord customer service assistant.\n\nThread: ${thread.title}\n\nConversation:\n${
    messages.map(m => `${m.author_name}: ${m.content}`).join('\n')
  }\n\nProvide a helpful, professional reply:`;

  const reply = await generateReply(prompt);

  // Send reply
  await callTool('discord_send', {
    channelId: threadId,
    message: reply
  });

  // Mark replied
  db.markThreadReplied(threadId);
}
```

## Notes

- This is a placeholder - actual implementation depends on how Claude Code invokes skills
- May need to use MCP tools directly instead of skill wrapper
- Consider rate limits when processing many channels/threads
```

**Step 2: Commit**

```bash
git add claude-discord-scanner.md
git commit -m "docs: add Claude scanner skill template"
```

---

## Phase 7: Testing & Documentation

### Task 11: Create End-to-End Test Guide

**Files:**
- Create: `docs/AUTO_REPLY_TESTING.md`

**Step 1: Write testing guide**

```markdown
# Auto-Reply Testing Guide

## Prerequisites

1. Discord bot with token
2. Test server with channels and forums
3. Bot has Message Content Intent enabled
4. Bot added to test server

## Configuration

1. Copy `auto-reply-config.json` and set:
```json
{
  "enabled": true,
  "interval": 60,
  "channels": {
    "summary": ["YOUR_CHANNEL_ID"],
    "forums": ["YOUR_FORUM_ID"]
  }
}
```

## Testing Steps

### Test 1: Message Collection

1. Start bot: `npm start`
2. Send message in test channel
3. Check database: `sqlite3 data/discord_messages.db "SELECT * FROM messages"`
4. Verify message appears

### Test 2: History Import

1. Clear database: `rm data/discord_messages.db`
2. Start bot (history import runs automatically)
3. Check database for historical messages
4. Verify timestamps are within configured range

### Test 3: Trigger Generation

1. Wait 1 hour (or modify interval to 60 seconds for testing)
2. Check trigger file: `cat /tmp/discord_triggers.json`
3. Verify it contains channel IDs with unprocessed messages

### Test 4: Claude Processing

1. Manually create trigger file (copy from test 3)
2. Run Claude scanner (once implemented)
3. Check Discord for summary message
4. Verify database shows messages as processed

### Test 5: Forum Replies

1. Create forum post in test forum
2. Wait for trigger (or create manually)
3. Run Claude scanner
4. Verify bot replied to the thread
5. Check database: `bot_replied = 1`

## Debugging

Check logs: `tail -f logs/discord-bot.log`
Check database: `sqlite3 data/discord_messages.db`
Check trigger file: `cat /tmp/discord_triggers.json`
```

**Step 2: Commit**

```bash
git add docs/AUTO_REPLY_TESTING.md
git commit -m "docs: add auto-reply testing guide"
```

---

### Task 12: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Add auto-reply section to README**

Add after the streaming features section:

```markdown
### 🤖 Auto-Reply System (Hybrid Mode)

**New in v1.5.0:** Automatic periodic summaries and contextual forum replies.

#### Features
- **Hourly Channel Summaries**: Automatically summarize discussions in designated channels
- **Forum Auto-Replies**: Individual contextual replies to forum posts
- **Message Persistence**: SQLite database stores all messages for context
- **Historical Import**: Import last 30 days of messages on startup
- **Claude Code Integration**: AI-powered analysis and replies

#### Configuration

Create `auto-reply-config.json`:

```json
{
  "enabled": true,
  "interval": 3600,
  "channels": {
    "summary": ["CHANNEL_ID_1", "CHANNEL_ID_2"],
    "forums": ["FORUM_ID_1", "FORUM_ID_2"]
  }
}
```

#### Usage

1. Configure channels and forums in `auto-reply-config.json`
2. Start bot: `npm start` (history import runs automatically)
3. Set up Claude Code scanner (see [AUTO_REPLY_TESTING.md](docs/AUTO_REPLY_TESTING.md))
4. Bot will create triggers every hour
5. Claude Code processes and replies

For detailed setup, see [Auto-Reply Testing Guide](docs/AUTO_REPLY_TESTING.md).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add auto-reply system to README"
```

---

## Summary

**Total Tasks:** 12
**Estimated Time:** 3-4 hours
**Dependencies:** better-sqlite3, existing Discord.js and MCP infrastructure

**Key Files Created:**
- `src/database/` - Database layer (schema, connection, CRUD)
- `src/auto-reply/` - Auto-reply system (collector, importer, trigger)
- `tests/` - Unit and integration tests
- `docs/plans/` - Design and testing documentation
- `auto-reply-config.json` - Configuration file

**Next Steps After Implementation:**
1. Test with real Discord server
2. Implement Claude Code scanner (depends on how Claude Code invokes external scripts)
3. Monitor performance and tune intervals
4. Gather user feedback
5. Iterate on AI prompts for better summaries/replies

---

**Note on Claude Code Integration:**

Task 10 (Claude Scanner) is a placeholder because the exact mechanism for Claude Code to:
1. Poll for trigger files
2. Read SQLite database
3. Call MCP tools programmatically
4. Run on a schedule

...depends on your Claude Code setup. You may need to:
- Create a cron job that invokes Claude Code with a specific skill
- Use a Node.js script that Claude Code can execute
- Or integrate directly if Claude Code supports long-running background tasks

The core message collection, trigger generation, and database operations are fully implemented and ready to test independently.
