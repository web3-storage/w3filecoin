import { Table } from '@serverless-stack/resources'
import { StartingPosition } from 'aws-cdk-lib/aws-lambda'

import {
  carTableProps,
  cargoTableProps,
  ferryTableProps
} from '../data/tables/index.js'
import {
  getFerryConfig,
  setupSentry,
} from './config.js'

/**
 * @param {import('@serverless-stack/resources').StackContext} properties
 */
export function DataStack({ stack, app }) {
  stack.setDefaultFunctionProps({
    srcPath: 'data'
  })

  // Setup app monitoring with Sentry
  setupSentry(app, stack)

  /**
   * This table tracks CARs pending a Filecoin deal together with their metadata.
   */
  const carTable = new Table(stack, 'car', {
    ...carTableProps,
    // information that will be written to the stream
    stream: 'new_image',
  })

  /**
   * This table tracks cars that are set to go on a ferry to a filecoin miner (cargo).
   */
  const cargoTable = new Table(stack, 'cargo', {
    ...cargoTableProps,
  })

  /**
   * Table representing a boat load of 'cargo'
   */
  const ferryTable = new Table(stack, 'ferry', {
    ...ferryTableProps,
    // information that will be written to the stream
    stream: 'new_and_old_images'
  })

  const ferryConfig = getFerryConfig(stack)

  // car dynamodb table stream consumers
  carTable.addConsumers(stack, {
    // Car table stream consumer for adding to ferry
    addCarsToFerry: {
      function: {
        handler: 'functions/add-cars-to-ferry.consumer',
        environment: {
          FERRY_TABLE_NAME: ferryTable.tableName,
          FERRY_CARGO_MIN_SIZE: ferryConfig.ferryCargoMinSize,
          FERRY_CARGO_MAX_SIZE: ferryConfig.ferryCargoMaxSize,
          CARGO_TABLE_NAME: cargoTable.tableName,
        },
        permissions: [cargoTable, ferryTable],
        timeout: 3 * 60,
      },
      cdk: {
        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_event_sources.DynamoEventSourceProps.html#filters
        eventSource: {
          batchSize: 50,
          // Start reading at the last untrimmed record in the shard in the system.
          startingPosition: StartingPosition.TRIM_HORIZON,
          // If the function returns an error, split the batch in two and retry.
          bisectBatchOnError: true,
          maxBatchingWindow: ferryConfig.maxBatchingWindow,
          // TODO: Add error queue
          // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_event_sources.DynamoEventSourceProps.html#onfailure
        }
      },
      filters: [
        {
          eventName: ['INSERT']
        }
      ]
    },
  })

  // Ferry state machine
  // LOADING -> READY = state change when size ready
  // READY -> DEAL_PENDING = request Spade
  // DEAL_PENDING -> DEAL_PROCESSED = deal succeeded + GC

  // ferry dynamodb table stream consumers
  ferryTable.addConsumers(stack, {
    // Ferry table stream consumer for requesting deals on ready
    setFerryAsReady: {
      function: {
        handler: 'functions/set-ferry-as-ready.consumer',
        environment: {
          FERRY_TABLE_NAME: ferryTable.tableName,
          FERRY_CARGO_MIN_SIZE: ferryConfig.ferryCargoMinSize,
          FERRY_CARGO_MAX_SIZE: ferryConfig.ferryCargoMaxSize,
        },
        permissions: [ferryTable],
        timeout: 15 * 60,
      },
      cdk: {
        eventSource: {
          batchSize: 1,
          // Start reading at the last untrimmed record in the shard in the system.
          startingPosition: StartingPosition.TRIM_HORIZON,
          // TODO: Add error queue
          // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_event_sources.DynamoEventSourceProps.html#onfailure
        }
      },
      filters: [
        // Trigger when there is enough data abd state is ingesting
        {
          dynamodb: {
            NewImage: {
              // TODO: we need to do this filtering inside lambda for now...
              // https://repost.aws/questions/QUxxQDRk5mQ22jR4L3KsTkKQ/dynamo-db-streams-filter-with-nested-fields-not-working
              // size: {
              //   N: ['>', Number(ferryConfig.ferryCargoMinSize)]
              // },
              stat: {
                S: ['LOADING']
              }
            }
          }
        }
      ]
    },
  })

  return {
    carTable,
    cargoTable,
    ferryTable,
  }
}
