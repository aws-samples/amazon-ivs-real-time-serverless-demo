import { APIGatewayProxyResultV2 } from 'aws-lambda';

const DEFAULT_RESPONSE_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

class ResponseError extends Error {
  public readonly code;

  constructor(
    code: number = 500,
    name: string = 'UnexpectedError',
    message: string = 'Unexpected error occurred'
  ) {
    super(message);
    this.code = code;
    this.name = name;
  }
}

export const createSuccessResponse = ({
  body = {},
  code = 200
}: {
  body?: object | string;
  code?: number;
} = {}): APIGatewayProxyResultV2 => ({
  statusCode: code,
  headers: DEFAULT_RESPONSE_HEADERS,
  body: typeof body === 'string' ? body : JSON.stringify(body)
});

export const createErrorResponse = ({
  code = 500,
  name,
  message,
  error
}: {
  code?: number;
  name?: string;
  message?: string;
  error?: unknown;
} = {}): APIGatewayProxyResultV2 => {
  const responseError = error || new ResponseError(code, name, message);
  console.error(responseError); // log the response error and data to CloudWatch

  return {
    statusCode: code,
    headers: DEFAULT_RESPONSE_HEADERS,
    body: JSON.stringify(
      responseError,
      Object.getOwnPropertyNames(responseError).filter((key) => key !== 'stack')
    )
  };
};

export const getElapsedTimeInSeconds = (fromDate: string) => {
  if (!fromDate) return 0;

  const elapsedTimeMs = Date.now() - new Date(fromDate).getTime();
  const elapsedTimeSeconds = elapsedTimeMs / 1000;

  return elapsedTimeSeconds;
};

export const exhaustiveSwitchGuard = (value: never): never => {
  throw new Error(
    `ERROR! Reached forbidden guard function with unexpected value: ${JSON.stringify(
      value
    )}`
  );
};
