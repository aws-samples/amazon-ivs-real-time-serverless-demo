import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { CreateEventBody, CreateResponse, RealTimeRecord } from '../types';

const region = process.env.AWS_REGION as string;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}', pathParameters } = event;
  const { cid, hostId, hostAttributes, type }: CreateEventBody =
    JSON.parse(body);
  let response: CreateResponse;

  console.info('EVENT', JSON.stringify(event));

  try {
    const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(hostId);

    if (RealTimeRecordItem) {
      // Return a host participant token if a RealTime record already exists for this hostId
      const realTimeRecord = unmarshall(RealTimeRecordItem) as RealTimeRecord;
      const { stageArn, createdFor } = realTimeRecord;

      console.info(
        `Record EXISTS for host "${hostId}" - creating host participant token`,
        JSON.stringify(realTimeRecord)
      );

      const hostParticipantToken = await realTimeSdk.createParticipantToken({
        stageArn,
        userId: hostId,
        attributes: hostAttributes
      });

      response = { region, createdFor, hostParticipantToken };
    } else {
      console.info(
        `Record DOES NOT EXIST for host "${hostId}" - creating new resources`
      );

      // Create new Stage and Room resources
      const createdFor = pathParameters?.proxy?.split('/')[0];
      const tags = createdFor ? { createdFor } : undefined;
      const [createStageResult, createRoomResult] = await Promise.all([
        realTimeSdk.createStage({ cid, hostId, hostAttributes, tags }),
        chatSdk.createRoom({ cid, hostId, tags })
      ]);

      // Add a new record to the RealTime DDB Table
      await ddbSdk.createRealTimeRecord({
        type,
        hostId,
        createdFor,
        hostAttributes,
        roomArn: createRoomResult.arn as string,
        stageArn: createStageResult.stage.arn as string,
        hostParticipantId: createStageResult.hostParticipantToken.participantId
      });

      response = {
        region,
        createdFor,
        hostParticipantToken: createStageResult.hostParticipantToken
      };
    }
  } catch (error) {
    return createErrorResponse({ error });
  }

  console.info('RESPONSE', JSON.stringify(response));

  return createSuccessResponse({ code: 201, body: response });
};
