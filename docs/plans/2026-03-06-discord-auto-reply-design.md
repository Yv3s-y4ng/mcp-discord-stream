# Discord Auto-Reply Bot Design

**Date:** 2026-03-06
**Status:** Approved
**Type:** Feature Enhancement (Hybrid Mode)

## Overview

Extend the existing MCP-Discord streaming bot to support automatic periodic replies in two modes:
1. **Channel Summary Mode**: Hourly summaries of #客服 and #问答 channels
2. **Forum Reply Mode**: Individual contextual replies to forum posts in designated forums

## Requirements

### Functional Requirements
- Monitor specified channels and forums for new messages
- Collect and persist messages to SQLite database
- Import historical messages on startup (last 30 days)
- Trigger hourly processing via file-based mechanism
- Claude Code scans for triggers and processes messages
- Generate AI-powered summaries for channels
- Generate contextual AI replies for forum threads
- Track processing state to avoid duplicate replies

### Non-Functional Requirements
- Minimal latency impact on existing MCP operations
- Reliable message persistence (SQLite)
- Graceful error handling (retry logic)
- Support manual triggering for testing

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Discord Server                         │
│   #客服频道    #问答频道    #技术论坛    #产品反馈论坛         │
└─────────────┬────────────────────────────────────────────────┘
              │ messageCreate events
              ↓
┌──────────────────────────────────────────────────────────────┐
│                Discord Bot (Node.js Process)                  │
│  ┌──────────────────┐        ┌──────────────────────────┐   │
│  │  Message         │   →    │    SQLite Database        │   │
│  │  Listener        │        │  - messages (channels)    │   │
│  │  - Channels      │        │  - threads (forums)       │   │
│  │  - Forums        │        │  - thread_messages        │   │
│  │  - History       │        └──────────────────────────┘   │
│  └──────────────────┘                                         │
│           ↓                                                   │
│  ┌──────────────────┐        ┌──────────────────────────┐   │
│  │ Hourly Timer     │   →    │  Trigger File Writer      │   │
│  │  (cron-like)     │        │  /tmp/discord_triggers    │   │
│  └──────────────────┘        └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
              ↓
         Trigger file exists
              ↓
┌──────────────────────────────────────────────────────────────┐
│            Claude Code (30s polling loop)                     │
│  ┌──────────────────┐                                        │
│  │  File Scanner    │  → Detect trigger → Read SQLite        │
│  └──────────────────┘                      ↓                 │
│                      ┌────────────────────────────────┐      │
│                      │    AI Processing Engine        │      │
│                      │                                │      │
│                      │  Channel Mode    Forum Mode    │      │
│                      │  ↓               ↓             │      │
│                      │ Summarize       Reply with     │      │
│                      │ + Q&A           full context   │      │
│                      └────────────────────────────────┘      │
│                                ↓                              │
│                    Call discord_send (MCP tool)               │
└──────────────────────────────────────────────────────────────┘
```

## Data Model

### messages table (Channel messages)
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,           -- Discord message ID
  channel_id TEXT NOT NULL,      -- Channel ID
  channel_name TEXT,             -- Channel name
  author_id TEXT NOT NULL,       -- Author ID
  author_name TEXT,              -- Author name
  content TEXT,                  -- Message content
  timestamp INTEGER NOT NULL,    -- Unix timestamp
  processed BOOLEAN DEFAULT 0,   -- Processing flag
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_messages_channel ON messages(channel_id, processed);
```

### threads table (Forum threads)
```sql
CREATE TABLE threads (
  id TEXT PRIMARY KEY,           -- Thread ID
  forum_id TEXT NOT NULL,        -- Parent forum ID
  forum_name TEXT,               -- Forum name
  title TEXT,                    -- Thread title
  author_id TEXT,                -- Thread creator
  created_at INTEGER,            -- Creation timestamp
  last_message_at INTEGER,       -- Last activity timestamp
  bot_replied BOOLEAN DEFAULT 0, -- Reply flag
  message_count INTEGER DEFAULT 0
);
CREATE INDEX idx_threads_forum ON threads(forum_id, bot_replied);
```

### thread_messages table (Forum thread messages)
```sql
CREATE TABLE thread_messages (
  id TEXT PRIMARY KEY,           -- Message ID
  thread_id TEXT NOT NULL,       -- Parent thread ID
  author_id TEXT NOT NULL,       -- Author ID
  author_name TEXT,              -- Author name
  content TEXT,                  -- Message content
  timestamp INTEGER NOT NULL,    -- Unix timestamp
  is_bot BOOLEAN DEFAULT 0,      -- Bot message flag
  FOREIGN KEY (thread_id) REFERENCES threads(id)
);
CREATE INDEX idx_thread_messages ON thread_messages(thread_id, timestamp);
```

## Core Components

### 1. Message Collector (Bot-side)
- Listens to `messageCreate` events
- Filters messages by configured channel/forum IDs
- Inserts into appropriate database tables
- Handles both real-time and historical messages

### 2. History Importer (Bot-side)
- Runs on startup
- Uses existing `discord_read_messages_stream` for channels
- Uses existing `discord_archive_forum_stream` for forums
- Imports last 30 days of messages
- Marks imported messages as unprocessed

