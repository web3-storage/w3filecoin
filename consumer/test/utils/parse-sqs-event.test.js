import { test } from '../helpers/context.js'

import parseSqsReplicatorEvent from '../../utils/parse-sqs-event.js'

test('parse sqs event with one record', (t) => {
  const sqsEvent = {
    Records: [
      {
        body: JSON.stringify({
          key: 'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
          url: 'https://endpoint.io/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
        }),
        receiptHandle: `${Date.now()}`
      },
    ],
  }

  // @ts-expect-error not complete event
  const records = parseSqsReplicatorEvent(sqsEvent)
  t.is(records.length, 1)
  t.truthy(records[0].receiptHandle)
  t.is(records[0].detail.key,
    'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car'
  )
})

test('parse sqs event with multiple records', (t) => {
  const sqsEvent = {
    Records: [
      {
        body: JSON.stringify({
          key: 'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
          url: 'https://endpoint.io/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
        }),
        receiptHandle: `${Date.now()}`
      },
      {
        body: JSON.stringify({
          key: 'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
          url: 'https://endpoint.io/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car',
        }),
        receiptHandle: `${Date.now()}`
      },
    ],
  }

  // @ts-expect-error not complete event
  const records = parseSqsReplicatorEvent(sqsEvent)
  t.is(records.length, 2)
  t.truthy(records[0].receiptHandle)
  t.is(records[0].detail.key,
    'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car'
  )
  t.truthy(records[1].receiptHandle)
  t.is(records[1].detail.key,
    'bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a/bagbaiera22227qz2m5rgyuw6ok5mxui7daacloos3kfyynuqxqa3svguhp4a.car'
  )
})
