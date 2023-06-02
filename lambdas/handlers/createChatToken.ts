import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  ChatTokenCapability,
  CreateChatTokenResponse
} from '@aws-sdk/client-ivschat';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION, USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk } from '../sdk';
import { CreateChatTokenBody } from '../types';
import { createErrorResponse, createSuccessResponse } from '../utils';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { hostId, userId, attributes }: CreateChatTokenBody = JSON.parse(
    event.body || '{}'
  );
  let response: CreateChatTokenResponse;

  // Check required input
  if (!hostId || !userId) {
    const missingInputs = [];
    if (!hostId) missingInputs.push('hostId');
    if (!userId) missingInputs.push('userId');

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

    const { chatRoomArn } = unmarshall(RealTimeRecordItem);
    response = await chatSdk.createChatToken({
      attributes,
      capabilities: [ChatTokenCapability.SEND_MESSAGE],
      chatRoomArn,
      userId
    });
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse({ body: response });
};
