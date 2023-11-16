const axios = require('axios')
const fetch = require('node-fetch')
const { cloneDeep } = require('lodash')

const dataHubApiUsername = 'kotahi-api'
const dataHubApiPassword = 'clsIOaIeamR42iQyLdkK32Lxwv2dtgFz'

// eslint-disable-next-line consistent-return
const getPreprintsDocmapsFromDataHub = async () => {
  const dataHubIndexUrl =
    'https://data-hub-api.elifesciences.org/kotahi/docmaps/v1/index'

  // Encode the username and password in the format "username:password" to base64
  const base64Credentials = btoa(`${dataHubApiUsername}:${dataHubApiPassword}`)

  const requestOptions = {
    method: 'GET',
    headers: {
      Authorization: `Basic ${base64Credentials}`,
    },
  }

  try {
    const response = await fetch(dataHubIndexUrl, requestOptions)

    if (response.ok) {
      const preprintData = await response.json()

      return preprintData.docmaps
    }
  } catch (error) {
    console.error('Error fetching preprint data from datahub:', error)
    throw error
  }
}

const fetchTitleFromCrossref = async doi => {
  const crossrefUrl = `https://api.crossref.org/works/${doi}`

  try {
    const response = await axios.get(crossrefUrl)
    return response.data.message.title?.[0]
  } catch (error) {
    if (error?.response?.status === 404)
      console.error(`DOI ${doi} not found in CrossRef. Skipping.`)
    else console.error('Error fetching title from CrossRef:', error)
    return null
  }
}

