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

const stageModes = Object.values(StageMode);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}', pathParameters } = event;
  const { hostId, userId, ...data }: UpdateEventBody = JSON.parse(body);
  const updateType = pathParameters?.proxy?.split('/')[0]; // mode OR seats
  const isModeUpdate = !!(updateType?.toUpperCase() === UpdateType.MODE);
  const isSeatsUpdate = !!(updateType?.toUpperCase() === UpdateType.SEATS);

  console.info('EVENT', JSON.stringify(event));

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

    const realTimeRecord = unmarshall(RealTimeRecordItem) as RealTimeRecord;

    if (
      (isModeUpdate && realTimeRecord.type === StageType.AUDIO) ||
      (isSeatsUpdate && realTimeRecord.type === StageType.VIDEO)
    ) {
      return createErrorResponse({
        code: 400,
        name: INVALID_STAGE_UPDATE_EXCEPTION,
        message: `Cannot update the ${updateType} for a(n) ${realTimeRecord.type} stage type`
      });
    }

    console.info(`Updating ${updateType}`, JSON.stringify(realTimeRecord));

    if (isModeUpdate) {
      await updateMode({ mode: data.mode, record: realTimeRecord, userId });
    }

    if (isSeatsUpdate) {
      await updateSeats({ seats: data.seats, record: realTimeRecord, userId });
    }
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse();
};
