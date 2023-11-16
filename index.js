const doImport = require('./import')

const pluginEntry = async broker => {
  await broker.addManuscriptImporter(
    'any', // 'manual', 'automatic' or 'any'
    doImport(
      broker.getStubManuscriptObject,
      broker.hasManuscriptWithDoi,
      broker.getSubmissionForm,
    ),
  )
}

module.exports = pluginEntry