const scrapeUrlData = async url => {
  try {
    // Encode the username and password in the format "username:password" to base64
    const base64Credentials = btoa(
      `${dataHubApiUsername}:${dataHubApiPassword}`,
    )

    const requestOptions = {
      method: 'GET',
      headers: {
        Authorization: `Basic ${base64Credentials}`,
      },
    }

    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`)
    }

    const html = await response.text() // Convert response body to text

    return html
  } catch (error) {
    console.error('Error:', error)
    return ''
  }
}

const processStepActions = async (
  step,
  versions,
  hasManuscriptWithDoi,
  identifier,
  status,
) => {
  const { doi, url, versionIdentifier } = step.inputs[0]

  if (await hasManuscriptWithDoi(doi, true)) {
    return // Skip if DOI already exists
  }

  const reviews = (
    await Promise.all(
      step.actions.map(async action => {
        return Promise.all(
          action.outputs.map(async output => {
            if (
              output.type === 'review-article' ||
              output.type === 'evaluation-summary'
            ) {
              // eslint-disable-next-line no-await-in-loop
              const reviewComment = await scrapeUrlData(output.content[0].url)

              return {
                jsonData: {
                  comment: reviewComment,
                },
                isDecision: output.type === 'evaluation-summary',
              }
            }

            return []
          }),
        )
      }),
    )
  ).flat()

  const title = await fetchTitleFromCrossref(doi)

  if (title) {
    const version = {
      identifier,
      title,
      doi,
      link: url ?? null,
      // eslint-disable-next-line radix
      versionIdentifier: parseInt(versionIdentifier),
      reviews,
    }

    if (status === 'revising') {
      version.status = 'revising'
    }

    versions.push(version)
  }
}

const prepareRelevantPreprints = async (
  dataHubDocmaps,
  hasManuscriptWithDoi,
  lastImportDate,
) => {
  const resultArray = []

  // eslint-disable-next-line no-restricted-syntax
  for (const docmap of dataHubDocmaps) {
    if (
      lastImportDate === null ||
      new Date(docmap.created) > new Date(lastImportDate)
    ) {
      if (docmap.steps) {
        const versions = []
        const firstStep = docmap.steps[docmap['first-step']]

        const { identifier } = firstStep.actions[0].outputs[0]

        // Iterate over the steps
        // eslint-disable-next-line no-restricted-syntax
        for (const step of Object.values(docmap.steps)) {
          if (step.assertions) {
            // Find the "peer-reviewed" assertion
            const peerReviewedAssertion = step.assertions.find(
              assertion => assertion.status === 'peer-reviewed',
            )

            if (peerReviewedAssertion) {
              // eslint-disable-next-line no-await-in-loop
              await processStepActions(
                step,
                versions,
                hasManuscriptWithDoi,
                identifier,
              )
            } else {
              // Find "revised" assertions
              const revisedAssertions = step.assertions.filter(
                assertion => assertion.status === 'revised',
              )

              if (revisedAssertions.length > 0) {
                // eslint-disable-next-line no-restricted-syntax, no-unused-vars
                for (const revisedAssertion of revisedAssertions) {
                  // eslint-disable-next-line no-await-in-loop
                  await processStepActions(
                    step,
                    versions,
                    hasManuscriptWithDoi,
                    identifier,
                    'revising',
                  )
                }
              }
            }
          }
        }

        if (versions.length > 0) {
          resultArray.push(versions)
        }
      }
    }
  }

  return resultArray
}

const getSubmissionFormTitleType = async submissionFormChildren => {
  const field = submissionFormChildren.find(
    child => child.name === 'meta.title',
  )

  return field.component === 'TextField' ? field.component : 'other'
}

const doImport = (
  getStubManuscriptObject,
  hasManuscriptWithDoi,
  getSubmissionForm,
) => async ({ urisAlreadyImporting, doisAlreadyImporting, lastImportDate }) => {
  const dataHubDocmaps = await getPreprintsDocmapsFromDataHub()

  const relevantPreprints = await prepareRelevantPreprints(
    dataHubDocmaps,
    hasManuscriptWithDoi,
    lastImportDate,
  )

  const submissionForm = await getSubmissionForm()

  // If title is TextField type, strip the HTML tags
  const submissionFormTitleType = await getSubmissionFormTitleType(
    submissionForm.structure.children,
  )

  const stub = await getStubManuscriptObject()

  // Iterate over the relevantPreprints array
  const result = []

  // eslint-disable-next-line no-restricted-syntax
  for (const versionsArray of relevantPreprints) {
    if (versionsArray.length === 1) {
      // Treat a single JSON object as a separate manuscript
      const version = versionsArray[0]

      const stubSubmission = {
        articleId: version.identifier,
        doi: version.doi,
        link: version?.link,
        abstract: '',
      }

      const stubMeta = {
        title:
          submissionFormTitleType === 'TextField'
            ? version.title?.replace(/<[^>]*>/g, '')
            : version.title,
      }

      const stubManuscript = {
        ...cloneDeep(stub),
        isImported: true,
        reviews: version.reviews,
        submission: {
          ...cloneDeep(stubSubmission),
        },
        meta: {
          ...cloneDeep(stubMeta),
        },
        // eslint-disable-next-line radix
        shortId: parseInt(version.identifier),
        doi: version.doi,
      }

      result.push(stubManuscript)
    } else {
      // Treat multiple JSON objects as an array of multiple versions
      const versions = []

      // eslint-disable-next-line no-restricted-syntax
      for (const version of versionsArray) {
        const stubSubmission = {
          articleId: version.identifier,
          title:
            submissionFormTitleType === 'TextField'
              ? version.title?.replace(/<[^>]*>/g, '')
              : version.title,
          doi: version.doi,
          link: version?.link,
          abstract: '',
        }

        const stubMeta = {
          title:
            submissionFormTitleType === 'TextField'
              ? version.title?.replace(/<[^>]*>/g, '')
              : version.title,
        }

        versions.push({
          ...cloneDeep(stub),
          isImported: true,
          reviews: version.reviews,
          submission: {
            ...cloneDeep(stubSubmission),
          },
          meta: {
            ...cloneDeep(stubMeta),
          },
          // eslint-disable-next-line radix
          shortId: parseInt(version.identifier),
          doi: version.doi,
        })
      }

      result.push(versions)
    }
  }

  return result
}

module.exports = doImport
