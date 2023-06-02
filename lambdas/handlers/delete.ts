import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION, USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { DeleteEventBody, RealTimeRecord } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { hostId }: DeleteEventBody = JSON.parse(event.body || '{}');

  // Check required input
  if (!hostId) {
    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Missing host ID`
    });
  }

  try {
    const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(hostId);

    if (!RealTimeRecordItem) {
      return createErrorResponse({
        code: 404,
        name: USER_NOT_FOUND_EXCEPTION,
        message: `No host exists with the ID ${hostId}`
      });
    }

    const { chatRoomArn, stageArn } = unmarshall(
      RealTimeRecordItem
    ) as RealTimeRecord;

    // Delete the record references to the stage/room resources first
    await ddbSdk.deleteRealTimeRecord(hostId);
    await ddbSdk.deleteVotesRecord(hostId);

    await Promise.all([
      realTimeSdk.deleteStage(stageArn),
      chatSdk.deleteRoom(chatRoomArn)
    ]);
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse({ code: 204 });
};
