const { GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { parseArgs } = require('util');

const { stsClient } = require('./clients');

const { values: args } = parseArgs({
  options: { stackName: { type: 'string' } },
  strict: false
});

const getStackName = () => {
  return args.stackName;
};

const getAwsConfig = async () => {
  const { Account: account } = await stsClient.send(
    new GetCallerIdentityCommand({})
  );
  const region = await stsClient.config.region();

  return { account, region };
};

const chooseRandomDistinct = (array, count) => {
  if (!array.length || !count) return [];

  const boundedCount = Math.min(Math.max(count, 0), array.length);
  const copy = array.slice(0);
  const items = [];

  for (let i = 0; i < boundedCount; i++) {
    const randomIndex = Math.floor(Math.random() * copy.length);
    const randomItem = copy[randomIndex];
    items.push(randomItem);
    copy.splice(randomIndex, 1);
  }

  return items;
};

const retryWithConstantBackoff = ({
  promiseFn,
  maxRetries = 5,
  delay = 200
}) => {
  const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const retry = async (retries) => {
    try {
      // backoff
      if (retries > 0) await waitFor(delay);
      // evaluate
      const result = await promiseFn();

      return result;
    } catch (error) {
      if (retries < maxRetries) {
        // retry
        const nextRetries = retries + 1;

        return retry(nextRetries);
      } else {
        // fail
        console.warn('Max retries reached. Bubbling the error up.');
        throw error;
      }
    }
  };

  return retry(0);
};

module.exports = {
  chooseRandomDistinct,
  getAwsConfig,
  getStackName,
  retryWithConstantBackoff
};
