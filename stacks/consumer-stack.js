import {
  EventBus,
  Function,
  Queue,
  use
} from '@serverless-stack/resources'
import * as events from 'aws-cdk-lib/aws-events'
import { Duration } from 'aws-cdk-lib'

import { DataStack } from './data-stack.js'
import { setupSentry } from './config.js'

const REPLICATOR_EVENT_BRIDGE_SOURCE_EVENT = 'w3infra-replicator'

/**
 * @param {import('@serverless-stack/resources').StackContext} properties
 */
export function ConsumerStack({ stack, app }) {
  stack.setDefaultFunctionProps({
    srcPath: 'consumer'
  })

  // Setup app monitoring with Sentry
  setupSentry(app, stack)
  const { W3INFRA_EVENT_BRIDGE_ARN } = getEnv()

  // Get references to constructs created in other stacks
  const { carTable } = use(DataStack)

  // Queue of CARs for registration
  const registerCarsQueue = new Queue(stack, 'register-cars', {
    cdk: {
      queue: {
        // Needs to be set as less or equal than consumer function
        visibilityTimeout: Duration.seconds(15 * 60),
      },
    },
  })

  // Register CAR to be added to a ferry
  const registerCarsHandler = new Function(
    stack,
    'register-cars-handler',
    {
      environment: {
        CAR_TABLE_NAME: carTable.tableName,
        QUEUE_URL: registerCarsQueue.queueUrl
      },
      permissions: [carTable],
      handler: 'functions/register-cars.handler',
      timeout: 15 * 60,
    }
  )

  registerCarsQueue.addConsumer(stack, {
    function: registerCarsHandler,
      cdk: {
        eventSource: {
          // Maximum batch size must be between 1 and 10 inclusive when batching window is not specified.
          // TODO: need window
          batchSize: 50,
          maxBatchingWindow: Duration.minutes(5),
        },
      }
  })

  // TODO: This should be replaced by receipts for replicator in the future
  // Event bus bind
  const eventBus = new EventBus(stack, 'event-bus', {
    // @ts-expect-error types not match...
    eventBridgeEventBus: events.EventBus.fromEventBusArn(stack, 'imported-event-bus', W3INFRA_EVENT_BRIDGE_ARN)
  })

  eventBus.addRules(stack, {
    newCar: {
      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events.EventPattern.html
      pattern: {
        source: [REPLICATOR_EVENT_BRIDGE_SOURCE_EVENT],
        // https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html#eb-filtering-suffix-matching
        detail: {
          'key': [ { "suffix": ".car" } ]
        }
      },
      targets: {
        registerCarsQueueTarget: {
          type: 'queue',
          queue: registerCarsQueue
        },
      }
    }
  })
}

/**
 * Get Env validating it is set.
 */
function getEnv() {
  return {
    W3INFRA_EVENT_BRIDGE_ARN: mustGetEnv('W3INFRA_EVENT_BRIDGE_ARN'),
  }
}

/**
 * @param {string} name 
 * @returns {string}
 */
export function mustGetEnv (name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}
