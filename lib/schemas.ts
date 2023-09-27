import { aws_apigateway as apigw } from 'aws-cdk-lib';

const createRequestSchema: apigw.JsonSchema = {
  title: 'CreateRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    cid: { type: apigw.JsonSchemaType.STRING },
    hostAttributes: { type: apigw.JsonSchemaType.OBJECT },
    hostId: { type: apigw.JsonSchemaType.STRING },
    type: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['cid', 'hostId', 'type']
};

const joinRequestSchema: apigw.JsonSchema = {
  title: 'JoinRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    attributes: { type: apigw.JsonSchemaType.OBJECT },
    hostId: { type: apigw.JsonSchemaType.STRING },
    userId: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['hostId', 'userId']
};

const deleteRequestSchema: apigw.JsonSchema = {
  title: 'DeleteRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    hostId: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['hostId']
};

const disconnectRequestSchema: apigw.JsonSchema = {
  title: 'DisconnectRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    hostId: { type: apigw.JsonSchemaType.STRING },
    participantId: { type: apigw.JsonSchemaType.STRING },
    userId: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['hostId', 'participantId', 'userId']
};

const updateRequestSchema: apigw.JsonSchema = {
  title: 'UpdateRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    hostId: { type: apigw.JsonSchemaType.STRING },
    userId: { type: apigw.JsonSchemaType.STRING },
    mode: { type: apigw.JsonSchemaType.STRING },
    seats: {
      type: apigw.JsonSchemaType.ARRAY,
      items: { type: apigw.JsonSchemaType.STRING }
    }
  },
  required: ['hostId']
};

const createChatTokenRequestSchema: apigw.JsonSchema = {
  title: 'CreateChatTokenRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    attributes: { type: apigw.JsonSchemaType.OBJECT },
    hostId: { type: apigw.JsonSchemaType.STRING },
    userId: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['hostId', 'userId']
};

const castVoteRequestSchema: apigw.JsonSchema = {
  title: 'CastVoteRequest',
  type: apigw.JsonSchemaType.OBJECT,
  properties: {
    hostId: { type: apigw.JsonSchemaType.STRING },
    vote: { type: apigw.JsonSchemaType.STRING }
  },
  required: ['hostId', 'vote']
};

const schemas = {
  castVoteRequestSchema,
  createChatTokenRequestSchema,
  createRequestSchema,
  deleteRequestSchema,
  disconnectRequestSchema,
  joinRequestSchema,
  updateRequestSchema
};

export default schemas;
