# Manual Testing Checklist

This checklist covers all tools and features in mcp-discord-stream. Test these before publishing or deploying.

## Prerequisites

- [ ] Discord bot token configured
- [ ] Bot added to at least one test server
- [ ] Bot has "Read Message History" permission
- [ ] Test server has at least one forum channel
- [ ] Test server has messages older than 10 days (for time-range testing)

## Setup

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript successfully
- [ ] `npm test` runs all tests and passes
- [ ] MCP server starts without errors via `node build/index.js --config <TOKEN>`

## Basic Functions

### discord_login
- [ ] Login with valid token succeeds
- [ ] Login with invalid token returns error
- [ ] Auto-login on startup works (with DISCORD_TOKEN env var)

### discord_list_servers
- [ ] Returns list of servers bot is member of
- [ ] Shows correct server names and IDs
- [ ] Returns empty array if bot is not in any servers

### discord_send
- [ ] Sends message to text channel successfully
- [ ] Returns message ID after sending
- [ ] Fails with clear error for invalid channel ID
- [ ] Reply to message works with `replyToMessageId`

### discord_get_server_info
- [ ] Returns server info (name, member count, channels)
- [ ] Works for all servers bot is in
- [ ] Fails gracefully for invalid guild ID

## Channel Management

### discord_create_text_channel
- [ ] Creates text channel successfully
- [ ] Returns channel ID
- [ ] Optional topic parameter works
- [ ] Fails without proper permissions

### discord_delete_channel
- [ ] Deletes channel successfully
- [ ] Optional reason parameter works
- [ ] Fails for invalid channel ID

### discord_get_channel_list
- [ ] Lists all channels in server
- [ ] Shows correct channel types (0=text, 15=forum, etc.)
- [ ] `channelTypes` filter works correctly
- [ ] Returns channels with parentId (for category organization)

### discord_create_category / discord_edit_category / discord_delete_category
- [ ] Category creation works
- [ ] Category editing (name, position) works
- [ ] Category deletion works

## Forum Functions

### discord_get_forum_channels
- [ ] Lists all forum channels in server
- [ ] Shows forum names and IDs
- [ ] Returns empty array if no forums exist

### discord_create_forum_post
- [ ] Creates forum post with title and content
- [ ] Optional tags parameter works
- [ ] Returns thread ID

### discord_get_forum_post
- [ ] Retrieves forum post details
- [ ] Shows messages from thread (up to 10)
- [ ] Works for both active and archived threads

### discord_list_forum_threads
- [ ] Lists all threads in forum
- [ ] `includeArchived` parameter works
- [ ] Shows thread metadata (created date, message count, owner)
- [ ] `limit` parameter works

### discord_reply_to_forum
- [ ] Adds reply to forum thread
- [ ] Returns message ID

### discord_delete_forum_post
- [ ] Deletes forum thread
- [ ] Optional reason parameter works

## 🆕 Streaming Tools

### discord_read_messages_stream
- [ ] Fetches unlimited messages from channel (not just 100)
- [ ] Default time range (10 days) works
- [ ] `afterDate` parameter filters correctly
- [ ] `beforeDate` parameter filters correctly
- [ ] Both date parameters together work
- [ ] Returns batch events with message data
- [ ] Returns progress events during long fetches
- [ ] Returns complete event at end
- [ ] Handles empty channels gracefully
- [ ] Rate limit handling works (returns partial_complete + wait time)

**Test Cases:**
- [ ] Small channel (<100 messages) - completes in 1 batch
- [ ] Large channel (>1000 messages) - multiple batches
- [ ] Very old messages (from before bot joined) - accessible with proper permissions
- [ ] Time range: last 24 hours only
- [ ] Time range: specific week (e.g., Jan 1-7, 2024)

### discord_read_multiple_channels
- [ ] Processes multiple channels sequentially
- [ ] Returns results for each channel
- [ ] Shows success/error status per channel
- [ ] Works with mixed valid/invalid channel IDs
- [ ] Time-range filtering applies to all channels

**Test Cases:**
- [ ] 2 channels with ~100 messages each
- [ ] 5+ channels (watch for rate limits)
- [ ] Mix of text channels and threads

### discord_get_forum_post_stream
- [ ] Fetches all messages from forum thread (unlimited)
- [ ] Default time range works
- [ ] Time-range filtering works
- [ ] Works for both active and archived threads
- [ ] Returns all message data with full structure

**Test Cases:**
- [ ] Small thread (<10 messages)
- [ ] Large thread (>100 messages)
- [ ] Very old thread

