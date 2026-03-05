# MCP-Discord Stream

[![npm version](https://img.shields.io/npm/v/@yangyifei/mcp-discord-stream)](https://www.npmjs.com/package/@yangyifei/mcp-discord-stream) ![](https://badge.mcpx.dev?type=server 'MCP Server')

A Discord MCP (Model Context Protocol) server with **unlimited message streaming**, forum archiving, and time-range filtering capabilities.

> **Fork Notice:** This is an enhanced fork of [barryyip0625/mcp-discord](https://github.com/barryyip0625/mcp-discord) with added streaming capabilities for reading unlimited Discord history.

## Overview

MCP-Discord Stream provides comprehensive Discord integration with powerful streaming features:

### 🆕 Streaming Features (New!)
- **Unlimited Message History** - Read ALL messages from channels/forums (not limited to 100 messages)
- **Time Range Filtering** - Fetch messages from specific date ranges (default: last 10 days)
- **Forum Archiving** - Archive entire forums with all threads and messages
- **Batch Operations** - Stream from multiple channels/forums simultaneously
- **Progress Tracking** - Real-time progress updates during long operations
- **Rate Limit Handling** - Gracefully handles Discord rate limits with partial data returns

### Standard Features
- Login to Discord bot
- List servers the bot is a member of
- Get server information
- Search messages in a server
- Read/delete channel messages
- Send messages to specified channels
- Retrieve forum channel lists
- Create/delete/reply to forum posts
- Create/delete text channels
- Add/remove message reactions
- Create/edit/delete/use webhooks

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Tools Documentation](#tools-documentation)
  - [🆕 Streaming Tools](#-streaming-tools-new)
  - [Basic Functions](#basic-functions)
  - [Channel Management](#channel-management)
  - [Forum Functions](#forum-functions)
  - [Messages and Reactions](#messages-and-reactions)
  - [Webhook Management](#webhook-management)
- [Streaming Features Explained](#streaming-features-explained)
- [Development](#development)
- [License](#license)

## Prerequisites

- Node.js (v18.0.0 or higher)
- npm (v7.0.0 or higher)
- A Discord bot with appropriate permissions
  - Bot token (obtainable from the [Discord Developer Portal](https://discord.com/developers/applications))
  - **Message Content Intent enabled** (Required!)
  - Server Members Intent enabled
  - Presence Intent enabled
- Permissions required in your Discord server:

  #### Easiest Setup
  - Administrator (Recommended for quick setup and full functionality)

  #### Or, select only the required permissions:
  - View Channel
  - **Read Message History** (Required for streaming!)
  - Send Messages
  - Create Public Threads
  - Send Messages in Threads
  - Manage Messages
  - Manage Threads
  - Manage Channels
  - Manage Webhooks
  - Add Reactions

- Add your Discord bot to your server
  - To add your Discord bot to your server, use one of the following invite links (replace `INSERT_CLIENT_ID_HERE` with your bot's client ID):
    - **Administrator (full access):**
        https://discord.com/oauth2/authorize?client_id=INSERT_CLIENT_ID_HERE&scope=bot&permissions=8
    - **Custom permissions (minimum required):**
        https://discord.com/oauth2/authorize?client_id=INSERT_CLIENT_ID_HERE&scope=bot&permissions=52076489808

> **Important:**
> According to Discord's security model, a bot can only access information from servers it has been explicitly added to.
> **With "Read Message History" permission, the bot CAN read messages sent before it was added to the server!**

## Installation

### Installing via NPM

```bash
npm install -g @yangyifei/mcp-discord-stream
```

Or use directly via npx:
```bash
npx @yangyifei/mcp-discord-stream --config ${DISCORD_TOKEN}
```

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/yangyifei/mcp-discord-stream.git
cd mcp-discord-stream

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

## Configuration

A Discord bot token is required for proper operation. The server supports two transport methods: stdio and streamable HTTP.

### Transport Methods

1. **stdio** (Default)
   - Traditional stdio transport for basic usage
   - Suitable for simple integrations

2. **streamable HTTP**
   - HTTP-based transport for more advanced scenarios
   - Supports stateless operation
   - Configurable port number

### Configuration Options

You can provide configuration in two ways:

1. Environment variables:
```bash
DISCORD_TOKEN=your_discord_bot_token
```

2. Using command line arguments:
```bash
# For stdio transport (default)
node build/index.js --config "your_discord_bot_token"

# For streamable HTTP transport
node build/index.js --transport http --port 3000 --config "your_discord_bot_token"
```

## Usage with Claude/Cursor

### Claude Desktop

1. Using stdio transport:
```json
{
    "mcpServers": {
        "discord": {
            "command": "npx",
            "args": [
                "@yangyifei/mcp-discord-stream",
                "--config",
                "your_discord_bot_token"
            ]
        }
    }
}
```

2. Using streamable HTTP transport:
```json
{
    "mcpServers": {
        "discord": {
            "command": "npx",
            "args": [
                "@yangyifei/mcp-discord-stream",
                "--transport",
                "http",
                "--port",
                "3000",
                "--config",
                "your_discord_bot_token"
            ]
        }
    }
}
```

### Cursor

1. Using stdio transport:
```json
{
    "mcpServers": {
        "discord": {
            "command": "cmd",
            "args": [
                "/c",
                "npx",
                "@yangyifei/mcp-discord-stream",
                "--config",
                "your_discord_bot_token"
            ]
        }
    }
}
```

## Usage Examples

### Example 1: Stream ALL Messages from a Channel
```javascript
// Fetch last 30 days of messages (unlimited)
discord_read_messages_stream({
  channelId: "123456789",
  afterDate: "2024-01-01T00:00:00Z"  // Optional: start from this date
})
```

### Example 2: Archive Entire Forum
```javascript
// Archive all forum threads with messages from last 60 days
discord_archive_forum_stream({
  forumChannelId: "987654321",
  afterDate: "2024-01-01T00:00:00Z",
  includeArchived: true
})
```

### Example 3: Batch Archive Multiple Forums
```javascript
// Archive 3 forums at once
discord_archive_multiple_forums({
  forumChannelIds: ["111", "222", "333"],
  afterDate: "2024-01-01T00:00:00Z"
})
```

## Tools Documentation

### 🆕 Streaming Tools (New!)

#### `discord_read_messages_stream`
Streams messages from a Discord channel with unlimited history and time-range filtering.

**Parameters:**
- `channelId` (string, required) - The ID of the channel to read from
- `afterDate` (string, optional) - ISO 8601 date string (e.g., "2024-01-01T00:00:00Z") - only fetch messages after this date
- `beforeDate` (string, optional) - ISO 8601 date string - only fetch messages before this date

**Default:** If no date range is provided, fetches messages from the last 10 days.

**Returns:**
- Stream events including `batch`, `progress`, `rate_limited`, and `complete` events
- Each batch contains up to 100 messages with full message data (content, author, timestamp, attachments, etc.)

#### `discord_read_multiple_channels`
Streams messages from multiple channels sequentially.

**Parameters:**
- `channelIds` (string[], required) - Array of channel IDs to read from
- `afterDate` (string, optional) - ISO 8601 date string
- `beforeDate` (string, optional) - ISO 8601 date string

**Returns:** Aggregated results from all channels with success/error status for each.

#### `discord_get_channel_list`
Lists all channels in a Discord server with optional type filtering.

**Parameters:**
- `guildId` (string, required) - The ID of the Discord server
- `channelTypes` (number[], optional) - Array of Discord ChannelType numbers to filter by
  - `0` = Text Channel
  - `2` = Voice Channel
  - `4` = Category
  - `15` = Forum Channel
  - [Full ChannelType list](https://discord-api-types.dev/api/discord-api-types-v10/enum/ChannelType)

**Returns:** List of channels with id, name, type, and parentId.

#### `discord_get_forum_post_stream`
Streams all messages from a single forum post/thread with unlimited history.

**Parameters:**
- `threadId` (string, required) - The ID of the forum thread
- `afterDate` (string, optional) - ISO 8601 date string
- `beforeDate` (string, optional) - ISO 8601 date string

**Returns:** Stream events with all messages from the thread.

#### `discord_archive_forum_stream`
Archives an entire forum channel by streaming all threads and their messages.

**Parameters:**
- `forumChannelId` (string, required) - The ID of the forum channel
- `afterDate` (string, optional) - ISO 8601 date string
- `beforeDate` (string, optional) - ISO 8601 date string
- `includeArchived` (boolean, optional, default: true) - Whether to include archived threads

**Returns:**
- `threads_found` event with total thread count
- `thread_progress` events for each thread being processed
- Message batches from all threads
- `complete` or `partial_complete` event with summary

#### `discord_archive_multiple_forums`
Archives multiple forum channels at once.

**Parameters:**
- `forumChannelIds` (string[], required) - Array of forum channel IDs
- `afterDate` (string, optional) - ISO 8601 date string
- `beforeDate` (string, optional) - ISO 8601 date string
- `includeArchived` (boolean, optional, default: true) - Include archived threads

**Returns:** Aggregated results from all forums.

---

### Basic Functions

- `discord_login`: Login to Discord using the configured token
- `discord_list_servers`: List all Discord servers the bot is a member of
- `discord_send`: Send a message to a specified channel (supports both channel ID and channel name)
- `discord_get_server_info`: Get Discord server information

### Channel Management

- `discord_create_text_channel`: Create a text channel
- `discord_delete_channel`: Delete a channel
- `discord_create_category`: Create a channel category
- `discord_edit_category`: Edit a category
- `discord_delete_category`: Delete a category

### Forum Functions

- `discord_get_forum_channels`: Get a list of forum channels
- `discord_create_forum_post`: Create a forum post
- `discord_get_forum_post`: Get a forum post (limited to 10 messages - use `discord_get_forum_post_stream` for more)
- `discord_list_forum_threads`: List all threads in a forum
- `discord_reply_to_forum`: Reply to a forum post
- `discord_delete_forum_post`: Delete a forum post

### Messages and Reactions

- `discord_search_messages`: Search messages in a server
- `discord_read_messages`: Read channel messages (limited to 100 - use `discord_read_messages_stream` for more)
- `discord_add_reaction`: Add a reaction to a message
- `discord_add_multiple_reactions`: Add multiple reactions to a message
- `discord_remove_reaction`: Remove a reaction from a message
- `discord_delete_message`: Delete a specific message from a channel

### Webhook Management

- `discord_create_webhook`: Creates a new webhook for a Discord channel
- `discord_send_webhook_message`: Sends a message to a Discord channel using a webhook
- `discord_edit_webhook`: Edits an existing webhook for a Discord channel
- `discord_delete_webhook`: Deletes an existing webhook for a Discord channel

## Streaming Features Explained

### Time Range Filtering

All streaming tools support time-range filtering via ISO 8601 date strings:

```javascript
// Fetch messages from a specific time range
{
  afterDate: "2024-01-01T00:00:00Z",   // Start date (inclusive)
  beforeDate: "2024-12-31T23:59:59Z"   // End date (inclusive)
}

// Fetch messages from last X days (omit both dates to use default 10 days)
{
  afterDate: "2024-01-15T00:00:00Z"   // Last 10+ days
}

// Fetch ALL messages (no time limit - use with caution!)
{
  afterDate: "2015-01-01T00:00:00Z"   // Discord's founding year
}
```

### Stream Event Types

Streaming tools return different event types to provide real-time feedback:

1. **`progress`** - Periodic progress updates during fetching
2. **`batch`** - Contains message data (up to 100 messages per batch)
3. **`threads_found`** - (Forums only) Total number of threads discovered
4. **`thread_progress`** - (Forums only) Current thread being processed
5. **`rate_limited`** - Discord rate limit hit, includes retry wait time
6. **`complete`** - All data fetched successfully
7. **`partial_complete`** - Partial data returned (e.g., due to rate limits or errors)

### Rate Limit Handling

When Discord rate limits are hit:
- The tool returns a `rate_limited` event with wait time
- Already-fetched data is returned as `partial_complete`
- You can retry the request after the wait period

### Performance Tips

1. **Use specific date ranges** - Narrow time ranges = faster responses
2. **Process channels sequentially** - Use `discord_read_multiple_channels` instead of parallel requests
3. **Monitor rate limits** - Discord has per-channel and global rate limits
4. **Archive during off-peak hours** - Large archives work best when server activity is low

## Development

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Run built version
npm start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

This project is a fork of [barryyip0625/mcp-discord](https://github.com/barryyip0625/mcp-discord) with significant enhancements for unlimited message streaming and archiving capabilities.

Special thanks to:
- Barry Yip (@barryyip0625) for the original MCP-Discord implementation
- The Anthropic team for the Model Context Protocol
- Discord.js community for the excellent Discord API library
