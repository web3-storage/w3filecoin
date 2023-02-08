import * as Sentry from '@sentry/serverless'
import { SQSClient, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs'

import { registerCars } from '../lib/register-cars.js'
import parseSqsReplicatorEvent from '../utils/parse-sqs-event.js'

Sentry.AWSLambda.init({
  environment: process.env.SST_STAGE,
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
})

const AWS_REGION = mustGetEnv('AWS_REGION')

/**
 * Get EventRecord from the SQS Event triggering the handler
 *
 * @param {import('aws-lambda').SQSEvent} event
 */
async function carMetadataWriterHandler (event) {
  const {
    CAR_TABLE_NAME,
    QUEUE_URL
  } = getEnv()

  const records = parseSqsReplicatorEvent(event)
  if (!records) {
    throw new Error('Invalid replicator event format')
  }

  const { fulfilledEvents, rejectedEvents } = await registerCars(records, {
    region: AWS_REGION,
    tableName: CAR_TABLE_NAME,
  })

  // If we do not handle all of them, we should retry only needed messages
  if (rejectedEvents.length) {
    const sqsClient = new SQSClient({})
    // TODO: this needs batches of up to 10...
    const deleteCmd = new DeleteMessageBatchCommand({
      QueueUrl: QUEUE_URL,
      Entries: fulfilledEvents.map(event => ({
        Id: event.messageId,
        ReceiptHandle: event.receiptHandle
      }))
    })
    await sqsClient.send(deleteCmd)

    throw new Error('not all messages in the batch suceeded')
  }
}

export const handler = Sentry.AWSLambda.wrapHandler(carMetadataWriterHandler)

/**
 * Get Env validating it is set.
 */
function getEnv() {
  return {
    CAR_TABLE_NAME: mustGetEnv('CAR_TABLE_NAME'),
    QUEUE_URL: mustGetEnv('QUEUE_URL')
  }
}

/**
 * 
 * @param {string} name 
 * @returns {string}
 */
function mustGetEnv (name) {
  if (!process.env[name]) {
    throw new Error(`Missing env var: ${name}`)
  }

  // @ts-expect-error there will always be a string there, but typescript does not believe
  return process.env[name]
}