### 3. Hourly Trigger (Bot-side)
- Interval timer (every 3600 seconds)
- Queries database for unprocessed messages
- Generates trigger file: `/tmp/discord_triggers.json`
- Trigger format:
```json
{
  "timestamp": 1234567890,
  "channels": ["channel_id_1", "channel_id_2"],
  "forums": [
    {
      "forumId": "forum_id_1",
      "threads": ["thread_id_1", "thread_id_2"]
    }
  ]
}
```

### 4. Claude Scanner (Claude Code side)
- Polling loop (every 30 seconds)
- Detects trigger file existence
- Reads SQLite database
- Processes channels and threads
- Deletes trigger file after completion

### 5. AI Processing Engine (Claude Code side)

**Channel Mode:**
- Fetch unprocessed messages from last hour
- AI prompt: Summarize topics + extract Q&A
- Generate formatted summary message
- Send via `discord_send` MCP tool
- Mark messages as processed

**Forum Mode:**
- Fetch thread with full message history
- AI prompt: Understand context + generate helpful reply
- Send reply via `discord_send` to thread
- Mark thread as `bot_replied = true`

## Configuration

```typescript
// config.json
{
  "autoReply": {
    "enabled": true,
    "interval": 3600,  // 1 hour in seconds
    "channels": {
      "summary": ["1234567890", "0987654321"],  // #客服、#问答
      "forums": ["1111111111", "2222222222"]    // #技术论坛、#产品反馈
    },
    "triggerFile": "/tmp/discord_triggers.json",
    "database": "./data/discord_messages.db"
  },
  "historyImport": {
    "enabled": true,
    "daysBack": 30
  }
}
```

## AI Prompts

### Channel Summary Prompt
```
You are a Discord community assistant. Summarize the last hour of discussion in #{channel_name}.

Messages:
[timestamp] {author}: {content}
[timestamp] {author}: {content}
...

Generate a structured summary:
📊 Main Topics: (3-5 bullet points)
❓ Q&A: (Question → Answer format)
💡 Key Highlights: (important announcements or decisions)

Keep it concise and actionable.
```

### Forum Reply Prompt
```
You are a Discord customer service assistant. A user posted a question in the forum.

Thread Title: {title}
Full Conversation:
[timestamp] {author}: {content}
[timestamp] {author}: {content}
...

Analyze the conversation and provide a helpful, professional reply.
Consider the full context and any previous messages in the thread.
Be friendly, clear, and solution-oriented.
```

## Error Handling

| Error Type | Strategy |
|------------|----------|
| SQLite lock | Retry 3 times with exponential backoff |
| Discord API failure | Log error, skip this cycle, retry next hour |
| Claude timeout | Skip message, retry next trigger |
| Trigger file conflict | Use atomic write (write to temp + rename) |
| Database corruption | Log critical error, notify admin via Discord |

## Testing Strategy

### Unit Tests
- Database operations (insert, query, update)
- Message filtering logic
- Trigger file generation

### Integration Tests
1. Send test message to monitored channel
2. Verify database insertion
3. Manually create trigger file
4. Verify Claude processes and replies
5. Check processing flags

### Manual Testing
1. Configure test channels/forums
2. Send various message types
3. Wait for hourly trigger
4. Verify summaries and replies
5. Test edge cases (empty hour, many messages, special characters)

## Deployment Plan

### Phase 1: Database & Message Collection (Week 1)
- Add SQLite dependency
- Implement database schema
- Add message listener
- Test message persistence

### Phase 2: History Import (Week 1)
- Implement history importer using streaming tools
- Test with small date range
- Import full 30-day history

### Phase 3: Trigger Mechanism (Week 2)
- Implement hourly timer
- Implement trigger file writer
- Test trigger generation

### Phase 4: Claude Scanner (Week 2)
- Implement file polling loop
- Test database reading
- Implement processing logic

### Phase 5: AI Integration (Week 3)
- Implement channel summary logic
- Implement forum reply logic
- Test AI prompts and output formatting

### Phase 6: End-to-End Testing (Week 3)
- Full integration testing
- Performance testing (handle 1000+ messages)
- Error scenario testing

### Phase 7: Production Deployment (Week 4)
- Deploy to production environment
- Monitor first 24 hours closely
- Gather user feedback
- Iterate based on feedback

## Future Enhancements

- Real-time mode (immediate replies instead of hourly)
- Multi-language support
- Sentiment analysis (prioritize urgent/negative messages)
- User preferences (opt-in/opt-out for summaries)
- Analytics dashboard (response rate, topics, sentiment trends)
- Knowledge base integration (FAQ database)

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database growth | High | High | Implement message retention policy (delete after 90 days) |
| Claude downtime | Medium | Low | Queue messages, process when Claude returns |
| Rate limiting (Discord API) | Medium | Medium | Implement backoff, batch operations |
| Incorrect AI replies | High | Medium | Add human review mode for first 2 weeks |
| Performance degradation | Medium | Low | Monitor DB size, optimize queries, add indexes |

## Success Metrics

- **Coverage**: 95%+ of messages collected
- **Latency**: Summaries posted within 5 minutes of hour mark
- **Accuracy**: 90%+ user satisfaction with AI replies
- **Reliability**: 99%+ uptime for message collection
- **Performance**: Handle 10,000 messages/day without issues

## Approval

✅ Approved by user on 2026-03-06

---

**Next Steps:**
1. Create detailed implementation plan (via writing-plans skill)
2. Set up development branch
3. Begin Phase 1 implementation
