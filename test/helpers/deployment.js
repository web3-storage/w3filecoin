import {
  State
} from '@serverless-stack/core'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { createRequire } from 'module'

// Either seed.run deployment, or development deploy outputs-file
// https://seed.run/docs/adding-a-post-deploy-phase.html#post-deploy-phase-environment
export const stage = process.env.SEED_STAGE_NAME || State.getStage(process.cwd())

export const getStackName = () => {
  const require = createRequire(import.meta.url)
  const sst = require('../../sst.json')
  return `${stage}-${sst.name}`
}

export const getAwsRegion = () => {
  // CI/CD deployment
  if (process.env.SEED_APP_NAME) {
    return 'us-east-2'
  }

  return 'us-west-2'
}

/**
 * @param {string} tableName 
 */
export const getDynamoDb = (tableName) => {
  const region = getAwsRegion()
  const endpoint = `https://dynamodb.${region}.amazonaws.com`

  return {
    client: new DynamoDBClient({
      region,
      endpoint
    }),
    tableName: `${getStackName()}-${tableName}`,
    region,
    endpoint
  }
}

export const getUploadApiEndpoint = () => {
  // CI/CD deployment
  return `https://staging.up.web3.storage`
}
