const { CloudFormationClient } = require('@aws-sdk/client-cloudformation');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');
const { IAMClient } = require('@aws-sdk/client-iam');
const { parseArgs } = require('util');
const { S3Client } = require('@aws-sdk/client-s3');
const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
const { STSClient } = require('@aws-sdk/client-sts');

const { values: args } = parseArgs({
  options: {
    profile: { type: 'string' }
  },
  strict: false
});
const { profile: awsProfile } = args;

let clientConfig = {};
if (awsProfile) {
  const credentialsProvider = fromIni({ profile: awsProfile });
  clientConfig = { credentials: credentialsProvider };
}

// AWS clients
const cloudFormationClient = new CloudFormationClient(clientConfig);
const iamClient = new IAMClient(clientConfig);
const s3Client = new S3Client(clientConfig);
const secretsManagerClient = new SecretsManagerClient(clientConfig);
const stsClient = new STSClient(clientConfig);

module.exports = {
  cloudFormationClient,
  iamClient,
  s3Client,
  secretsManagerClient,
  stsClient
};
