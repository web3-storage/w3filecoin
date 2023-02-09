import anyTest from 'ava'


/**
 * @typedef {object} CarContext
 * @property {string} dbEndpoint
 * @property {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamoClient
 *
 * @typedef {import('ava').TestFn<Awaited<CarContext>>} TestCarFn
 * @typedef {import('ava').TestFn<Awaited<any>>} TestAnyFn
 */

// eslint-disable-next-line unicorn/prefer-export-from
export const test  = /** @type {TestAnyFn} */ (anyTest)

// eslint-disable-next-line unicorn/prefer-export-from
export const carTest  = /** @type {TestCarFn} */ (anyTest)
