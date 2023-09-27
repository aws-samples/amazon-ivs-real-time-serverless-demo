import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { USER_NOT_FOUND_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import {
  JoinEventBody,
  JoinResponse,
  RealTimeRecord,
  StageMode,
  StageType
} from '../types';

const region = process.env.AWS_REGION as string;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}' } = event;
  const { hostId, userId, attributes }: JoinEventBody = JSON.parse(body);
  let response: JoinResponse = { region, metadata: {} };

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
    const { stageArn, chatRoomArn, hostAttributes, type, mode } =
      realTimeRecord;

    console.info(`Joining as "${userId}"`, JSON.stringify(realTimeRecord));

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

  console.info('RESPONSE', JSON.stringify(response));

  return createSuccessResponse({ body: response });
};
