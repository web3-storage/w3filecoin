import { BatchWriteItemCommand, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

/**
 * @param {{ region?: string; ferryDynamo: any; carDynamo: any; cargoDynamo: any; }} context
 */
export async function deleteAll (context) {
  const { carDynamo, ferryDynamo, cargoDynamo } = context

  // Delete Car Table
  await deleteCarTableRows(carDynamo.client, carDynamo.tableName, 
    await getTableRows(carDynamo.client, carDynamo.tableName)
  )

  // Delete Ferry Table
  await deleteFerryTableRows(ferryDynamo.client, ferryDynamo.tableName, 
    await getTableRows(ferryDynamo.client, ferryDynamo.tableName)
  )

  // Delete Cargo Table
  await deleteCargoTableRows(cargoDynamo.client, cargoDynamo.tableName, 
    await getTableRows(cargoDynamo.client, cargoDynamo.tableName)
  )
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {object} [options]
 * @param {number} [options.limit]
 */
export async function getTableRows (dynamo, tableName, options = {}) {
  const cmd = new ScanCommand({
    TableName: tableName,
    Limit: options.limit || 1000
  })

  const response = await dynamo.send(cmd)
  return response.Items?.map(i => unmarshall(i)) || []
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {string} link
 */
export async function getTableItem (dynamo, tableName, link) {
  const cmd = new GetItemCommand({
    TableName: tableName,
    Key: marshall({
      link
    })
  })

  const response = await dynamo.send(cmd)
  if (!response.Item) {
    return
  }

  return unmarshall(response.Item)
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {Record<string, any>[]} rows
 */
async function deleteCarTableRows (dynamo, tableName, rows) {
  const deleteRows = [...rows]

  while (deleteRows.length) {
    const requests = deleteRows.splice(0, 25).map(row => ({
      DeleteRequest: {
        Key: marshall({ link: row.link })
      }
    }))
    const cmd = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: requests
      }
    })

    await dynamo.send(cmd)
  }
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {Record<string, any>[]} rows
 */
async function deleteFerryTableRows (dynamo, tableName, rows) {
  const deleteRows = [...rows]

  while (deleteRows.length) {
    const requests = deleteRows.splice(0, 25).map(row => ({
      DeleteRequest: {
        Key: marshall({ id: row.id })
      }
    }))
    const cmd = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: requests
      }
    })

    await dynamo.send(cmd)
  }
}

/**
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamo
 * @param {string} tableName
 * @param {Record<string, any>[]} rows
 */
async function deleteCargoTableRows (dynamo, tableName, rows) {
  const deleteRows = [...rows]

  while (deleteRows.length) {
    const requests = deleteRows.splice(0, 25).map(row => ({
      DeleteRequest: {
        Key: marshall({
          ferryId: row.ferryId,
          link: row.link
        })
      }
    }))
    const cmd = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: requests
      }
    })

    await dynamo.send(cmd)
  }
}
