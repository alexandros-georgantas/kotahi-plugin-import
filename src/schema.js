const participantItem = {
  type: 'object',
  additionalProperties: false,
  required: ['role'],
  properties: {
    actor: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['person'] },
        name: { type: 'string' },
        firstName: { type: 'string' },
        surname: { type: 'string' },
        _relatesToOrganization: { type: 'string' },
        affiliation: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string' },
          },
        },
      },
    },
    role: {
      type: 'string',
      enum: ['editor', 'senior-editor', 'peer-reviewer'],
    },
  },
}

const contentItem = {
  type: 'object',
  additionalProperties: false,
  required: ['url'],
  properties: {
    type: { type: 'string', enum: ['web-page'] },
    url: { type: 'string', format: 'uri-reference' },
  },
}

const outputItem = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: ['preprint', 'evaluation-summary', 'review-article'],
    },
    identifier: {
      type: 'string',
    },
    doi: {
      type: 'string',
    },
    versionIdentifier: {
      type: 'string',
    },
    license: { type: 'string', format: 'uri-reference' },
    content: {
      type: 'array',
      items: contentItem,
    },
  },
}

const actionItem = {
  type: 'object',
  additionalProperties: false,
  required: ['participants', 'outputs'],
  properties: {
    participants: {
      type: 'array',
      items: participantItem,
    },
    outputs: {
      type: 'array',
      items: outputItem,
    },
  },
}

const assertionItem = {
  type: 'object',
  additionalProperties: false,
  required: ['item', 'status'],
  properties: {
    item: {
      type: 'object',
      required: ['type', 'doi'],
      properties: {
        type: {
          type: 'string',
          enum: ['preprint'],
        },
        doi: {
          type: 'string',
        },
      },
    },
    status: {
      type: 'string',
      enum: ['under-review', 'draft', 'peer-reviewed', 'revised'],
    },
    happened: {
      type: 'string',
      format: 'date-time',
    },
  },
}

const inputItem = {
  type: 'object',
  required: ['type', 'doi'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['preprint'],
    },
    doi: {
      type: 'string',
    },
  },
}

const stepObject = {
  type: 'object',
  additionalProperties: false,
  required: ['actions', 'assertions', 'inputs'],
  properties: {
    actions: {
      type: 'array',
      items: actionItem,
    },
    assertions: {
      type: 'array',
      items: assertionItem,
    },
    inputs: {
      type: 'array',
      items: inputItem,
    },
    'next-step': {
      type: 'string',
    },
    'previous-step': {
      type: 'string',
    },
  },
}

const docmapItem = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'created', 'first-step', 'steps'],
  properties: {
    '@context': { type: 'string', format: 'uri-reference' },
    type: {
      type: 'string',
      enum: ['docmap'],
    },
    id: {
      type: 'string',
    },
    created: {
      type: 'string',
      format: 'date-time',
    },
    updated: {
      type: 'string',
      format: 'date-time',
    },
    publisher: {
      type: 'object',
      properties: {
        account: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uri-reference' },
            service: { type: 'string', format: 'uri-reference' },
          },
        },
        homepage: { type: 'string', format: 'uri-reference' },
        id: { type: 'string', format: 'uri-reference' },
        logo: { type: 'string', format: 'uri-reference' },
        name: {
          type: 'string',
        },
      },
    },
    'first-step': {
      type: 'string',
    },
    steps: {
      type: 'object',
      properties: {
        '_:b0': stepObject,
        '_:b1': stepObject,
        '_:b2': stepObject,
        '_:b3': stepObject,
      },
    },
  },
}

const docmaps = {
  type: 'array',
  items: docmapItem,
}

const schema = {
  type: 'object',
  properties: {
    docmaps,
  },
}

module.exports = { schema }
