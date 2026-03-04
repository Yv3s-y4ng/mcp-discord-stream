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
