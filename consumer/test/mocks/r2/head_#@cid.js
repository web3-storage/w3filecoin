/**
 * https://github.com/sinedied/smoke#javascript-mocks
 */
/**
 * @param {any} params
 */
module.exports = async ({ params, headers }) => {
  if(params.cid === 'bag404') {
    return {
      statusCode: 404,
      body: {
        error: 'Not Found'
      },
      // headers can be omitted, only use if you want to customize them
      headers: {
        'Content-Type': 'text/plain'
      } 
    }
  }

  return {
    statusCode: 200,
    headers,
  }
}