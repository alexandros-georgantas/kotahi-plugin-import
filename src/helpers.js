const Ajv = require('ajv')
const addFormats = require('ajv-formats')

const {
  statuses: {
    ASSERTION_STATUS_UNDER_REVIEW,
    ASSERTION_STATUS_PEER_REVIEWED,
    ASSERTION_STATUS_REVISED,
    OUTPUT_TYPE_PREPRINT,
  },
  labels: { PLUGIN_TAG },
} = require('./constants')

const { schema } = require('./schema')

const validateDataBasedOnSchema = data => {
  const ajv = new Ajv()
  addFormats(ajv)

  const isValidData = ajv.validate(schema, data)

  if (!isValidData) {
    throw new Error(ajv.errors)
  }

  return isValidData
}

const getFirstStepKey = docmap => docmap['first-step']
const getStepByKey = (docmap, stepKey) => docmap.steps[stepKey]
const getDocmapStepIds = docmap => Object.keys(docmap.steps)

const getStepAssertions = (docmap, stepKey) => docmap.steps[stepKey].assertions

const getStepAssertionByStatus = (assertions, status) =>
  assertions.find(assertion => assertion.status === status)

const getStepActions = (docmap, stepKey) => docmap.steps[stepKey].actions

const getStepActionOutputByType = (action, outputType) =>
  action.outputs.find(output => output.type === outputType)

const hasActionOutput = (actions, outputType) => {
  let found = false
  actions.forEach(action => {
    const exists = action.outputs.find(output => output.type === outputType)

    if (exists) {
      found = true
    }
  })
  return found
}

const getDOIfromFirstStepInputs = (docmap, logger) => {
  const firstStepId = getFirstStepKey(docmap)

  const input = docmap.steps[firstStepId].inputs.find(
    i => i.type === OUTPUT_TYPE_PREPRINT,
  )

  if (!input) {
    logger.error(
      `${PLUGIN_TAG} output of type ${OUTPUT_TYPE_PREPRINT} not found in first step`,
    )
  }

  return input.doi
}

const getDOIfromStepInputs = (step, logger) => {
  const { inputs } = step

  const input = inputs.find(i => i.type === OUTPUT_TYPE_PREPRINT)

  if (!input) {
    logger.error(
      `${PLUGIN_TAG} output of type ${OUTPUT_TYPE_PREPRINT} not found in this step`,
    )
  }

  return input.doi
}

const getDocmapIdentifier = step => {
  let foundIdentifier
  const { actions } = step

  actions.forEach(action => {
    const preprintOutputAction = getStepActionOutputByType(
      action,
      OUTPUT_TYPE_PREPRINT,
    )

    if (preprintOutputAction) {
      foundIdentifier = preprintOutputAction.identifier
    }
  })
  return foundIdentifier
}

const docmapsCleaner = (docmaps, lastImportDate) => {
  return docmaps.filter(docmap => {
    const lastImportCriteria =
      lastImportDate === null ||
      new Date(docmap.created) > new Date(lastImportDate)

    const firstStepKey = getFirstStepKey(docmap)
    const assertions = getStepAssertions(docmap, firstStepKey)
    const actions = getStepActions(docmap, firstStepKey)

    const hasUnderReviewAssertion = !!getStepAssertionByStatus(
      assertions,
      ASSERTION_STATUS_UNDER_REVIEW,
    )

    const hasActionOutputPreprint = hasActionOutput(
      actions,
      OUTPUT_TYPE_PREPRINT,
    )

    return (
      lastImportCriteria && hasUnderReviewAssertion && hasActionOutputPreprint
    )
  })
}

const generateURLBasedOnDOI = DOI => `https://doi.org/${DOI}`

const shouldCreateManuscript = async (step, DOI, hasManuscriptWithDoi) => {
  const manuscriptWithDOIExists = await hasManuscriptWithDoi(DOI, true) // TODO: check why the second argument

  if (manuscriptWithDOIExists) {
    return false
  }

  const { assertions, actions } = step

  const stepAssertions = getStepAssertionByStatus(
    assertions,
    ASSERTION_STATUS_UNDER_REVIEW,
  )

  const hasActionOutputPreprint = hasActionOutput(actions, OUTPUT_TYPE_PREPRINT)
  return stepAssertions && hasActionOutputPreprint
}

const shouldExtractReviewsAndDecision = async step => {
  const { assertions } = step

  const peerReviewedAssertion = getStepAssertionByStatus(
    assertions,
    ASSERTION_STATUS_PEER_REVIEWED,
  )

  const revisedAssertion = getStepAssertionByStatus(
    assertions,
    ASSERTION_STATUS_REVISED,
  )

  return peerReviewedAssertion || revisedAssertion
}

const getSubmissionFormTitleType = async submissionFormChildren => {
  const field = submissionFormChildren.find(
    child => child.name === 'submission.$title',
  )

  return field.component === 'TextField' ? field.component : 'other'
}

module.exports = {
  docmapsCleaner,
  generateURLBasedOnDOI,
  getDocmapIdentifier,
  getDocmapStepIds,
  getDOIfromFirstStepInputs,
  getDOIfromStepInputs,
  getStepByKey,
  getSubmissionFormTitleType,
  shouldCreateManuscript,
  shouldExtractReviewsAndDecision,
  validateDataBasedOnSchema,
}
