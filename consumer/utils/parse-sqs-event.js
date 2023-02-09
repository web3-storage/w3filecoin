/**
 * Extract the Event records from the passed SQS Event
 *
 * @param {import('aws-lambda').SQSEvent} sqsEvent
 * @returns {import('../types').SqsCarEvent[]}
 */
export default function parseSqsReplicatorEvent(sqsEvent) {
  return sqsEvent.Records.map((record) => ({
    detail: JSON.parse(record.body),
    receiptHandle: record.receiptHandle,
    messageId: record.messageId
  }))
}
