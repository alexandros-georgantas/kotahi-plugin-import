const axios = require('axios')
const config = require('config')

const {
  labels: { PLUGIN_TAG },
} = require('./constants')

const { validateDataBasedOnSchema } = require('./helpers')

const makeAuthenticatedCallToDataHub = async URL => {
  try {
    if (!URL) {
      throw new Error(`${PLUGIN_TAG} url argument is undefined`)
    }

    const dataHubUsername =
      config.has('import-from-docmaps.dataHubUsername') &&
      config.get('import-from-docmaps.dataHubUsername')

    if (!dataHubUsername) {
      throw new Error(`${PLUGIN_TAG} DataHub credentials:username is undefined`)
    }

    const dataHubPassword =
      config.has('import-from-docmaps.dataHubPassword') &&
      config.get('import-from-docmaps.dataHubPassword')

    if (!dataHubPassword) {
      throw new Error(`${PLUGIN_TAG} DataHub credentials:password is undefined`)
    }

    const { data } = await axios.get(URL, {
      auth: {
        username: dataHubUsername,
        password: dataHubPassword,
      },
    })

    if (!data) {
      throw new Error(
        `${PLUGIN_TAG} request to ${URL} returned without any data`,
      )
    }

    return data
  } catch (e) {
    const { response } = e

    if (response) {
      const { status } = response

      if (status === 401) {
        throw new Error(
          `${PLUGIN_TAG} unauthorized resource requested from ${URL}.`,
        )
      }

      if (status === 404) {
        throw new Error(
          `${PLUGIN_TAG} resource requested from ${URL} not found.`,
        )
      }

      if (status >= 500) {
        throw new Error(
          `${PLUGIN_TAG} request to ${URL} failed as server is unreachable.`,
        )
      }
    }

    throw e
  }
}

const getInfoFromCrossrefInBulk = async (dois, logger) => {
  const crossrefURL =
    config.has('import-from-docmaps.crossrefURL') &&
    config.get('import-from-docmaps.crossrefURL')

  try {
    if (!crossrefURL) {
      throw new Error(`${PLUGIN_TAG} Crossref URL is undefined`)
    }

    if (!dois || dois.length < 1) {
      throw new Error(
        `${PLUGIN_TAG} DOIs provided as param is undefined or empty`,
      )
    }

    const { data } = await axios.get(`${crossrefURL}/?filter=${dois}&rows=100`)

    if (!data) {
      logger.error(
        `${PLUGIN_TAG} request to ${crossrefURL} returned without any data`,
      )
    }

    const {
      message: { items },
    } = data

    return items
  } catch (e) {
    const { response } = e

    if (!response) {
      logger.error(`${PLUGIN_TAG} ${e.message}`)
    } else {
      const { status } = response

      if (status === 401) {
        logger.error(
          `${PLUGIN_TAG} unauthorized resource requested to ${crossrefURL} for DOIs ${dois}.`,
        )
      }

      if (status === 404) {
        logger.error(
          `${PLUGIN_TAG} DOIs ${dois} requested from ${crossrefURL} not found.`,
        )
      }

      if (status === 429) {
        logger.error(
          `${PLUGIN_TAG} call to Crossref's API returned too many requests`,
        )
      }

      if (status >= 500) {
        logger.error(
          `${PLUGIN_TAG} request to ${crossrefURL} failed as server is unreachable.`,
        )
      }
    }

    return {}
  }
}

const getDocMapsFromDataHub = async logger => {
  const dataHubIndexURL =
    config.has('import-from-docmaps.dataHubURL') &&
    config.get('import-from-docmaps.dataHubURL')

  if (!dataHubIndexURL) {
    throw new Error(`${PLUGIN_TAG} DataHub index URL is undefined`)
  }

  const response = await makeAuthenticatedCallToDataHub(dataHubIndexURL, logger)

  logger.info(`${PLUGIN_TAG} verifying validity of fetched data`)
  validateDataBasedOnSchema(response)
  logger.info(`${PLUGIN_TAG} verifying validity done`)

  const { docmaps } = response

  return docmaps
}

const scrapeDataFromURL = async (url, logger) => {
  try {
    return makeAuthenticatedCallToDataHub(url, logger)
  } catch (e) {
    logger.error(`${PLUGIN_TAG} ${e.message}`)
    return ''
  }
}

module.exports = {
  getInfoFromCrossrefInBulk,
  getDocMapsFromDataHub,
  scrapeDataFromURL,
}
