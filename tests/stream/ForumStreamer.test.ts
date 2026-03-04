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
