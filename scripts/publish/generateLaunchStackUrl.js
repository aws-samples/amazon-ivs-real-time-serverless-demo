const { writeFileSync } = require('fs');

const { getStackName, getAwsConfig } = require('../utils');
const manifest = require('../../cdk.out/manifest.json');

async function generateLaunchStackUrls() {
  const stackName = getStackName();
  const { region } = await getAwsConfig();
  const { properties } = manifest.artifacts[stackName];
  const [bucket, ...keyPath] = properties.stackTemplateAssetObjectUrl
    .replace('s3://', '')
    .split('/');
  const templateKey = keyPath.join('/');

  const templateUrl = `https://${bucket}.s3.${region}.amazonaws.com/${templateKey}`;
  const launchStackUrl = `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/new?stackName=${stackName}&templateURL=${templateUrl}`;

  const outputFilename = `scripts/publish/launch.${region}.json`;
  writeFileSync(outputFilename, JSON.stringify({ launchStackUrl }, null, 2));

  console.info(launchStackUrl);
  console.info('\nOutput:', outputFilename);
}

generateLaunchStackUrls();
