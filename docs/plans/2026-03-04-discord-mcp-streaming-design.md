# Discord MCP Streaming Enhancement Design

**Date:** 2026-03-04
**Author:** Yang Yifei
**Status:** Approved

## Executive Summary

This design adds streaming capabilities to the mcp-discord project, enabling full historical message retrieval from Discord channels and forums with real-time progress feedback. The enhancement addresses the core limitation of the current implementation: hard-coded message limits and lack of pagination support.

## Problem Statement

### Current Limitations

1. **discord_get_forum_post**: Hard-coded 10-message limit
2. **discord_read_messages**: Maximum 100 messages, no pagination
3. No time-range filtering
4. Cannot read full history from channels/forums
5. No progress feedback for long-running operations

### User Requirements

- Read ALL historical messages from channels and forums
- Support time-range filtering (default: last 10 days)
- Real-time progress updates during data fetching
- Handle Discord rate limits gracefully
- Flexible channel/forum selection (single or batch)

## Solution Design

### Architecture Overview

```
New Components:
src/tools/stream/
├── messageStreamer.ts    # Core message streaming logic
├── forumStreamer.ts      # Forum-specific streaming
└── rateLimit.ts          # Rate limit detection & handling

Enhanced Tools:
src/tools/
├── channel.ts            # Add streaming tools
└── forum.ts              # Add streaming tools

Updated:
src/schemas.ts            # New tool schemas
src/toolList.ts           # Register new tools
```

### New Tools (6 total)

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `discord_read_messages_stream` | Stream all messages from a single channel | channelId, afterDate, beforeDate |
| `discord_read_multiple_channels` | Batch read multiple channels | channelIds[], afterDate, beforeDate |
| `discord_get_forum_post_stream` | Stream all messages from a forum thread | threadId, afterDate, beforeDate |
| `discord_archive_forum_stream` | Archive entire forum (all threads + messages) | forumChannelId, afterDate, beforeDate |
| `discord_archive_multiple_forums` | Batch archive multiple forums | forumChannelIds[], afterDate, beforeDate |
| `discord_get_channel_list` | List all channels in a server | guildId, channelType (optional filter) |

### Streaming Protocol

**Event Types:**

```typescript
type StreamEvent =
  | { type: 'progress', fetched: number, oldest?: Date, newest?: Date }
  | { type: 'batch', messages: Message[], batchNumber: number, total: number }
  | { type: 'rate_limited', fetched: number, retryAfter: number }
  | { type: 'complete', totalFetched: number, duration: string }
  | { type: 'threads_found', count: number, estimated: string }
  | { type: 'thread_progress', current: number, total: number, threadName: string }
  | { type: 'partial_complete', threadsProcessed: number, totalThreads: number, retryAfter: number };
```

**Flow:**
1. Tool invoked with parameters
2. Create Streamer instance with time range
3. Start async generator loop
4. Yield progress events every 3 seconds
5. Yield batch events with actual messages (100 per batch)
6. On rate limit: yield rate_limited event and stop
7. On completion: yield complete event with summary

### Time Range Handling

**Default Behavior:**
- If no dates specified: `afterDate = now - 10 days`, `beforeDate = now`
- If only afterDate: `beforeDate = now`
- If only beforeDate: `afterDate = unlimited` (fetch all history until beforeDate)

**Implementation:**
```typescript
const timeRange = {
  after: afterDate ? new Date(afterDate) : new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  before: beforeDate ? new Date(beforeDate) : new Date()
};
```

### Rate Limit Strategy

**On Rate Limit Hit:**
1. Stop fetching immediately
2. Return all messages fetched so far
3. Include `retryAfter` seconds in response
4. User can call again with same parameters to continue

**Example Response:**
```json
{
  "type": "rate_limited",
  "fetched": 1247,
  "messages": [...],
  "retryAfter": 60,
  "suggestion": "Wait 60 seconds and call again with same parameters to continue"
}
```

### Channel/Forum Selection

