#!/usr/bin/env node
import 'source-map-support/register';
import {
  App,
  Aspects,
  Aws,
  DefaultStackSynthesizer,
  Environment
} from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import * as dotenv from 'dotenv';
import path from 'path';

import { RealTimeStack } from '../lib/real-time-stack';

const app = new App();

// Runtime context values
const stackName: string = app.node.tryGetContext('stackName');
const alarmsEmail: string | undefined = app.node.tryGetContext('alarmsEmail');
const terminationProtection: boolean = JSON.parse(
  app.node.tryGetContext('terminationProtection') || 'false'
);
const nag: boolean = JSON.parse(app.node.tryGetContext('nag') || 'false');
const publish: boolean = JSON.parse(
  app.node.tryGetContext('publish') || 'false'
);

// Environment
const region = process.env.CDK_DEFAULT_REGION;
let env: Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region
};

// Synthesizer
let synthesizer: DefaultStackSynthesizer | undefined;

if (publish) {
  const publishEnvPath = path.resolve(
    __dirname,
    `../scripts/publish/publish.${region}.env`
  );
  dotenv.config({ path: publishEnvPath });

  synthesizer = new DefaultStackSynthesizer({
    fileAssetsBucketName: process.env.FILE_ASSETS_BUCKET_NAME,
    fileAssetPublishingRoleArn: process.env.FILE_ASSET_PUBLISHING_ROLE_ARN,
    generateBootstrapVersionRule: false,
    bucketPrefix: `${stackName}/`
  });

  // account-agnostic environment
  env = { account: Aws.ACCOUNT_ID, region };
}

new RealTimeStack(app, stackName, {
  env,
  synthesizer,
  terminationProtection,
  alarmsEmail
});

// Check the CDK app for best practices by using a combination of rule packs
if (nag) {
  const awsSolutionsChecks = new AwsSolutionsChecks({ verbose: true });
  Aspects.of(app).add(awsSolutionsChecks);
}
