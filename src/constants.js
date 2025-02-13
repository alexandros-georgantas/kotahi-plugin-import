const PLUGIN_NAME = 'IMPORT_DOCMAPS_FROM_DATA_HUB'
const ASSERTION_STATUS_UNDER_REVIEW = 'under-review'
const ASSERTION_STATUS_DRAFT = 'draft'
const ASSERTION_STATUS_PEER_REVIEWED = 'peer-reviewed'
const ASSERTION_STATUS_REVISED = 'revised'
const OUTPUT_TYPE_EVALUATION_SUMMARY = 'evaluation-summary'
const OUTPUT_TYPE_REVIEW_ARTICLE = 'review-article'
const OUTPUT_TYPE_PREPRINT = 'preprint'

module.exports = {
  labels: {
    PLUGIN_TAG: `[PLUGIN: ${PLUGIN_NAME}] -`,
  },
  statuses: {
    ASSERTION_STATUS_UNDER_REVIEW,
    ASSERTION_STATUS_DRAFT,
    ASSERTION_STATUS_PEER_REVIEWED,
    ASSERTION_STATUS_REVISED,
    OUTPUT_TYPE_EVALUATION_SUMMARY,
    OUTPUT_TYPE_REVIEW_ARTICLE,
    OUTPUT_TYPE_PREPRINT,
  },
}
