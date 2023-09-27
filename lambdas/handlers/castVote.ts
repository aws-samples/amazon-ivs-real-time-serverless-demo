import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  ConditionalCheckFailedException,
  ReturnValue,
  UpdateItemCommand
} from '@aws-sdk/client-dynamodb';
import { convertToAttr, unmarshall } from '@aws-sdk/util-dynamodb';

import { CastVoteBody } from '../types';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { ddbDocClient } from '../clients';
import { ddbSdk } from '../sdk';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body = '{}' } = event;
  const { hostId, vote }: CastVoteBody = JSON.parse(body);

  console.info('EVENT', JSON.stringify(event));

  try {
    const { Attributes = {} } = await ddbDocClient.send(
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
        ReturnValues: ReturnValue.UPDATED_NEW,
        ExpressionAttributeValues: { ':count': convertToAttr(1) }
      })
    );

    console.info('Updated vote tally', unmarshall(Attributes));
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
