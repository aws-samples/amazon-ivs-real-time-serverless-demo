import {
  aws_events as events,
  aws_events_targets as eventsTargets,
  aws_lambda_nodejs as lambda,
  aws_stepfunctions as stepFunctions,
  aws_stepfunctions_tasks as stepFunctionsTasks,
  Duration,
  Stack
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IEventSource } from 'aws-cdk-lib/aws-lambda';
import { parseExpression } from 'cron-parser';

interface CronOptionsWithSecond extends events.CronOptions {
  /**
   * The second to invoke the Lambda at
   * @default - "0"; invoke at the first second of every minute
   */
  second?: string;
}

interface CronScheduleTriggerProps {
  cronSchedule: CronOptionsWithSecond;
}

export class CronScheduleTrigger extends Construct implements IEventSource {
  constructor(
    scope: Construct,
    id: string,
    private props: CronScheduleTriggerProps
  ) {
    super(scope, id);
  }

  bind(target: lambda.NodejsFunction) {
    const { second, ...restCronSchedule } = this.props.cronSchedule;
    const secondOfCronSchedule = second == null ? '0' : second;
    const scopedId = target.node.id;
    const stackName = Stack.of(this);
    const defaultRuleProps = {
      ruleName: `${stackName}-${scopedId}-Rule`,
      schedule: events.Schedule.cron(restCronSchedule)
    };

    if (secondOfCronSchedule === '0') {
      // Schedule is not sub-minute, so there is no need for a StepFunctions State Machine; a simple event schedule will suffice
      new events.Rule(this, 'EventCronScheduleRule', {
        ...defaultRuleProps,
        targets: [new eventsTargets.LambdaFunction(target)]
      });

      return;
    }

    const wait = new stepFunctions.Wait(this, 'Wait-State', {
      time: stepFunctions.WaitTime.secondsPath('$')
    });
    const invoke = new stepFunctionsTasks.LambdaInvoke(
      this,
      'LambdaInvoke-Task',
      {
        lambdaFunction: target,
        payload: stepFunctions.TaskInput.fromObject({})
      }
    );
    const waitThenInvoke = new stepFunctions.Choice(
      this,
      'WaitThenInvoke-Choice'
    )
      .when(
        stepFunctions.Condition.numberGreaterThan('$', 0),
        wait.next(invoke)
      )
      .otherwise(invoke);

    const seconds: number[] = [];
    const cronSchedule = parseExpression(secondOfCronSchedule + ' * * * * *');
    cronSchedule.fields.second.forEach((s) => {
      if (seconds.length === 0 || s !== seconds[seconds.length - 1])
        seconds.push(s);
    });

    const createLoopItems = new stepFunctions.Pass(
      this,
      'LoopItems-PassState',
      {
        result: stepFunctions.Result.fromArray(
          seconds.map((s, i) => (i === 0 ? s : s - seconds[i - 1]))
        )
      }
    );
    const loop = new stepFunctions.Map(this, 'Loop-MapState', {
      maxConcurrency: 1
    }).iterator(waitThenInvoke);

    const loopChain = createLoopItems.next(loop);
    const stateMachine = new stepFunctions.StateMachine(this, 'StateMachine', {
      definitionBody: stepFunctions.DefinitionBody.fromChainable(loopChain),
      stateMachineName: `${stackName}-${scopedId}-StateMachine`,
      stateMachineType: stepFunctions.StateMachineType.EXPRESS,
      timeout: Duration.seconds(90)
    });

    new events.Rule(this, 'EventCronScheduleRule', {
      ...defaultRuleProps,
      targets: [new eventsTargets.SfnStateMachine(stateMachine)]
    });
  }
}

export default CronScheduleTrigger;
