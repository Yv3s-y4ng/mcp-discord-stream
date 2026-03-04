// Test utilities and mocks setup
import type { Client, Message } from 'discord.js';
import { Collection } from 'discord.js';

export const mockChannel = {
  id: 'test-channel-123',
  messages: {
    fetch: jest.fn(),
  },
  isTextBased: () => true,
};

export const mockClient: Partial<Client> = {
  isReady: (() => true) as any,
  guilds: {
    fetch: jest.fn().mockResolvedValue(new Map()),
  } as any,
  channels: {
    fetch: jest.fn().mockResolvedValue(mockChannel),
  } as any,
};

export const mockMessage = (id: string, content: string, createdAt: Date): Partial<Message> => {
  return {
    id,
    content,
    author: {
      id: 'user-123',
      username: 'testuser',
      bot: false,
    } as any,
    createdAt,
    attachments: new Collection(),
    embeds: [],
    reference: null,
  } as unknown as Partial<Message>;
};
