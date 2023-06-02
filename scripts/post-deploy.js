const { GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { join } = require('path');
const { readFileSync } = require('fs');
const qrcode = require('qrcode-terminal');

const { getStackName } = require('./utils');
const { secretsManagerClient } = require('./clients');

const outputPath = join(__dirname, '../temp_out.json');
const outputJson = readFileSync(outputPath);
const output = JSON.parse(outputJson);

const stackName = getStackName();
const { domainName, secretName } = output[stackName];

const runPostDeploy = async () => {
  const cid = domainName?.split('.')[0];
  let apiKey;

  if (!secretName) {
    throw new Error('API key secret name not found.');
  }

  // Retrieve the API key secret string from Secrets Manager
  const { SecretString } = await secretsManagerClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );

  if (SecretString) {
    const secretValue = JSON.parse(SecretString);
    apiKey = secretValue.apiKey;
  }

  if (!cid) {
    throw new Error('Failed to retrieve the customer ID');
  }

  if (!apiKey) {
    throw new Error('Failed to retrieve the API key');
  }

  console.info(`\n ⭐️ Customer ID: ${cid}`);
  console.info(`\n 🔑 API key: ${apiKey}`);
  console.info('\n 🔎 Authentication QR code:');
  qrcode.generate(`${cid}-${apiKey}`, { small: true });
};

runPostDeploy();
