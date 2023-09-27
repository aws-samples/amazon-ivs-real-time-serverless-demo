import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  ChatTokenCapability,
  CreateChatTokenResponse
} from '@aws-sdk/client-ivschat';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk } from '../sdk';
import { CreateChatTokenBody } from '../types';
import { createErrorResponse, createSuccessResponse } from '../utils';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}' } = event;
  const { hostId, userId, attributes }: CreateChatTokenBody = JSON.parse(body);
  let response: CreateChatTokenResponse;

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
    const { chatRoomArn } = realTimeRecord;

    console.info(
      `Creating chat token for user "${userId}"`,
      JSON.stringify(realTimeRecord)
    );

    response = await chatSdk.createChatToken({
      userId,
      attributes,
      chatRoomArn,
      capabilities: [ChatTokenCapability.SEND_MESSAGE]
    });
  } catch (error) {
    return createErrorResponse({ error });
  }

  console.info('RESPONSE', JSON.stringify(response));

  return createSuccessResponse({ body: response });
};
