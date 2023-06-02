import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { DynamoDBStreamHandler, StreamRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { exhaustiveSwitchGuard } from '../utils';
import { sendVoteEvent } from '../helpers';
import { VotesRecord } from '../types';
import { ddbSdk } from '../sdk';

export const handler: DynamoDBStreamHandler = async (event) => {
  const { eventName, dynamodb } = event.Records[event.Records.length - 1];
  const { NewImage, OldImage } = dynamodb as StreamRecord;

  const newImage =
    NewImage && unmarshall(NewImage as Record<string, AttributeValue>);

  const oldImage =
    OldImage && unmarshall(OldImage as Record<string, AttributeValue>);

  switch (eventName) {
    case 'INSERT': {
      await sendVoteEvent(newImage as VotesRecord, 'stage:VOTE_START');
      break;
    }
    case 'MODIFY': {
      await sendVoteEvent(newImage as VotesRecord, 'stage:VOTE');
      break;
    }
    case 'REMOVE': {
      try {
        const { Item: RealTimeRecordItem } = await ddbSdk.getRealTimeRecord(
          (oldImage as VotesRecord).hostId
        );

        if (RealTimeRecordItem) {
          await sendVoteEvent(oldImage as VotesRecord, 'stage:VOTE_END');
        }
      } catch (error) {
        console.error(error);
        /**
         * If an error occurred while fetching the RealTimeRecord, we will still
         * try to send the VOTE_END event but there is no guarantee that it will
         * be delivered if the chat room is queued for deletion.
         */
        await sendVoteEvent(oldImage as VotesRecord, 'stage:VOTE_END');
      }

      break;
    }
    default: {
      if (eventName) {
        exhaustiveSwitchGuard(eventName);
      }
    }
  }
};