### discord_archive_forum_stream
- [ ] Archives entire forum channel
- [ ] Finds all active threads
- [ ] `includeArchived` parameter works
- [ ] Returns threads_found event
- [ ] Returns thread_progress events
- [ ] Streams messages from each thread
- [ ] Returns complete summary at end
- [ ] Time-range filtering applies to messages

**Test Cases:**
- [ ] Small forum (5 threads, <50 messages each)
- [ ] Large forum (20+ threads, 100+ messages each)
- [ ] Forum with archived threads only
- [ ] Empty forum

### discord_archive_multiple_forums
- [ ] Processes multiple forums sequentially
- [ ] Returns results for each forum
- [ ] Handles errors gracefully (e.g., one forum inaccessible)
- [ ] Time-range filtering works across all forums

**Test Cases:**
- [ ] 2 small forums
- [ ] 3+ forums (watch for rate limits and duration)

## Messages and Reactions

### discord_read_messages
- [ ] Reads last N messages from channel (up to 100)
- [ ] Default limit (50) works
- [ ] Custom limit works
- [ ] Returns message data (content, author, timestamp)
- [ ] Shows attachments and embeds count

### discord_search_messages
- [ ] Searches messages in server by content
- [ ] Filters by author ID work
- [ ] Filters by channel ID work
- [ ] Filters by message type (link, embed, file, etc.) work
- [ ] Sort order (timestamp, relevance) works
- [ ] Pagination (limit, offset) works

### discord_add_reaction / discord_add_multiple_reactions / discord_remove_reaction
- [ ] Adds single emoji reaction
- [ ] Adds multiple emoji reactions
- [ ] Removes emoji reaction
- [ ] Works with custom server emojis
- [ ] Works with Unicode emojis

### discord_delete_message
- [ ] Deletes message successfully
- [ ] Optional reason parameter works
- [ ] Fails for messages bot doesn't have permission to delete

## Webhook Management

### discord_create_webhook
- [ ] Creates webhook for channel
- [ ] Optional avatar parameter works
- [ ] Returns webhook ID and token

### discord_send_webhook_message
- [ ] Sends message via webhook
- [ ] Custom username works
- [ ] Custom avatarURL works
- [ ] `threadId` parameter works for forum channels

### discord_edit_webhook / discord_delete_webhook
- [ ] Webhook editing works
- [ ] Webhook deletion works

## Edge Cases & Error Handling

- [ ] Invalid channel ID returns clear error
- [ ] Invalid guild ID returns clear error
- [ ] Bot not logged in returns "Discord client not logged in" error
- [ ] Missing permissions return clear permission errors
- [ ] Rate limits trigger graceful handling (partial data + wait time)
- [ ] Empty results return appropriate empty array/object

## Performance & Rate Limits

- [ ] Streaming large channels completes without crashes
- [ ] Rate limit warnings appear in logs when hit
- [ ] Partial data is returned when rate limited (not total failure)
- [ ] Multiple concurrent streaming operations don't cause crashes
- [ ] Memory usage stays reasonable during large archives

## Integration Testing with Claude/Cursor

### Claude Desktop
- [ ] MCP server appears in Claude settings
- [ ] Tools are discoverable via autocomplete
- [ ] Tool calls execute successfully
- [ ] Streaming tools return data in Claude chat
- [ ] Error messages display clearly

### Cursor IDE (if applicable)
- [ ] MCP server connects successfully
- [ ] Tools work in Cursor agent context

## Final Checklist

- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] README.md is accurate and complete
- [ ] package.json version is correct
- [ ] Git repository has clean history
- [ ] All commits have proper messages
- [ ] No sensitive data (tokens, keys) in code or commits

## Publishing Readiness

- [ ] `npm login` completed
- [ ] Package name `@yangyifei/mcp-discord-stream` is available on npm
- [ ] `.npmignore` or `files` field in package.json is correct
- [ ] LICENSE file exists
- [ ] README.md has installation instructions
- [ ] All dependencies are in package.json
- [ ] No dev dependencies leak into production build

---

## Testing Notes

Use this section to record any issues found during testing:

```
Date: ____
Tester: ____

Issues Found:
1.
2.
3.

Resolution:
-
-
-
```

## Automated Test Coverage

Current test coverage (from `npm run test:coverage`):

- MessageStreamer: ✅ Covered
- ForumStreamer: ✅ Covered
- Stream types: ✅ Covered
- Schemas: ✅ Covered (via handler integration)
- Handlers: ⚠️ Manual testing required (Discord API calls)

**Note:** Handler-level tests require actual Discord API integration, which is why manual testing is essential.
