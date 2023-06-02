import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { IvschatClient } from '@aws-sdk/client-ivschat';
import { IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';

export const ivsRealTimeClient = new IVSRealTimeClient({});
export const ivsChatClient = new IvschatClient({});
export const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
  {
    marshallOptions: {
      convertClassInstanceToMap: false, // Whether to convert typeof object to map attribute
      convertEmptyValues: false, // Whether to automatically convert empty strings, blobs, and sets to `null`
      removeUndefinedValues: true // Whether to remove undefined values while marshalling
    },
    unmarshallOptions: {
      wrapNumbers: false // Whether to return numbers as a string instead of converting them to native JavaScript numbers
    }
  }
);
