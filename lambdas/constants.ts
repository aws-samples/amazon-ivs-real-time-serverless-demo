import { StageMode } from './types';

/**
 * Configurations
 */
export const AUDIO_ROOM_SIZE = 12; // participants

export const PARTICIPANT_TOKEN_DURATION_IN_MINUTES = 20160; // 14 days (max)
export const CHAT_TOKEN_SESSION_DURATION_IN_MINUTES = 180; // 3 hours (max)
export const IDLE_TIME_UNTIL_STALE_IN_SECONDS = 3600; // 1 hour
export const UPDATE_STATUS_INTERVAL_IN_SECONDS = 3; // Constraint: 1-59

export const ALLOWED_FILTER_ATTRIBUTES = ['mode', 'status', 'type'];

export const SUMMARY_ATTRIBUTES = [
  'createdAt',
  'hostAttributes',
  'hostId',
  'mode',
  'seats',
  'stageArn',
  'status',
  'type'
];

export const SIMPLE_MODE_NAMES = {
  [StageMode.NONE]: '',
  [StageMode.PK]: 'PK',
  [StageMode.GUEST_SPOT]: 'Guest Spot'
};

/**
 * Exceptions
 */
export const BAD_INPUT_EXCEPTION = 'BadInputException';
export const BAD_PARAMS_EXCEPTION = 'BadParamsException';
export const CREATE_RESOURCE_EXCEPTION = 'CreateResourceException';
export const CREATE_TOKEN_EXCEPTION = 'CreateTokenException';
export const INVALID_STAGE_UPDATE_EXCEPTION = 'InvalidStageUpdateException';
export const RESTRICTED_FILTER_EXCEPTION = 'RestrictedFilterException';
export const USER_NOT_FOUND_EXCEPTION = 'UserNotFoundException';
