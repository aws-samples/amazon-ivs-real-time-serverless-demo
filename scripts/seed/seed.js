const { DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const { GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { writeFileSync } = require('fs');

const {
  chooseRandomDistinct,
  getStackName,
  retryWithConstantBackoff
} = require('../utils');
const { cloudFormationClient, secretsManagerClient } = require('../clients');
const fruits = require('./fruits.json');
const { parseArgs } = require('util');

const MAX_COUNT = 10;
const commonHostAttributes = {
  avatarColLeft: '#eb5f07',
  avatarColRight: '#d91515',
  avatarColBottom: '#ff9900'
};

const { values: args } = parseArgs({
  options: {
    type: { type: 'string', default: 'video' },
    count: { type: 'string', default: '1' }
  },
  strict: false
});

const getStackOutputs = async () => {
  const stackName = getStackName();
  const { Stacks } = await cloudFormationClient.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const stack = Stacks?.[0];
  const outputs = stack?.Outputs.reduce(
    (acc, output) => ({
      ...acc,
      [output.OutputKey]: output.OutputValue
    }),
    {}
  );

  return outputs;
};

const getApiKey = async (secretName) => {
  if (!secretName) {
    return;
  }

  const { SecretString } = await secretsManagerClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  if (SecretString) {
    const secretValue = JSON.parse(SecretString);

    return secretValue.apiKey;
  }
};

const createDemoItem = async (cid, apiKey, hostId) => {
  const url = `https://${cid}.cloudfront.net/create`;
  const hostAttributes = { ...commonHostAttributes, username: hostId };
  const { type } = args;

  const result = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    method: 'POST',
    body: JSON.stringify({ cid, hostId, type, hostAttributes })
  });
  const { hostParticipantToken } = await result.json();

  return hostParticipantToken.token;
};

const seed = async () => {
  const { domainName, secretName } = await getStackOutputs();
  const cid = domainName?.split('.')[0];
  const apiKey = await getApiKey(secretName);
  const count = Number(args.count);

  if (!cid) {
    throw new Error('Failed to retrieve the customer ID');
  }

  if (!apiKey) {
    throw new Error('Failed to retrieve the API key');
  }

  const randomDemoIds = chooseRandomDistinct(fruits, count);
  const results = {};
  const boundedCount = Math.min(Math.max(count, 0), MAX_COUNT);

  for (let i = 0; i < boundedCount; i++) {
    const demoId = randomDemoIds[i];
    const demoIdCapitalized = demoId.charAt(0).toUpperCase() + demoId.slice(1);
    const hostId = `Demo${demoIdCapitalized}${i}`;

    results[hostId] = await retryWithConstantBackoff({
      promiseFn: () => createDemoItem(cid, apiKey, hostId)
    });
  }

  const outputFilename = 'scripts/seed/output.json';
  writeFileSync(outputFilename, JSON.stringify(results, null, 2));

  console.info(results);
  console.info('\nOutput:', outputFilename);
};

seed();
