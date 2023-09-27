import { convertToAttr, unmarshall } from '@aws-sdk/util-dynamodb';
import { ScheduledHandler } from 'aws-lambda';
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { chatSdk, ddbSdk, realTimeSdk } from '../sdk';
import { ddbDocClient } from '../clients';
import { getElapsedTimeInSeconds } from '../utils';
import { IDLE_TIME_UNTIL_STALE_IN_SECONDS } from '../constants';
import { RealTimeRecord, StageStatus } from '../types';

const { DISTRIBUTION_DOMAIN_NAME: distributionDomainName } =
  process.env as Record<string, string>;
const [cid] = distributionDomainName.split('.');

export const handler: ScheduledHandler = async () => {
  try {
    // Get all item records and stage summaries for this customer
    const [{ Items }, stageSummaries, roomSummaries] = await Promise.all([
      ddbSdk.getRealTimeRecords({
        attributesToGet: [
          'hostId',
          'status',
          'stageArn',
          'chatRoomArn',
          'createdAt',
          'lastStatusUpdatedAt'
        ]
      }),
      realTimeSdk.getStageSummaries(cid),
      chatSdk.getRoomSummaries(cid)
    ]);

    if (!Items) return;

    const stageSummaryMap = new Map(
      stageSummaries.map(({ arn, ...restData }) => [arn, restData])
    );

    const stageArnsSet = new Set();
    const chatRoomArnsSet = new Set();
    const unmarshalledItems = Items.map<Partial<RealTimeRecord>>((item) => {
      const unmarshalledItem = unmarshall(item);
      const { stageArn, chatRoomArn } = unmarshalledItem;
      stageArn && stageArnsSet.add(stageArn);
      chatRoomArn && chatRoomArnsSet.add(chatRoomArn);

      return unmarshalledItem;
    });

    // Delete any Stages that are not associated with an item to prevent hitting Stage limits
    for (let { arn, tags } of stageSummaries) {
      try {
        const { createdAt } = tags || {};

        if (
          !stageArnsSet.has(arn) &&
          createdAt &&
          getElapsedTimeInSeconds(createdAt) > 60 // created more than 1 min ago
        ) {
          await realTimeSdk.deleteStage(arn as string);
        }
      } catch (error) {
        // swallow the error to continue processing items
        console.error(error);
      }
    }

    // Delete any Rooms that are not associated with an item to prevent hitting Room limits
    for (let { arn, tags } of roomSummaries) {
      try {
        const { createdAt } = tags || {};
        if (
          !chatRoomArnsSet.has(arn) &&
          createdAt &&
          getElapsedTimeInSeconds(createdAt) > 60 // created more than 1 min ago
        ) {
          await chatSdk.deleteRoom(arn as string);
        }
      } catch (error) {
        // swallow the error to continue processing items
        console.error(error);
      }
    }

    for (let item of unmarshalledItems) {
      const { hostId, status, stageArn, chatRoomArn, lastStatusUpdatedAt } =
        item;
      const summary = stageSummaryMap.get(stageArn);
      const isActive = !!summary?.activeSessionId;
      const currentStatus = isActive ? StageStatus.ACTIVE : StageStatus.IDLE;

      // Update the Stage status if it has changed
      if (status !== currentStatus) {
        try {
          await ddbDocClient.send(
            new UpdateItemCommand({
              TableName: ddbSdk.realTimeTableName,
              Key: { hostId: convertToAttr(hostId) },
              UpdateExpression:
                'SET #status = :status, #lastStatusUpdatedAt = :lastStatusUpdatedAt',
              ConditionExpression: 'attribute_exists(#hostId)',
              ExpressionAttributeNames: {
                '#hostId': 'hostId',
                '#status': 'status',
                '#lastStatusUpdatedAt': 'lastStatusUpdatedAt'
              },
              ExpressionAttributeValues: {
                ':status': convertToAttr(currentStatus),
                ':lastStatusUpdatedAt': convertToAttr(new Date().toISOString())
              }
            })
          );
        } catch (error) {
          // swallow the error to continue processing remaining items
          console.error(error);
        }

        continue;
      }

      // Delete item resources if the stage has remained IDLE for longer than IDLE_TIME_UNTIL_STALE_IN_MINUTES
      if (
        !isActive &&
        getElapsedTimeInSeconds(lastStatusUpdatedAt as string) >
          IDLE_TIME_UNTIL_STALE_IN_SECONDS
      ) {
        console.info('Deleting IDLE item', JSON.stringify(item));

        try {
          // Delete the record references to the stage/room resources first
          await ddbSdk.deleteRealTimeRecord(hostId as string);
          await ddbSdk.deleteVotesRecord(hostId as string);
          await Promise.all([
            chatSdk.deleteRoom(chatRoomArn as string),
            realTimeSdk.deleteStage(stageArn as string)
          ]);
        } catch (error) {
          console.error(error);
          // swallow the error to continue processing remaining items
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};
