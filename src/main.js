const { getDocMapsFromDataHub } = require('./network')

const processDocmaps = require('./conversion')

const {
  labels: { PLUGIN_TAG },
} = require('./constants')

const doImport =
  (getStubManuscriptObject, hasManuscriptWithDoi, getSubmissionForm, logger) =>
  async ({ lastImportDate }) => {
    logger.info(`${PLUGIN_TAG} retrieving data from Data Hub`)
    const retrievedDocMaps = await getDocMapsFromDataHub(logger)

    logger.info(`${PLUGIN_TAG} gathering configured submission form info`)
    const submissionForm = await getSubmissionForm()

    logger.info(`${PLUGIN_TAG} getting manuscript's blueprint`)
    const manuscriptBlueprint = await getStubManuscriptObject()

    logger.info(`${PLUGIN_TAG} start processing docmaps`)
    return processDocmaps(
      retrievedDocMaps,
      submissionForm,
      manuscriptBlueprint,
      hasManuscriptWithDoi,
      lastImportDate,
      logger,
    )
  }

module.exports = doImport
