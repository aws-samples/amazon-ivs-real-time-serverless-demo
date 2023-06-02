import { convertToAttr } from '@aws-sdk/util-dynamodb';
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { AUDIO_ROOM_SIZE, SIMPLE_MODE_NAMES } from './constants';
import { chatSdk, ddbSdk } from './sdk';
import { ddbDocClient } from './clients';
import { RealTimeRecord, VotesRecord } from './types';
import { StageMode } from './types';

export const updateMode = async ({
  mode,
  record,
  userId
}: {
  mode: string;
  record: RealTimeRecord;
  userId?: string; // userId should be provided if the mode has been changed to PK or GUEST_SPOT
}) => {
  const { hostId, mode: prevMode, chatRoomArn } = record;
  const nextMode = mode.toUpperCase() as StageMode;
  const eventAttributes: Record<string, string> = { mode: nextMode };

  // Return early if the update does not result in a change
  if (nextMode === prevMode) return;

  // Determine the correct message and notice to send via the chat event
  if (nextMode === StageMode.NONE) {
    eventAttributes.notice = `${hostId} stopped ${SIMPLE_MODE_NAMES[prevMode]} mode`;
  } else {
    eventAttributes.notice = `${hostId} started ${SIMPLE_MODE_NAMES[nextMode]} mode`;
    eventAttributes.message = `${userId || 'User'} is on stage`;
  }

  return Promise.all([
    // Send a chat event containing the next mode
    chatSdk.sendEvent({
      chatRoomArn,
      eventName: 'stage:MODE',
      attributes: eventAttributes
    }),
    // Update the RealTime table to reflect the new mode
    ddbDocClient.send(
      new UpdateItemCommand({
        TableName: ddbSdk.realTimeTableName,
        Key: { hostId: convertToAttr(hostId) },
        UpdateExpression: `SET #mode = :nextMode`,
        ExpressionAttributeNames: { '#mode': 'mode' },
        ExpressionAttributeValues: { ':nextMode': convertToAttr(nextMode) }
      })
    ),
    // If PK-mode started, create a Votes record; otherwise, delete any associated Votes record
    nextMode === StageMode.PK && !!userId
      ? ddbSdk.createVotesRecord({
          hostId,
          candidateIds: [hostId, userId],
          chatRoomArn
        })
      : ddbSdk.deleteVotesRecord(hostId)
  ]);
};

export const updateSeats = async ({
  seats,
  record,
  userId
}: {
  seats: string;
  record: RealTimeRecord;
  userId?: string; // userId should be provided if the seats are updated with a NEW user
}) => {
  const { hostId, seats: prevSeats, chatRoomArn } = record;

  const nextSeats = [...seats];
  nextSeats.splice(AUDIO_ROOM_SIZE); // cut the seats down to the max AUDIO_ROOM_SIZE
  nextSeats.push(...Array(AUDIO_ROOM_SIZE - nextSeats.length).fill('')); // fill any remaining seats with empty strings

  // Return early if the update does not result in a change
  if (JSON.stringify(nextSeats) === JSON.stringify(prevSeats)) return;

  const newSeatMember = nextSeats.find((seat) => !prevSeats?.includes(seat));
  const eventAttributes: Record<string, string> = {
    seats: JSON.stringify(nextSeats)
  };

  if (newSeatMember) {
    eventAttributes.message = `${userId || 'User'} is on stage`;
  }

  return Promise.all([
    // Send a chat event containing the next seats
    chatSdk.sendEvent({
      chatRoomArn,
      eventName: 'stage:SEATS',
      attributes: eventAttributes
    }),
    // Update the RealTime table to reflect the new seats
    ddbDocClient.send(
      new UpdateItemCommand({
        TableName: ddbSdk.realTimeTableName,
        Key: { hostId: convertToAttr(hostId) },
        UpdateExpression: `SET #seats = :nextSeats`,
        ExpressionAttributeNames: { '#seats': 'seats' },
        ExpressionAttributeValues: {
          ':nextSeats': convertToAttr(nextSeats, {
            convertEmptyValues: false,
            removeUndefinedValues: false
          })
        }
      })
    )
  ]);
};

export const sendVoteEvent = (record: VotesRecord, eventName: string) => {
  const { chatRoomArn, tally } = record;

  const attributes: Record<string, string> = (
    Object.keys(tally) as (keyof typeof tally)[]
  ).reduce(
    (acc, candidateId) => ({
      ...acc,
      [candidateId]: tally[candidateId].toString()
    }),
    {}
  );

  return chatSdk.sendEvent({ attributes, chatRoomArn, eventName });
};
