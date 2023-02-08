import { Tags } from 'aws-cdk-lib'
import { ApiStack } from './api-stack.js'
import { ConsumerStack } from './consumer-stack.js'
import { DataStack } from './data-stack.js'

/**
 * @param {import('@serverless-stack/resources').App} app
 */
export default function (app) {
  app.setDefaultFunctionProps({
    runtime: 'nodejs16.x',
    environment: {
      NODE_OPTIONS: "--enable-source-maps",
    },
    bundle: {
      format: 'esm',
      sourcemap: true,
    },
  })
  app.stack(ApiStack)
  app.stack(DataStack)
  app.stack(ConsumerStack)

  // tags let us discover all the aws resource costs incurred by this app
  // see: https://docs.sst.dev/advanced/tagging-resources
  Tags.of(app).add('Project', 'w3filecoin')
  Tags.of(app).add('Repository', 'https://github.com/web3-storage/w3filecoin')
  Tags.of(app).add('Environment', `${app.stage}`)
  Tags.of(app).add('ManagedBy', 'SST')
}
