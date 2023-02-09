import { carTest as test } from '../helpers/context.js'
import { createDynamodDb, dynamoDBTableConfig } from '../helpers/resources.js'
import { getCars } from '../helpers/car.js'

import { CreateTableCommand, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { customAlphabet } from 'nanoid'

import { carTableProps } from '@w3filecoin/data/tables/index.js'
import { registerCars } from '../../lib/register-cars.js'

const REGION = 'us-west-2'
const endpoint = 'http://127.0.0.1:9082/'

test.before(async t => {
  // Dynamo DB
  const {
    client: dynamo,
    endpoint: dbEndpoint
  } = await createDynamodDb({ port: 8000 })

  t.context.dbEndpoint = dbEndpoint
  t.context.dynamoClient = dynamo
})

test('can register batch of CARs to ferry waiting list', async t => {
  const carsBatchSize = 10
  const { carTableName, carProps } = await getTable(t)
  const cars = await getCars(carsBatchSize)

  const carsPendingDealBefore = await getTableCars(t.context.dynamoClient, carTableName)
  t.is(carsPendingDealBefore.length, 0)

  // Register CARs
  const carEvents = cars.map(car => ({
    detail: {
      key: `${car.link.toString()}/${car.link.toString()}.car`,
      url: `${endpoint}${car.link.toString()}`
    },
    receiptHandle: `${Date.now()}`,
    messageId: `${Date.now()}`
  }))
  const registrationResponse = await registerCars(carEvents, carProps)

  // All succeeded to register
  t.is(registrationResponse.fulfilledEvents.length, carsBatchSize)
  t.is(registrationResponse.rejectedEvents.length, 0)

  // Validate CARs go into table
  const carsPendingDealAfterRegistrations = await getTableCars(t.context.dynamoClient, carTableName)
  t.is(carsPendingDealAfterRegistrations.length, carsBatchSize)
  
  for (const carRegistered of carsPendingDealAfterRegistrations) {
    t.truthy(cars.find(car => car.link.toString() === carRegistered.link))
    t.is(carRegistered.url, `${endpoint}${carRegistered.link}`)
  }
})

test('can handle partial failures registering a batch of CARs to ferry waiting list', async t => {
  const carsBatchSize = 1
  const notFoundCid = 'bag404'
  const { carTableName, carProps } = await getTable(t)
  const cars = await getCars(carsBatchSize)

  const carsPendingDealBefore = await getTableCars(t.context.dynamoClient, carTableName)
  t.is(carsPendingDealBefore.length, 0)

  // Register CARs
  const carEvents = [
    ...cars.map(car => ({
      detail: {
        key: `${car.link.toString()}/${car.link.toString()}.car`,
        url: `${endpoint}${car.link.toString()}`
      },
      receiptHandle: `${Date.now()}`,
      messageId: `${Date.now()}`
    })),
    {
      detail: {
        key: `${notFoundCid}/${notFoundCid}.car`,
        url: `${endpoint}${notFoundCid}`
      },
      receiptHandle: `${Date.now()}`,
      messageId: `${Date.now()}`
    }
  ]
  const registrationResponse = await registerCars(carEvents, carProps)

  // All succeeded to register
  t.is(registrationResponse.fulfilledEvents.length, carsBatchSize)
  t.is(registrationResponse.rejectedEvents.length, 1)

  // Validate CARs go into table
  const carsPendingDealAfterRegistrations = await getTableCars(t.context.dynamoClient, carTableName)
  t.is(carsPendingDealAfterRegistrations.length, carsBatchSize)

  for (const carRegistered of carsPendingDealAfterRegistrations) {
    t.truthy(cars.find(car => car.link.toString() === carRegistered.link))
    t.is(carRegistered.url, `${endpoint}${carRegistered.link}`)
  }

  // Validate not found car is not included
  t.falsy(carsPendingDealAfterRegistrations.find(car => car.link === notFoundCid))
})

/**
 * @param {import('ava').ExecutionContext<import('../helpers/context.js').CarContext>} t
 */
async function getTable (t) {
  const { carTableName } = await prepareResources(t.context.dynamoClient)
  const carProps = {
    region: REGION,
    tableName: carTableName,
    options: {
      endpoint: t.context.dbEndpoint,
    }
  }

  return { carProps, carTableName }
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {object} [options]
 * @param {number} [options.limit]
 */
async function getTableCars (dynamo, tableName, options = {}) {
  const cmd = new ScanCommand({
    TableName: tableName,
    Limit: options.limit || 30
  })

  const response = await dynamo.send(cmd)
  return response.Items?.map(i => unmarshall(i)) || []
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamoClient
 */
async function prepareResources (dynamoClient) {
  const [ carTableName ] = await Promise.all([
    createDynamoCarTable(dynamoClient),
  ])

  return {
    carTableName,
  }
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 */
async function createDynamoCarTable(dynamo) {
  const id = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10)
  const tableName = id()

  await dynamo.send(new CreateTableCommand({
    TableName: tableName,
    ...dynamoDBTableConfig(carTableProps),
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1
    }
  }))

  return tableName
}
