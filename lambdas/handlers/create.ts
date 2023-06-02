import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ParticipantToken, Stage } from '@aws-sdk/client-ivs-realtime';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION, CREATE_RESOURCE_EXCEPTION } from '../constants';
import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import {
  createErrorResponse,
  createSuccessResponse,
  isFulfilled
} from '../utils';
import {
  CreateEventBody,
  CreateResponse,
  RealTimeRecord,
  Room
} from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { cid, hostId, hostAttributes, type }: CreateEventBody = JSON.parse(
    event.body || '{}'
  );
  const response: CreateResponse = { region: process.env.AWS_REGION! };

  // Check required input
  if (!cid || !hostId || !type) {
    const missingInputs = [];
    if (!cid) missingInputs.push('cid');
    if (!hostId) missingInputs.push('hostId');
    if (!type) missingInputs.push('type');

    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Missing required input data: ${missingInputs.join(', ')}`
    });
  }

  try {
    let room: Room | undefined;
    let stage: Stage | undefined;
    let hostParticipantToken: ParticipantToken | undefined;

    const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(hostId);

    // Return a host participant token if a RealTime record already exists for this hostId
    if (RealTimeRecordItem) {
      const { stageArn } = unmarshall(RealTimeRecordItem) as RealTimeRecord;
      response.hostParticipantToken = await realTimeSdk.createParticipantToken({
        stageArn,
        userId: hostId,
        attributes: hostAttributes
      });

      return createSuccessResponse({ body: response });
    }

    // Create the Stage and Room resources
    const [createStageResult, createRoomResult] = await Promise.allSettled([
      realTimeSdk.createStage({ cid, hostId, hostAttributes }),
      chatSdk.createRoom({ cid, hostId })
    ]);

    const failedResources: { [key: string]: any } = {};

    // Handle Stage creation result
    if (isFulfilled(createStageResult)) {
      ({ stage, hostParticipantToken } = createStageResult.value);
    } else failedResources.stage = createStageResult.reason;

    // Handle Room creation result
    if (isFulfilled(createRoomResult)) {
      room = createRoomResult.value;
    } else failedResources.room = createRoomResult.reason;

    // Return an error if any of the resources failed to create
    if (!stage || !room) {
      return createErrorResponse({
        name: CREATE_RESOURCE_EXCEPTION,
        message: `Failed to create resources: ${JSON.stringify(
          failedResources
        )}`
      });
    }

    // Add a record to the RealTime DDB Table
    await ddbSdk.createRealTimeRecord({
      hostId,
      hostAttributes,
      hostParticipantId: hostParticipantToken?.participantId,
      roomArn: room.arn!,
      stageArn: stage.arn!,
      type
    });

    response.hostParticipantToken = hostParticipantToken;
  } catch (error) {
    return createErrorResponse({ error });
  }

  return createSuccessResponse({ code: 201, body: response });
};