**Single Selection:**
```typescript
discord_read_messages_stream({ channelId: "123456", afterDate: "2026-02-21" })
```

**Batch Selection:**
```typescript
discord_read_multiple_channels({
  channelIds: ["123", "456", "789"],
  afterDate: "2026-02-21"
})
// Sequentially process each channel, yield progress per channel
```

**Discovery Workflow:**
1. Call `discord_get_channel_list({ guildId: "server-id" })`
2. User selects desired channel IDs
3. Call streaming tools with selected IDs

## Data Flow

```
User Call → Validate Parameters → Create Streamer
    ↓
Calculate Time Range (default: 10 days)
    ↓
Loop: Fetch 100 messages (Discord API limit)
    ↓
Filter by time range
    ↓
Yield batch event → MCP → Claude → User sees progress
    ↓
Check continuation conditions:
  - Time range exceeded? → STOP
  - Rate limited? → yield rate_limited → STOP
  - No more messages? → STOP
  - Otherwise: continue with next batch (before = last message ID)
    ↓
Yield complete event with total count
```

## Error Handling

### 1. Rate Limit
- **Action:** Return partial data + retry suggestion
- **User Experience:** "Fetched 500 messages. Wait 60s to continue."

### 2. Permission Denied
- **Action:** Return error with required permissions
- **User Experience:** "Missing 'Read Message History' permission on channel #tech-discussion"

### 3. Invalid Channel/Forum ID
- **Action:** Return error with suggestion to list channels
- **User Experience:** "Channel not found. Use discord_get_channel_list to see available channels."

### 4. Large Forum Warning
- **Action:** Warn before processing forums with 100+ threads
- **User Experience:** "Found 200 threads, estimated 15 minutes. Continue?"

### 5. Time Range Too Large
- **Action:** Warn if date range > 365 days
- **User Experience:** "Time range: 365 days. May fetch tens of thousands of messages. Consider narrowing range."

### 6. Network Interruption
- **Action:** Return partial data, user can resume by calling again
- **User Experience:** "Network error after 750 messages. Call again to continue from last position."

## Component Design

### MessageStreamer Class

```typescript
class MessageStreamer {
  constructor(
    private channel: TextBasedChannel,
    private options: {
      afterDate?: Date;
      beforeDate?: Date;
      defaultDays: number;
    }
  ) {}

  async *stream(): AsyncGenerator<StreamEvent> {
    const timeRange = this.calculateTimeRange();
    let before: string | undefined;
    let total = 0;
    let batchNumber = 0;

    while (true) {
      try {
        const batch = await this.channel.messages.fetch({ limit: 100, before });
        const filtered = this.filterByTime(batch, timeRange);

        total += filtered.length;
        batchNumber++;

        yield {
          type: 'batch',
          messages: filtered,
          batchNumber,
          total
        };

        if (!this.shouldContinue(batch, filtered, timeRange)) break;

        before = batch.last().id;
        await this.checkRateLimit(); // Throws if rate limited

      } catch (error) {
        if (this.isRateLimitError(error)) {
          yield {
            type: 'rate_limited',
            fetched: total,
            retryAfter: error.retryAfter
          };
          break;
        }
        throw error;
      }
    }

    yield { type: 'complete', total };
  }
}
```

### ForumStreamer Class

```typescript
class ForumStreamer {
  async *streamForum(
    forumChannel: ForumChannel,
    options: TimeRangeOptions
  ): AsyncGenerator<StreamEvent> {

    // 1. Get all threads
    const threads = await this.getAllThreads(forumChannel);

    yield {
      type: 'threads_found',
      count: threads.length,
      estimated: `~${threads.length * 50} messages`
    };

    // 2. Process each thread
    const results = [];
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];

      yield {
        type: 'thread_progress',
        current: i + 1,
        total: threads.length,
        threadName: thread.name
      };

      const streamer = new MessageStreamer(thread, options);
      const messages = [];

      for await (const event of streamer.stream()) {
        if (event.type === 'batch') {
          messages.push(...event.messages);
        } else if (event.type === 'rate_limited') {
          yield {
            type: 'partial_complete',
            threadsProcessed: i,
            totalThreads: threads.length,
            messages: results,
            retryAfter: event.retryAfter
          };
          return;
        }
      }

      results.push({
        threadId: thread.id,
        threadName: thread.name,
        messages
      });
    }

    yield { type: 'complete', threads: results, totalThreads: threads.length };
  }
}
```

