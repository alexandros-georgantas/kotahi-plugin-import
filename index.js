const doImport = require('./src/main')

const pluginEntry = async broker => {
  const { logger } = broker
  await broker.addManuscriptImporter(
    'any', // 'manual', 'automatic' or 'any'
    doImport(
      broker.getStubManuscriptObject,
      broker.hasManuscriptWithDoi,
      broker.getSubmissionForm,
      logger,
    ),
  )
}

module.exports = pluginEntry
