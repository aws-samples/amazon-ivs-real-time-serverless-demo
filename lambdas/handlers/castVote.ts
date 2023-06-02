import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  ConditionalCheckFailedException,
  UpdateItemCommand
} from '@aws-sdk/client-dynamodb';
import { convertToAttr } from '@aws-sdk/util-dynamodb';

import { BAD_INPUT_EXCEPTION } from '../constants';
import { CastVoteBody } from '../types';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { ddbDocClient } from '../clients';
import { ddbSdk } from '../sdk';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { hostId, vote }: CastVoteBody = JSON.parse(event.body || '{}');

  // Check required input
  if (!hostId || !vote) {
    const missingInputs = [];
    if (!hostId) missingInputs.push('hostId');
    if (!vote) missingInputs.push('vote');

    return createErrorResponse({
      code: 400,
      name: BAD_INPUT_EXCEPTION,
      message: `Missing required input data: ${missingInputs.join(', ')}`
    });
  }

  try {
    await ddbDocClient.send(
      new UpdateItemCommand({
        TableName: ddbSdk.votesTableName,
        Key: { hostId: convertToAttr(hostId) },
        UpdateExpression: `ADD #tally.#${vote} :count`,
        ConditionExpression: `attribute_exists(#hostId) and attribute_exists(#tally.#${vote})`,
        ExpressionAttributeNames: {
          '#hostId': 'hostId',
          '#tally': 'tally',
          [`#${vote}`]: vote
        },
        ExpressionAttributeValues: { ':count': convertToAttr(1) }
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return createErrorResponse({
        code: 400,
        name: error.name,
        message: `The provided hostId (${hostId}) and/or vote (${vote}) is not associated with an active voting session`
      });
    }

    return createErrorResponse({ error });
  }

  return createSuccessResponse({ code: 204 });
};
