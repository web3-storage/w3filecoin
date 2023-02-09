import pSettle from 'p-settle'

import { createCarTable } from '@w3filecoin/data/tables/car.js'

/**
 * @typedef {object} CarTableProps
 * @property {string} region
 * @property {string} tableName
 * @property {import('@w3filecoin/data/types').CarOpts} [options]
 */

/**
 * Register cars pending to be loaded into a ferry.
 * Keep track of fulfilled and rejected for retries.
 *
 * @param {import('../types').SqsCarEvent[]} cars
 * @param {CarTableProps} carTableProps
 */
export async function registerCars (cars, carTableProps) {
  const carTable = createCarTable(carTableProps.region, carTableProps.tableName, carTableProps.options)
  const itemsSettled = await pSettle(
    cars.map((car) => getCarItem(car.detail))
  )
  const fulfilledEvents = []
  const rejectedEvents = []
  const carsToWrite = []

  for (const [index, item] of itemsSettled.entries()) {
    if (item.isFulfilled) {
      carsToWrite.push(item.value)
      fulfilledEvents.push(cars[index])
    } else {
      rejectedEvents.push(cars[index])
    }
  }
  
  await carTable.batchWrite(carsToWrite)

  return {
    fulfilledEvents,
    rejectedEvents
  }
}

/**
 * Get needed metadata of a CAR to register it into ferry waiting list.
 *
 * @param {import('../types').CarEventDetail} car
 */
export async function getCarItem(car) {
  const link = car.key.split('/').at(-1)?.replace(/\.[^./]+$/, '')

  if (!link) {
    throw new Error(`unexpected car key received: ${car.key}`)
  }

  // Get car metadata and validate URL is valid
  const carItemHeadResponse = await fetch(car.url, {
    method: 'HEAD'
  })

  if (!carItemHeadResponse.ok) {
    throw new Error(`car ${car.key} not available on ${car.url}`)
  }

  return {
    link,
    url: car.url,
    size: Number(carItemHeadResponse.headers.get('content-length')),
    // md5 in base 16 like reported by R2/S3
    md5: carItemHeadResponse.headers.get('etag') || '',
    // TODO = get information from commP
    // This likely will need request to w3infra store table
    // if we go that wat, we can 
    commP: 'commP',
  }
}