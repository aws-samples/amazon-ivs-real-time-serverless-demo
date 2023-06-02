import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION, USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { DisconnectEventBody } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { hostId, userId, participantId }: DisconnectEventBody = JSON.parse(
    event.body || '{}'
  );

  // Check required input
  if (!hostId || !userId || !participantId) {
    const missingInputs = [];
    if (!hostId) missingInputs.push('hostId');
    if (!userId) missingInputs.push('userId');
    if (!participantId) missingInputs.push('participantId');

    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Missing required input data: ${missingInputs.join(', ')}`
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

    const { chatRoomArn, stageArn } = unmarshall(RealTimeRecordItem);

    await Promise.all([
      chatSdk.disconnectChatUser(chatRoomArn, userId),
      realTimeSdk.disconnectParticipant(stageArn, participantId)
    ]);
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse();
};
