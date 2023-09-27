import {
  AttributeValue,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  ScanCommand
} from '@aws-sdk/client-dynamodb';
import { convertToAttr, marshall } from '@aws-sdk/util-dynamodb';

import { AUDIO_ROOM_SIZE } from '../constants';
import { ddbDocClient } from '../clients';
import {
  RealTimeRecord,
  StageConfig,
  StageMode,
  StageStatus,
  StageType,
  VotesRecord
} from '../types';

export const {
  REAL_TIME_TABLE_NAME: realTimeTableName,
  VOTES_TABLE_NAME: votesTableName,
  CREATED_FOR_REALTIME_INDEX_NAME: createdForRealTimeIndexName
} = process.env as Record<string, string>;

export const createRealTimeRecord = ({
  hostId,
  stageArn,
  roomArn,
  type,
  createdFor,
  hostParticipantId,
  hostAttributes = {}
}: {
  hostId: string;
  stageArn: string;
  roomArn: string;
  type: StageType;
  createdFor?: string;
  hostParticipantId?: string;
  hostAttributes?: Record<string, string>;
}) => {
  const now = new Date().toISOString();

  let seats: string[] | undefined;
  if (type.toUpperCase() === StageType.AUDIO) {
    seats = Array(AUDIO_ROOM_SIZE).fill('');
    seats[0] = hostParticipantId || ''; // Pre-assign the host to seat index 0
  }

  const record: RealTimeRecord = {
    hostId,
    hostAttributes,
    stageArn: stageArn,
    chatRoomArn: roomArn,
    createdFor,
    createdAt: now,
    lastStatusUpdatedAt: now,
    seats,
    mode: StageMode.NONE,
    type: type.toUpperCase() as StageType,
    status: StageStatus.IDLE
  };

  return ddbDocClient.send(
    new PutItemCommand({
      TableName: realTimeTableName,
      Item: marshall(record, { removeUndefinedValues: true })
    })
  );
};

export const getRealTimeRecord = (hostId: string) =>
  ddbDocClient.send(
    new GetItemCommand({
      TableName: realTimeTableName,
      Key: { hostId: convertToAttr(hostId) }
    })
  );

export const getRealTimeRecords = ({
  attributesToGet = [],
  filters = {}
}: {
  attributesToGet?: string[];
  filters?: { [key: string]: string | undefined };
} = {}) => {
  let expressionAttributeNames: Record<string, string> = {};
  let expressionAttributeValues: Record<string, AttributeValue> = {};

  // Filters
  const filterExpressions: string[] = [];
  for (let filterKey in filters) {
    // StageConfig filter values must be transformed into the stored format (i.e. uppercase)
    const stageConfigFilterRegex = new RegExp(filterKey, 'i');
    const isStageConfigFilterValue = !!Object.values(StageConfig).find(
      (value) => value.match(stageConfigFilterRegex)
    );
    const filterValue = isStageConfigFilterValue
      ? filters[filterKey]?.toUpperCase()
      : filters[filterKey];

    if (filterValue) {
      filterExpressions.push(`#${filterKey} = :${filterValue}`);
      expressionAttributeNames[`#${filterKey}`] = filterKey;
      expressionAttributeValues[`:${filterValue}`] = convertToAttr(filterValue);
    }
  }
  let filterExpression = filterExpressions.join(' AND ');

  // Projections
  const projectionExpression = attributesToGet
    .map((attr) => `#${attr}`)
    .join(',');
  attributesToGet.forEach(
    (attr) => (expressionAttributeNames[`#${attr}`] = attr)
  );

  return ddbDocClient.send(
    new ScanCommand({
      TableName: realTimeTableName,
      IndexName:
        'createdFor' in filters ? createdForRealTimeIndexName : undefined,
      FilterExpression: filterExpression.length ? filterExpression : undefined,
      ProjectionExpression: projectionExpression.length
        ? projectionExpression
        : undefined,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length
        ? expressionAttributeNames
        : undefined,
      ExpressionAttributeValues: Object.keys(expressionAttributeValues).length
        ? expressionAttributeValues
        : undefined
    })
  );
};

export const deleteRealTimeRecord = (hostId: string) =>
  ddbDocClient.send(
    new DeleteItemCommand({
      TableName: realTimeTableName,
      Key: { hostId: convertToAttr(hostId) }
    })
  );

export const createVotesRecord = ({
  hostId,
  candidateIds,
  chatRoomArn
}: {
  hostId: string;
  candidateIds: string[];
  chatRoomArn: string;
}) => {
  const startingTally = candidateIds.reduce<Record<string, number>>(
    (tally, candidateId) => ({ ...tally, [candidateId]: 0 }),
    {}
  );

  const record: VotesRecord = {
    hostId,
    startedAt: new Date().toISOString(),
    chatRoomArn,
    tally: startingTally
  };

  return ddbDocClient.send(
    new PutItemCommand({
      TableName: votesTableName,
      Item: marshall(record)
    })
  );
};

export const getVotesRecord = (hostId: string, attributesToGet?: string[]) =>
  ddbDocClient.send(
    new GetItemCommand({
      TableName: votesTableName,
      Key: { hostId: convertToAttr(hostId) },
      ProjectionExpression: attributesToGet?.join(',')
    })
  );

export const deleteVotesRecord = (hostId: string) =>
  ddbDocClient.send(
    new DeleteItemCommand({
      TableName: votesTableName,
      Key: { hostId: convertToAttr(hostId) }
    })
  );