## Backward Compatibility

**Existing 18 tools remain unchanged:**
- Original tools continue to work as before
- New tools are additions, not replacements
- No breaking changes to existing functionality
- Users can migrate gradually to streaming tools

## Testing Strategy

### Unit Tests
- MessageStreamer time filtering
- Rate limit detection
- Batch size validation

### Integration Tests
1. Single channel with 150 messages (requires 2 batches)
2. Forum with 3 threads
3. Rate limit simulation (mock API)
4. Time range edge cases (empty result, all history)

### Manual Testing Checklist
- [ ] Read 500+ messages from test channel
- [ ] Archive forum with 5+ threads
- [ ] Trigger rate limit and verify partial return
- [ ] Test with invalid channel ID
- [ ] Test time range filtering (last 7 days)
- [ ] Batch read 3 channels

## Deployment Plan

### Phase 1: Local Development (Current)
1. Implement core streaming logic
2. Add new tools to toolList
3. Test with personal Discord server

### Phase 2: Local Testing
1. Configure Claude Desktop to use local build
2. Validate all 6 new tools
3. Test error scenarios

### Phase 3: npm Publishing
1. Update package.json:
   - `name`: `@yangyifei/mcp-discord-stream`
   - `version`: `1.0.0`
   - `description`: Add streaming capabilities note
2. `npm publish --access public`
3. Test installation: `npx @yangyifei/mcp-discord-stream`

### Phase 4: Documentation
1. Update README with streaming tool examples
2. Add CHANGELOG.md
3. Document rate limit behavior
4. Provide migration guide from original tools

## Future Enhancements (Out of Scope)

- Parallel forum thread fetching (current: sequential)
- Message content search/filtering during streaming
- Export to JSON/CSV files
- Resume from specific message ID (bookmark support)
- WebSocket-based real-time updates

## Success Criteria

- ✅ Can read 1000+ messages from a channel
- ✅ Forum with 50+ threads archives successfully
- ✅ Rate limit returns partial data + retry suggestion
- ✅ Time range filtering works correctly (default 10 days)
- ✅ Real-time progress visible in Claude Code
- ✅ Backward compatible (all existing tools work)
- ✅ Published to npm as `@yangyifei/mcp-discord-stream`

## Timeline

- **Core Implementation:** 3-4 hours
- **Testing & Debugging:** 1-2 hours
- **Documentation & Publishing:** 1 hour
- **Total:** 5-7 hours

## Appendix: Example Usage

### Read Last 10 Days from Channel
```typescript
discord_read_messages_stream({
  channelId: "1234567890",
  // Uses defaults: afterDate = 10 days ago, beforeDate = now
})
```

### Archive Specific Date Range
```typescript
discord_archive_forum_stream({
  forumChannelId: "9876543210",
  afterDate: "2026-01-01",
  beforeDate: "2026-02-01"
})
```

### Batch Read Multiple Channels
```typescript
discord_read_multiple_channels({
  channelIds: ["123", "456", "789"],
  afterDate: "2026-02-25"
})
```

### Discover Available Channels
```typescript
// Step 1: List channels
discord_get_channel_list({ guildId: "server-id" })

// Returns: [
//   { id: "123", name: "general", type: "text" },
//   { id: "456", name: "tech-discussion", type: "text" },
//   { id: "789", name: "bug-reports", type: "forum" }
// ]

// Step 2: Select and read
discord_read_messages_stream({ channelId: "456" })
```
