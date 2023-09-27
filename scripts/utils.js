const { DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const { GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { parseArgs } = require('util');

const {
  cloudFormationClient,
  secretsManagerClient,
  stsClient
} = require('./clients');

const { values: args } = parseArgs({
  options: { stackName: { type: 'string' } },
  strict: false
});

async function getAwsConfig() {
  const getCallerIdentityCommand = new GetCallerIdentityCommand({});

  const [{ Account }, region] = await Promise.all([
    stsClient.send(getCallerIdentityCommand),
    stsClient.config.region()
  ]);

  return { account: Account, region };
}

function getStackName() {
  return args.stackName;
}

async function getApiKey(secretName) {
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
}

async function getStackOutputs() {
  const stackName = getStackName();
  const { Stacks } = await cloudFormationClient.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const [stack] = Stacks;
  const outputs = stack.Outputs.reduce(
    (acc, output) => ({
      ...acc,
      [output.OutputKey]: output.OutputValue
    }),
    {}
  );

  return outputs;
}

async function getCustomerCode() {
  const { domainName, secretName } = await getStackOutputs();

  const [cid] = domainName?.split('.');
  if (!cid) {
    throw new Error('Failed to retrieve the customer ID');
  }

  const apiKey = await getApiKey(secretName);
  if (!apiKey) {
    throw new Error('Failed to retrieve the API key');
  }

  return { cid, apiKey };
}

const retryWithConstantBackoff = (
  promiseFn,
  { maxRetries = 5, delay = 200 } = {}
) => {
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
  getApiKey,
  getAwsConfig,
  getCustomerCode,
  getStackName,
  getStackOutputs,
  retryWithConstantBackoff
};
