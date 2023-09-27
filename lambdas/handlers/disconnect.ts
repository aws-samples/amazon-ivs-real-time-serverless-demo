import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { DisconnectEventBody } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}' } = event;
  const { hostId, userId, participantId }: DisconnectEventBody =
    JSON.parse(body);

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

    const realTimeRecord = unmarshall(RealTimeRecordItem);
    const { chatRoomArn, stageArn } = realTimeRecord;

    console.info(
      `Disconnecting user "${userId}"`,
      JSON.stringify(realTimeRecord)
    );

    await Promise.all([
      chatSdk.disconnectChatUser(chatRoomArn, userId),
      realTimeSdk.disconnectParticipant(stageArn, participantId)
    ]);
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse();
};
