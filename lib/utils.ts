import {
  aws_lambda_nodejs as lambda,
  aws_logs as logs,
  Duration
} from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';

const getLambdaEntryPath = (functionName: string) =>
  join(__dirname, '../lambdas/handlers', `${functionName}.ts`);

export const getDefaultLambdaProps = (
  entryFunctionName?: string
): lambda.NodejsFunctionProps => ({
  bundling: {
    minify: true,
    /**
     * By default, when using the NODEJS_18_X runtime, @aws-sdk/* is included in externalModules
     * since it is already available in the Lambda runtime. However, to ensure that the latest
     * @aws-sdk version is used, which contains the @aws-sdk/client-ivs-realtime package, we
     * remove @aws-sdk/* from externalModules so that we bundle it instead.
     */
    externalModules: []
  },
  runtime: Runtime.NODEJS_18_X,
  timeout: Duration.minutes(1),
  maxEventAge: Duration.minutes(1),
  logRetention: logs.RetentionDays.ONE_YEAR,
  ...(entryFunctionName && { entry: getLambdaEntryPath(entryFunctionName) })
});