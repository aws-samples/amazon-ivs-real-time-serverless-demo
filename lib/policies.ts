import { aws_iam as iam } from 'aws-cdk-lib';

export const tagResourcesPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:TagResource', 'ivschat:TagResource'],
  resources: ['*']
});

export const createResourcesPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:CreateStage', 'ivschat:CreateRoom'],
  resources: ['*']
});

export const createTokensPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:CreateParticipantToken', 'ivschat:CreateChatToken'],
  resources: ['*']
});

export const getResourcesPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:ListStages', 'ivschat:ListRooms'],
  resources: ['*']
});

export const sendEventPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivschat:SendEvent'],
  resources: ['*']
});

export const disconnectUsersPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:DisconnectParticipant', 'ivschat:DisconnectUser'],
  resources: ['*']
});

export const deleteResourcesPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ivs:DeleteStage', 'ivschat:DeleteRoom'],
  resources: ['*']
});
