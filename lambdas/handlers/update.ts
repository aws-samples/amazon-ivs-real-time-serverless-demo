import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import {
  BAD_INPUT_EXCEPTION,
  BAD_PARAMS_EXCEPTION,
  INVALID_STAGE_UPDATE_EXCEPTION,
  USER_NOT_FOUND_EXCEPTION
} from '../constants';
import { ddbSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import {
  RealTimeRecord,
  StageMode,
  StageType,
  UpdateEventBody,
  UpdateType
} from '../types';
import { updateMode, updateSeats } from '../helpers';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}', pathParameters } = event;
  const { hostId, userId, ...data }: UpdateEventBody = JSON.parse(body);
  const [updateType] = pathParameters?.proxy?.split('/') as string[]; // mode OR seats
  const isModeUpdate = !!(updateType?.toUpperCase() === UpdateType.MODE);
  const isSeatsUpdate = !!(updateType?.toUpperCase() === UpdateType.SEATS);
  const stageModes = Object.values(StageMode);

  // Check that hostId was provided
  if (!hostId) {
    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: 'Missing host ID'
    });
  }

  // Check that a recognized update type was passed into the {proxy+} path (i.e. "mode" or "seats")
  if (!isModeUpdate && !isSeatsUpdate) {
    return createErrorResponse({
      code: 400,
      name: BAD_PARAMS_EXCEPTION,
      message:
        'Missing or incorrect update type parameter. Endpoint should follow the format: update/{mode|seats}'
    });
  }

  // Check that the supporting data payload was passed into the update request
  if (!data[updateType]) {
    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Missing data to update - input should contain a(n) "${updateType}" data property`
    });
  }

  // If this is a mode update, check that a recognized mode was passed into the update request
  if (isModeUpdate && !stageModes.includes(data.mode.toUpperCase())) {
    const mode = data[updateType];
    const modesStr = stageModes.join(', ');

    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Unknown stage mode provided: ${mode}. Stage mode must be one of: ${modesStr}`
    });
  }

  try {
    const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(hostId);

    // Check that a host exists with the given hostId
    if (!RealTimeRecordItem) {
      return createErrorResponse({
        code: 404,
        name: USER_NOT_FOUND_EXCEPTION,
        message: `No host exists with the ID ${hostId}`
      });
    }

    const record = unmarshall(RealTimeRecordItem) as RealTimeRecord;

    if (
      (isModeUpdate && record.type === StageType.AUDIO) ||
      (isSeatsUpdate && record.type === StageType.VIDEO)
    ) {
      return createErrorResponse({
        code: 400,
        name: INVALID_STAGE_UPDATE_EXCEPTION,
        message: `Cannot update the ${updateType} for a(n) ${record.type} stage type`
      });
    }

    if (isModeUpdate) {
      await updateMode({ mode: data.mode, record, userId });
    }

    if (isSeatsUpdate) {
      await updateSeats({ seats: data.seats, record, userId });
    }
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse();
};
