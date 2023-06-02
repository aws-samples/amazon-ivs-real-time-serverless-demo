import {
  CreateParticipantTokenCommand,
  CreateStageCommand,
  DeleteStageCommand,
  DisconnectParticipantCommand,
  ListStagesCommand,
  ParticipantToken,
  ParticipantTokenCapability,
  Stage,
  StageSummary
} from '@aws-sdk/client-ivs-realtime';

import { DEMO } from '../../config.json';
import { ivsRealTimeClient } from '../clients';
import { PARTICIPANT_TOKEN_DURATION_IN_MINUTES } from '../constants';

export const createStage = async ({
  cid,
  hostId,
  hostAttributes
}: {
  cid: string;
  hostId: string;
  hostAttributes?: Record<string, string>;
}): Promise<{ stage: Stage; hostParticipantToken: ParticipantToken }> => {
  const { stage, participantTokens } = await ivsRealTimeClient.send(
    new CreateStageCommand({
      name: `${cid}-${hostId}-Stage`,
      tags: { cid, createdAt: new Date().toISOString(), demo: DEMO },
      participantTokenConfigurations: [
        {
          userId: hostId,
          capabilities: [
            ParticipantTokenCapability.PUBLISH,
            ParticipantTokenCapability.SUBSCRIBE
          ],
          attributes: hostAttributes,
          duration: PARTICIPANT_TOKEN_DURATION_IN_MINUTES
        }
      ]
    })
  );
  const [{ token, participantId, duration }] =
    participantTokens as ParticipantToken[];

  return {
    stage: stage!,
    hostParticipantToken: { token, participantId, duration }
  };
};

export const createParticipantToken = async ({
  userId,
  stageArn,
  capabilities,
  attributes
}: {
  userId: string;
  stageArn: string;
  capabilities?: (ParticipantTokenCapability | string)[];
  attributes?: Record<string, string>;
}): Promise<ParticipantToken> => {
  const { participantToken } = await ivsRealTimeClient.send(
    new CreateParticipantTokenCommand({
      userId,
      stageArn,
      attributes,
      capabilities, // Default: PUBLISH, SUBSCRIBE
      duration: PARTICIPANT_TOKEN_DURATION_IN_MINUTES
    })
  );
  const {
    token,
    participantId,
    duration = PARTICIPANT_TOKEN_DURATION_IN_MINUTES
  } = participantToken as ParticipantToken;

  return { token, participantId, duration };
};

export const disconnectParticipant = (
  stageArn: string,
  participantId: string,
  reason: string = 'Disconnected by host'
) =>
  ivsRealTimeClient.send(
    new DisconnectParticipantCommand({ stageArn, participantId, reason })
  );

export const deleteStage = (stageArn: string) =>
  ivsRealTimeClient.send(new DeleteStageCommand({ arn: stageArn }));

export const getStageSummaries = async (
  cid: string,
  maxRetries: number = 3
) => {
  if (!cid) return [];

  let retries = 0;
  let totalStages: StageSummary[] = [];

  await (async function listStages(token?: string) {
    try {
      const { stages, nextToken } = await ivsRealTimeClient.send(
        new ListStagesCommand({ maxResults: 100, nextToken: token })
      );

      if (stages) totalStages = totalStages.concat(stages);

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

  const cidStages = totalStages.filter(
    ({ tags }) => tags?.demo === DEMO && tags?.cid === cid
  );

  return cidStages;
};
