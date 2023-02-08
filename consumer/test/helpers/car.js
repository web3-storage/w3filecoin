import { randomCAR } from '../helpers/random.js'

/**
 * @param {number} length
 */
export async function getCars (length) {
  return (await Promise.all(Array.from({ length }).map(() => randomCAR(128))))
    .map((car) => ({
      link: car.cid.toString(),
      size: car.size
    }))
}
