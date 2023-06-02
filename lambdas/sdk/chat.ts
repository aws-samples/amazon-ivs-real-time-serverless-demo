import {
  ChatTokenCapability,
  CreateChatTokenCommand,
  CreateRoomCommand,
  DeleteRoomCommand,
  DisconnectUserCommand,
  ListRoomsCommand,
  RoomSummary,
  SendEventCommand
} from '@aws-sdk/client-ivschat';

import { CHAT_TOKEN_SESSION_DURATION_IN_MINUTES } from '../constants';
import { ChatToken, Room } from '../types';
import { DEMO } from '../../config.json';
import { ivsChatClient } from '../clients';

export const createRoom = async ({
  cid,
  hostId
}: {
  cid: string;
  hostId: string;
}): Promise<Room> =>
  await ivsChatClient.send(
    new CreateRoomCommand({
      name: `${cid}-${hostId}-Room`,
      tags: { cid, createdAt: new Date().toISOString(), demo: DEMO }
    })
  );

export const createChatToken = async ({
  userId,
  chatRoomArn,
  capabilities,
  attributes
}: {
  userId: string;
  chatRoomArn: string;
  capabilities?: (ChatTokenCapability | string)[];
  attributes?: Record<string, string>;
}): Promise<ChatToken> => {
  const { token, sessionExpirationTime, tokenExpirationTime } =
    await ivsChatClient.send(
      new CreateChatTokenCommand({
        userId,
        attributes,
        capabilities, // Default: None (the capability to view messages is implicitly included in all requests)
        roomIdentifier: chatRoomArn,
        sessionDurationInMinutes: CHAT_TOKEN_SESSION_DURATION_IN_MINUTES
      })
    );

  return { token, sessionExpirationTime, tokenExpirationTime };
};

export const sendEvent = ({
  chatRoomArn,
  eventName,
  attributes
}: {
  chatRoomArn: string;
  eventName: string;
  attributes?: Record<string, string>;
}) =>
  ivsChatClient.send(
    new SendEventCommand({ roomIdentifier: chatRoomArn, eventName, attributes })
  );

export const disconnectChatUser = (
  chatRoomArn: string,
  userId: string,
  reason: string = 'Disconnected by host'
) =>
  ivsChatClient.send(
    new DisconnectUserCommand({ roomIdentifier: chatRoomArn, userId, reason })
  );

export const deleteRoom = (chatRoomArn: string) =>
  ivsChatClient.send(new DeleteRoomCommand({ identifier: chatRoomArn }));

export const getRoomSummaries = async (cid: string, maxRetries: number = 3) => {
  if (!cid) return [];

  let retries = 0;
  let totalRooms: RoomSummary[] = [];

  await (async function listStages(token?: string) {
    try {
      const { rooms, nextToken } = await ivsChatClient.send(
        new ListRoomsCommand({ maxResults: 50, nextToken: token })
      );

      if (rooms) totalRooms = totalRooms.concat(rooms);

      if (nextToken) await listStages(nextToken);
    } catch (error) {
      console.error(error);
      if (retries < maxRetries) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 200)); // wait 200ms
        await listStages(token);
      }
    }
  })();

  const cidRooms = totalRooms.filter(
    ({ tags }) => tags?.demo === DEMO && tags?.cid === cid
  );

  return cidRooms;
};
