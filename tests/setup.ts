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
