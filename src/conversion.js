const chunk = require('lodash/chunk')
const { scrapeDataFromURL, getInfoFromCrossrefInBulk } = require('./network')

const {
  statuses: { OUTPUT_TYPE_EVALUATION_SUMMARY, OUTPUT_TYPE_REVIEW_ARTICLE },
  labels: { PLUGIN_TAG },
} = require('./constants')

const {
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
} = require('./helpers')

const createManuscript = (
  identifier,
  DOI,
  manuscriptBlueprint,
  submissionFormTitleType,
  crossrefDictionary,
  logger,
) => {
  const newManuscript = JSON.parse(JSON.stringify(manuscriptBlueprint))

  newManuscript.shortId = parseInt(identifier, 10)
  newManuscript.doi = generateURLBasedOnDOI(DOI)
  newManuscript.submission.articleId = identifier
  newManuscript.isImported = true
  newManuscript.submission.$doi = generateURLBasedOnDOI(DOI)

  newManuscript.submission.$sourceUri = crossrefDictionary[DOI]?.link

  newManuscript.submission.$title =
    submissionFormTitleType === 'TextField'
      ? crossrefDictionary[DOI]?.title?.replace(/<[^>]*>/g, '') || ''
      : crossrefDictionary[DOI]?.title || ''
  logger.info(
    `${PLUGIN_TAG} creating manuscript with DOI ${DOI} and identifier ${identifier}`,
  )
  return newManuscript
}

const extractReviewsAndDecision = async (
  currentStep,
  manuscriptsFromDocmap,
  logger,
) => {
  return Promise.all(
    currentStep.actions.map(async action => {
      return Promise.all(
        action.outputs.map(async output => {
          if (
            output.type === OUTPUT_TYPE_REVIEW_ARTICLE ||
            output.type === OUTPUT_TYPE_EVALUATION_SUMMARY
          ) {
            const reviewComment = await scrapeDataFromURL(
              output.content[0].url,
              logger,
            )

            const findRelevantManuscript = manuscriptsFromDocmap.find(
              manuscript =>
                manuscript.createdOnStepId === currentStep['previous-step'],
            )

            findRelevantManuscript.reviews.push({
              jsonData: {
                comment: reviewComment,
              },
              isDecision: output.type === OUTPUT_TYPE_EVALUATION_SUMMARY,
            })
          }
        }),
      )
    }),
  )
}

const processStep = async (
  stepId,
  currentStep,
  manuscriptBlueprint,
  manuscriptsFromDocmap,
  submissionFormTitleType,
  hasManuscriptWithDoi,
  crossrefDictionary,
  logger,
) => {
  const DOI = getDOIfromStepInputs(currentStep, logger)
  const identifier = getDocmapIdentifier(currentStep)

  const shouldCreateManuscriptOutcome = await shouldCreateManuscript(
    currentStep,
    DOI,
    hasManuscriptWithDoi,
  )

  const shouldExtractReviewsAndDecisionOutcome =
    await shouldExtractReviewsAndDecision(currentStep)

  if (shouldCreateManuscriptOutcome) {
    logger.info(`${PLUGIN_TAG} creating manuscript version of given preprint`)

    const newManuscript = await createManuscript(
      identifier,
      DOI,
      manuscriptBlueprint,
      submissionFormTitleType,
      crossrefDictionary,
      logger,
    )

    newManuscript.createdOnStepId = stepId
    manuscriptsFromDocmap.push(newManuscript)
  }

  if (shouldExtractReviewsAndDecisionOutcome) {
    logger.info(
      `${PLUGIN_TAG} extracting reviews and decision of given preprint`,
    )
    await extractReviewsAndDecision(currentStep, manuscriptsFromDocmap, logger)
  }
}

const processDocmap = async (
  docmap,
  crossrefDictionary,
  manuscriptBlueprint,
  submissionFormTitleType,
  hasManuscriptWithDoi,
  logger,
) => {
  const manuscriptsFromDocmap = []
  const docmapSteps = getDocmapStepIds(docmap)
  logger.info(`${PLUGIN_TAG} start processing of docmap's step`)
  await Promise.all(
    docmapSteps.map(async stepId => {
      const currentStep = getStepByKey(docmap, stepId)
      return processStep(
        stepId,
        currentStep,
        manuscriptBlueprint,
        manuscriptsFromDocmap,
        submissionFormTitleType,
        hasManuscriptWithDoi,
        crossrefDictionary,
        logger,
      )
    }),
  )

  /* eslint-disable no-param-reassign */
  manuscriptsFromDocmap.forEach(manuscript => delete manuscript.createdOnStepId)
  /* eslint-enable no-param-reassign */

  if (manuscriptsFromDocmap.length === 1) {
    return manuscriptsFromDocmap[0]
  }

  return manuscriptsFromDocmap
}

const generateCrossrefDictionary = async (docmaps, logger) => {
  const res = {}
  const filterArguments = []

  docmaps.forEach(docmap => {
    const DOI = getDOIfromFirstStepInputs(docmap, logger)
    filterArguments.push(`doi:${DOI}`)
  })

  const chunks = chunk(filterArguments, 100)

  await Promise.all(
    chunks.map(async partition => {
      let filterValues = ''

      partition.forEach(item => {
        filterValues += `${item},`
      })

      const crossRefs = await getInfoFromCrossrefInBulk(
        filterValues.replace(/.$/, ''),
        logger,
      )

      crossRefs.forEach(crossref => {
        const { DOI, title, resource } = crossref

        const {
          primary: { URL },
        } = resource

        res[DOI] = { title: title[0], link: URL }
      })
    }),
  )

  return res
}

const processDocmaps = async (
  docmaps,
  submissionForm,
  manuscriptBlueprint,
  hasManuscriptWithDoi,
  lastImportDate,
  logger,
) => {
  // TODO: If title is TextField type, strip the HTML tags (WHY??)
  logger.info(
    `${PLUGIN_TAG} retrieving title type based on configured submission form`,
  )

  const submissionFormTitleType = await getSubmissionFormTitleType(
    submissionForm.structure.children,
  )

  logger.info(
    `${PLUGIN_TAG} start docmaps clean-up by removing drafts and already imported`,
  )

  const docmapsCleanFromDraftsAndAlreadyImported = docmapsCleaner(
    docmaps,
    lastImportDate,
  )

  logger.info(
    `${PLUGIN_TAG} building dictionary of Crossref info for the acquired preprints`,
  )

  const crossRefDictionary = await generateCrossrefDictionary(
    docmapsCleanFromDraftsAndAlreadyImported,
  )

  return Promise.all(
    docmapsCleanFromDraftsAndAlreadyImported.map(async docmap => {
      return processDocmap(
        docmap,
        crossRefDictionary,
        manuscriptBlueprint,
        submissionFormTitleType,
        hasManuscriptWithDoi,
        logger,
      )
    }),
  )
}

module.exports = processDocmaps