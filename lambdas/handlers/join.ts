import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION, USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import {
  JoinEventBody,
  JoinResponse,
  RealTimeRecord,
  StageMode,
  StageType
} from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { hostId, userId, attributes }: JoinEventBody = JSON.parse(
    event.body || '{}'
  );
  let response: JoinResponse = {
    region: process.env.AWS_REGION!,
    metadata: {}
  };

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

    const { stageArn, chatRoomArn, hostAttributes, type, mode } = unmarshall(
      RealTimeRecordItem
    ) as RealTimeRecord;

    if (type === StageType.VIDEO && mode === StageMode.PK) {
      const { Item: VotesItem } = await ddbSdk.getVotesRecord(hostId, [
        'tally',
        'startedAt'
      ]);

      if (VotesItem) {
        response.metadata.activeVotingSession = unmarshall(VotesItem);
      }
    }

    const participantToken = await realTimeSdk.createParticipantToken({
      userId,
      stageArn,
      attributes
    });

    await chatSdk.sendEvent({
      chatRoomArn,
      eventName: 'stage:JOIN',
      attributes: {
        userId,
        userAttributes: JSON.stringify(attributes || {}),
        message: `${userId} joined`
      }
    });

    response = { ...response, ...participantToken, hostAttributes };
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse({ body: response });
};
