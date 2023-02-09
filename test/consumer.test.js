import { testData as test } from './helpers/context.js'

import pWaitFor from 'p-wait-for'

import { deleteAll, getTableItem } from './helpers/dynamo.js'
import { getClient } from './helpers/up-client.js'
import { randomFile } from './helpers/random.js'
import {
  getAwsRegion,
  getDynamoDb,
  getUploadApiEndpoint,
} from './helpers/deployment.js'

test.before(async t => {
  const region = getAwsRegion()
  const carDynamo = getDynamoDb('car')
  const cargoDynamo = getDynamoDb('cargo')
  const ferryDynamo = getDynamoDb('ferry')

  t.context = {
    region,
    carDynamo,
    ferryDynamo,
    cargoDynamo
  }

  await deleteAll(t.context)
})

test.afterEach(async t => {
  await deleteAll(t.context)
})

test.skip('Adds new uploaded CARs into CAR table waiting ferry', async t => {
  const { carDynamo } = t.context

  const uploadApiEndpoint = getUploadApiEndpoint()
  const client = await getClient(uploadApiEndpoint)

  // Upload new file
  const file = await randomFile(100)
  const fileLink = await client.uploadFile(file)
  t.truthy(fileLink)

  // Wait for file to be replicated and make it to w3filecoin registration
  // maybe wait for everything?
  await pWaitFor(async () => {
    const carItem = await getTableItem(carDynamo.client, carDynamo.tableName, fileLink.toString())
    return Boolean(carItem)
  })
})
