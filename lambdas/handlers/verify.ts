import { APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { createSuccessResponse } from '../utils';

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return createSuccessResponse({ body: 'OK' });
};
