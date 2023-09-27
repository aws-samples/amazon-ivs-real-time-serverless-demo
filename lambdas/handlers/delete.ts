import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { DeleteEventBody, RealTimeRecord } from '../types';
import { USER_NOT_FOUND_EXCEPTION } from '../constants';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}' } = event;
  const { hostId }: DeleteEventBody = JSON.parse(body);

  console.info('EVENT', JSON.stringify(event));

  try {
    const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(hostId);

    if (!RealTimeRecordItem) {
      return createErrorResponse({
        code: 404,
        name: USER_NOT_FOUND_EXCEPTION,
        message: `No host exists with the ID ${hostId}`
      });
    }

    const realTimeRecord = unmarshall(RealTimeRecordItem) as RealTimeRecord;
    const { chatRoomArn, stageArn } = realTimeRecord;

    console.info('Deleting record', JSON.stringify(realTimeRecord));

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
