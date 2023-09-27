import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import {
  ALLOWED_FILTER_ATTRIBUTES,
  RESTRICTED_FILTER_EXCEPTION,
  SUMMARY_ATTRIBUTES
} from '../constants';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { ddbSdk } from '../sdk';
import { ListResponse, RealTimeRecord } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { queryStringParameters } = event;
  const filters = queryStringParameters || {};
  const response: ListResponse = { stages: [] };

  console.info('EVENT', JSON.stringify(event));

  const filterKeys = Object.keys(filters);
  const restrictedFilterKey = filterKeys.find(
    (filterKey) => !ALLOWED_FILTER_ATTRIBUTES.includes(filterKey)
  );
  if (restrictedFilterKey) {
    return createErrorResponse({
      code: 400,
      name: RESTRICTED_FILTER_EXCEPTION,
      message: `Restricted filter key provided: ${restrictedFilterKey}`
    });
  }

  try {
    const { Items: RealTimeRecordItems = [] } = await ddbSdk.getRealTimeRecords(
      { attributesToGet: SUMMARY_ATTRIBUTES, filters }
    );

    if (RealTimeRecordItems.length) {
      const unmarshalledItems = RealTimeRecordItems.map(
        (item) => unmarshall(item) as RealTimeRecord
      );
      response.stages = unmarshalledItems.sort((item1, item2) => {
        if (item1.createdAt > item2.createdAt) return 1;
        if (item1.createdAt < item2.createdAt) return -1;
        return 0;
      });
    }
  } catch (error) {
    return createErrorResponse({ error });
  }

  console.info('RESPONSE', JSON.stringify(response));

  return createSuccessResponse({ body: response });
};
