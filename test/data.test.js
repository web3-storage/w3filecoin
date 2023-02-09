import { testData as test } from './helpers/context.js'

import pWaitFor from 'p-wait-for'

import { createCarTable } from '../data/tables/car.js'
import { FERRY_STATE } from '../data/tables/ferry.js'

import { getCars } from '../data/test/helpers/car.js'
import { deleteAll, getTableRows } from './helpers/dynamo.js'
import {
  getAwsRegion,
  getDynamoDb,
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

test('can write in car table and gets loaded into ferry when batch size ready', async t => {
  const { ferryDynamo, carDynamo, cargoDynamo, region } = t.context
  const batchCount = 2
  const batchSize = 40

  const carTableClient = createCarTable(region, carDynamo.tableName, { endpoint: carDynamo.endpoint })
  const batches = await getBatchesToWrite(batchCount, batchSize)
  const totalSizeToLoad = batches.flat().reduce((accum, car) => accum + car.size, 0)

  // No ferries
  const ferryItemsBeforeWrites = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  t.is(ferryItemsBeforeWrites.length, 0)

  // First batch succeeds to insert
  await carTableClient.batchWrite(batches[0])
  const carItemsAfterFirstBatch = await getTableRows(carDynamo.client, carDynamo.tableName)
  t.is(carItemsAfterFirstBatch.length, batchSize)

  // No ferries while a batch is not ready
  const ferryItemsAfterFirstWrite = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  t.is(ferryItemsAfterFirstWrite.length, 0)

  // Second batch succeeds (already more than needed batch to add to ferry)
  await carTableClient.batchWrite(batches[1])
  const carItemsAfterSecondBatch = await getTableRows(carDynamo.client, carDynamo.tableName)
  t.is(carItemsAfterSecondBatch.length, batchSize * 2)

  // Await for events to be triggered from car table and get written into ferry table
  await pWaitFor(async () => {
    const ferries = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)

    // Wait until all CARs are added to ferries
    const ferriesTotalSize = ferries.reduce((acc, agg) => acc + agg.size, 0)
    return Boolean(ferries.length) && ferriesTotalSize === totalSizeToLoad
  }, {
    interval: 100
  })

  const ferriesAfterWrite = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  t.truthy(ferriesAfterWrite.length >= 1)
  t.is(ferriesAfterWrite[0].stat, FERRY_STATE.loading)
  t.truthy(ferriesAfterWrite[0].insertedAt)
  t.truthy(ferriesAfterWrite[0].updatedAt)
  // Might go to other ferries depending on events propagation timing
  t.is(ferriesAfterWrite.reduce((acc, agg) => acc + agg.size, 0), totalSizeToLoad)

  // Ferry items written
  const ferryItems = await getTableRows(cargoDynamo.client, cargoDynamo.tableName)
  t.is(ferryItems.length, batchSize * batchCount)
})

test('can write in car table until a ferry gets in ready state', async t => {
  const { ferryDynamo, carDynamo, cargoDynamo, region } = t.context
  const batchCount = 4
  const batchSize = 40

  const carTableClient = createCarTable(region, carDynamo.tableName, { endpoint: carDynamo.endpoint })
  const batches = await getBatchesToWrite(batchCount, batchSize)
  const totalSizeToLoad = batches.flat().reduce((accum, car) => accum + car.size, 0)

  // No ferries
  const ferryItemsBeforeWrites = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  t.is(ferryItemsBeforeWrites.length, 0)

  // Insert batches into car table
  for (const batch of batches) {
    await carTableClient.batchWrite(batch)
  }

  // Await for events to be triggered from car table and get written into ferry table
  await pWaitFor(async () => {
    const ferries = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)

    // Wait until all CARs are added to ferries
    const ferriesTotalSize = ferries.reduce((acc, agg) => acc + agg.size, 0)
    return Boolean(ferries.length) && ferriesTotalSize === totalSizeToLoad
  }, {
    interval: 100
  })

  const ferriesAfterWrite = await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  t.truthy(ferriesAfterWrite.length)
  // Must have all CARs and Size expected
  t.is(ferriesAfterWrite.reduce((acc, agg) => acc + agg.size, 0), totalSizeToLoad)

  // Ferry items written
  const ferryItems = await getTableRows(cargoDynamo.client, cargoDynamo.tableName)
  t.is(ferryItems.length, batchSize * batchCount)
})

/**
 * @param {number} length
 * @param {number} batchSize
 */
async function getBatchesToWrite (length, batchSize) {
  return Promise.all(
    Array.from({ length }).map(async () => {
      const cars = await (getCars(batchSize))

      return cars.map(car => ({
        link: car.link.toString(),
        size: car.size,
        commP: 'commP',
        url: 'url',
        md5: 'md5',
      }))
    })
  )
}
