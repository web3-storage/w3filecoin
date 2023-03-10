import { GenericContainer as Container } from 'testcontainers'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

/**
 * @param {object} [opts]
 * @param {number} [opts.port]
 * @param {string} [opts.region]
 */
export async function createDynamodDb(opts = {}) {
  const port = opts.port || 8000
  const region = opts.region || 'us-west-2'
  const dbContainer = await new Container('amazon/dynamodb-local:latest')
    .withExposedPorts(port)
    .start()

  const endpoint = `http://${dbContainer.getHost()}:${dbContainer.getMappedPort(8000)}`
  return {
    client: new DynamoDBClient({
      region,
      endpoint
    }),
    endpoint
  }
}

/**
 * Convert SST TableProps to DynamoDB `CreateTableCommandInput` config
 * 
 * @typedef {import('@aws-sdk/client-dynamodb').CreateTableCommandInput} CreateTableCommandInput
 * @typedef {import('@serverless-stack/resources').TableProps} TableProps
 *
 * @param {TableProps} props
 * @returns {Pick<CreateTableCommandInput, 'AttributeDefinitions' | 'KeySchema' | 'GlobalSecondaryIndexes'>}
 */
export function dynamoDBTableConfig ({ fields, primaryIndex, globalIndexes = {} }) {
  if (!primaryIndex || !fields) throw new Error('Expected primaryIndex and fields on TableProps')
  const globalIndexValues = Object.values(globalIndexes)
  const attributes = [
    ...Object.values(primaryIndex),
    ...globalIndexValues.map((value) => value.partitionKey)
  ]

  const AttributeDefinitions = Object.entries(fields)
    .filter(([k]) => attributes.includes(k)) // 'The number of attributes in key schema must match the number of attributes defined in attribute definitions'
    .map(([k, v]) => ({
      AttributeName: k,
      AttributeType: v[0].toUpperCase()
    }))
  const KeySchema = toKeySchema(primaryIndex)
  const GlobalSecondaryIndexes = Object.entries(globalIndexes)
    .map(([IndexName, val]) => ({
      IndexName,
      KeySchema: toKeySchema(val),
      Projection: { ProjectionType: 'KEYS_ONLY' },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }))

  return {
    AttributeDefinitions,
    KeySchema,
    GlobalSecondaryIndexes: GlobalSecondaryIndexes.length ? GlobalSecondaryIndexes : undefined
  }
}
/**
 * @param {object} index
 * @param {string} index.partitionKey
 * @param {string} [index.sortKey]
 */
function toKeySchema ({partitionKey, sortKey}) {
  const KeySchema = [
    { AttributeName: partitionKey, KeyType: 'HASH' }
  ]
  if (sortKey) {
    KeySchema.push(
      { AttributeName: sortKey, KeyType: 'RANGE' }
    )
  }
  return KeySchema
}
