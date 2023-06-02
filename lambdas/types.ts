import {
  CreateChatTokenResponse,
  CreateRoomCommandOutput
} from '@aws-sdk/client-ivschat';
import { ParticipantToken } from '@aws-sdk/client-ivs-realtime';

export enum StageStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE'
}

export enum StageType {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO'
}

export enum StageMode {
  NONE = 'NONE',
  GUEST_SPOT = 'GUEST_SPOT',
  PK = 'PK'
}

export enum StageConfig {
  STATUS = 'STATUS',
  MODE = 'MODE',
  TYPE = 'TYPE'
}

export enum UpdateType {
  MODE = 'MODE',
  SEATS = 'SEATS'
}

export type Room = CreateRoomCommandOutput;

export type ChatToken = CreateChatTokenResponse;

export interface RealTimeRecord {
  hostId: string; // partition key
  hostAttributes: Record<string, string>;
  createdAt: string;
  stageArn: string;
  chatRoomArn: string;
  type: StageType;
  mode: StageMode;
  status: StageStatus;
  lastStatusUpdatedAt: string;
  seats?: string[];
}

export interface VotesRecord {
  hostId: string; // partition key
  tally: Record<string, number>;
  chatRoomArn: string;
  startedAt: string;
}

/**
 * Create Types
 */

export interface CreateEventBody {
  cid: string;
  hostAttributes?: Record<string, string>;
  hostId: string;
  type: StageType;
}

export interface CreateResponse {
  hostParticipantToken?: ParticipantToken;
  region: string;
}

/**
 * Join Types
 */

export interface JoinEventBody {
  hostId: string;
  userId: string;
  attributes?: Record<string, string>;
}

export interface JoinResponse extends ParticipantToken {
  region: string;
  metadata: Record<string, any>;
  hostAttributes?: Record<string, string>;
}

/**
 * List Types
 */

export interface ListResponse {
  stages: Partial<RealTimeRecord>[];
}

/**
 * CreateChatToken Types
 */

export interface CreateChatTokenBody {
  hostId: string;
  userId: string;
  attributes?: Record<string, string>;
}

/**
 * Delete Types
 */

export interface DeleteEventBody {
  hostId: string;
}

/**
 * Disconnect Types
 */

export interface DisconnectEventBody {
  hostId: string;
  userId: string;
  participantId: string;
}

/**
 * Update Types
 */

export interface UpdateEventBody {
  hostId: string;
  userId?: string;
  [key: string]: any;
}

/**
 * CastVote Types
 */

export interface CastVoteBody {
  hostId: string;
  vote: string;
}
