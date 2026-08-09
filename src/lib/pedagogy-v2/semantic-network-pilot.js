import { renderLexiconRelation } from './semantic-lexicon.js'

const STAGES = ['A1', 'A1-A2', 'A2', 'A2-B1', 'B1', 'B1-B2', 'B2']
const COUNTABILITY = new Set(['count', 'mass', 'count_or_mass'])

export class SemanticNetworkError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}:${detail}` : code)
    this.name = 'SemanticNetworkError'
    this.code = code
    this.detail = detail
  }
}

function fail(code, detail = '') {
  throw new SemanticNetworkError(code, detail)
}

function stageIndex(stage) {
  return STAGES.indexOf(stage)
}

function maxStage(stages) {
  let winner = 'A1'
  for (const stage of stages.filter(Boolean)) {
    if (stageIndex(stage) < 0) fail('SEMANTIC_STAGE_INVALID', stage)
    if (stageIndex(stage) > stageIndex(winner)) winner = stage
  }
  return winner
}

function hasAll(values, required = []) {
  const set = new Set(values || [])
  return required.every((value) => set.has(value))
}

function deepHasKey(value, key) {
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.hasOwnProperty.call(value, key)) return true
  return Object.values(value).some((child) => deepHasKey(child, key))
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]))
}

function signature(value) {
  return JSON.stringify(stableObject(value))
}

function indexUnits(lexicon) {
  return new Map((lexicon?.units || []).map((unit) => [unit.unit_id, unit]))
}

function articleFor(unit, determiner, language) {
  if (determiner === 'bare') return ''
  if (determiner === 'some') {
    if (language === 'en') return 'some '
    return unit.pt_gender === 'f' ? 'alguma ' : 'algum '
  }
  if (determiner === 'definite') {
    if (language === 'en') return 'the '
    return unit.pt_gender === 'f' ? 'a ' : 'o '
  }
  if (determiner === 'indefinite') {
    if (unit.countability === 'mass') fail('ENTITY_COUNTABILITY_CONFLICT', `${unit.unit_id}:indefinite`)
    if (language === 'pt') return unit.pt_gender === 'f' ? 'uma ' : 'um '
    return /^[aeiou]/i.test(unit.en) ? 'an ' : 'a '
  }
  fail('ENTITY_DETERMINER_INVALID', determiner)
}

export function renderSemanticEntity(unit, { determiner = 'definite' } = {}) {
  if (!unit) fail('SEMANTIC_ENTITY_REQUIRED')
  if (!COUNTABILITY.has(unit.countability)) fail('ENTITY_COUNTABILITY_INVALID', unit.unit_id)
  return {
    unit_id: unit.unit_id,
    en: `${articleFor(unit, determiner, 'en')}${unit.en}`,
    pt: `${articleFor(unit, determiner, 'pt')}${unit.pt}`,
    roles: [...(unit.roles || [])],
    lexical_stage: unit.lexical_stage,
    countability: unit.countability,
  }
}

function renderPlaceNoun(unit, { determiner = 'definite' } = {}) {
  const synthetic = { ...unit, countability: 'count' }
  return renderSemanticEntity(synthetic, { determiner })
}

function contractPrepositionPt(preposition, surface, gender) {
  if (preposition !== 'por') return `${preposition} ${surface}`
  if (surface.startsWith('o ')) return `pelo ${surface.slice(2)}`
  if (surface.startsWith('a ')) return `pela ${surface.slice(2)}`
  return `${gender === 'f' ? 'pela' : 'pelo'} ${surface}`
}

function normalizeFeatureContract(frame, fixedFeatures = {}, requestedFeatures = {}) {
  const fixed = { ...(frame.fixed_features || {}) }
  for (const [key, value] of Object.entries(fixedFeatures || {})) {
    if (key in fixed && fixed[key] !== value) {
      fail('PROPOSITION_FEATURE_CONFLICT', `${key}:${fixed[key]}!=${value}`)
    }
    fixed[key] = value
  }

  const negotiated = {}
  for (const [key, value] of Object.entries(requestedFeatures || {})) {
    if (key in fixed) {
      if (fixed[key] !== value) fail('PROPOSITION_FEATURE_CONFLICT', `${key}:${fixed[key]}!=${value}`)
      continue
    }
    if (!(frame.negotiable_features || []).includes(key)) {
      fail('PROPOSITION_FEATURE_CONFLICT', `${key}:not_negotiable`)
    }
    negotiated[key] = value
  }

  return {
    fixed_features: fixed,
    negotiable_features: [...(frame.negotiable_features || [])],
    resolved_features: {
      tense: 'simple_present',
      polarity: 'affirmative',
      person: 'first',
      number: 'singular',
      ...fixed,
      ...negotiated,
    },
  }
}

function findVerb(verbs, verbId) {
  const verb = indexUnits(verbs).get(verbId)
  if (!verb) fail('VERB_NOT_FOUND', verbId)
  return verb
}

function findSense(verb, senseId) {
  const sense = (verb.senses || []).find((row) => row.sense_id === senseId)
  if (!sense) fail('VERB_SENSE_NOT_FOUND', `${verb.unit_id}:${senseId}`)
  return sense
}

function findFrame(sense, frameId) {
  const frame = (sense.argument_frames || []).find((row) => row.frame_id === frameId)
  if (!frame) fail('ARGUMENT_FRAME_NOT_FOUND', `${sense.sense_id}:${frameId}`)
  return frame
}

function resolveUnit(source, unitId, { entities, places }) {
  const lexicon = source === 'entities' ? entities : source === 'places' ? places : null
  if (!lexicon) fail('ARGUMENT_SOURCE_INVALID', source)
  const unit = indexUnits(lexicon).get(unitId)
  if (!unit) fail('ARGUMENT_UNIT_NOT_FOUND', `${source}:${unitId}`)
  return unit
}

function validateArgument(frameSpec, arg, context) {
  if (!arg) fail('ARGUMENT_REQUIRED', frameSpec.slot)
  if (!(frameSpec.entity_sources || []).includes(arg.source)) {
    fail('ARGUMENT_SOURCE_MISMATCH', `${frameSpec.slot}:${arg.source}`)
  }
  const unit = resolveUnit(arg.source, arg.unit_id, context)
  if (!hasAll(unit.roles, frameSpec.require_roles || [])) {
    fail('SEMANTIC_ROLE_MISMATCH', `${frameSpec.slot}:${unit.unit_id}`)
  }
  return unit
}

function renderComplement(frameSpec, arg, unit, context) {
  const determiner = arg.determiner || frameSpec.determiner || 'definite'
  if (frameSpec.syntactic_type === 'place_relation') {
    if (arg.source !== 'places') fail('ARGUMENT_SOURCE_MISMATCH', `${frameSpec.slot}:${arg.source}`)
    const relation = arg.relation || frameSpec.relation
    if (!relation) fail('PLACE_RELATION_REQUIRED', frameSpec.slot)
    const rendered = renderLexiconRelation(context.places, unit, relation)
    return { en: rendered.en, pt: rendered.pt, unit_id: unit.unit_id, lexical_stage: unit.lexical_stage }
  }

  const rendered = arg.source === 'places'
    ? renderPlaceNoun(unit, { determiner })
    : renderSemanticEntity(unit, { determiner })

  if (frameSpec.syntactic_type === 'direct_object') return rendered
  if (frameSpec.syntactic_type === 'prepositional_object') {
    if (!frameSpec.preposition_en || !frameSpec.preposition_pt) fail('ARGUMENT_PREPOSITION_REQUIRED', frameSpec.slot)
    return {
      ...rendered,
      en: `${frameSpec.preposition_en} ${rendered.en}`,
      pt: contractPrepositionPt(frameSpec.preposition_pt, rendered.pt, unit.pt_gender),
    }
  }
  fail('ARGUMENT_SYNTACTIC_TYPE_INVALID', frameSpec.syntactic_type)
}

function verbSurface(verb, sense, features) {
  if (features.tense !== 'simple_present' || features.person !== 'first' || features.number !== 'singular' || features.polarity !== 'affirmative') {
    fail('PROPOSITION_REALIZATION_UNSUPPORTED', signature(features))
  }
  return {
    en: verb.forms?.en?.base || verb.lemma_en,
    pt: sense.pt_present_1sg || verb.forms?.pt_BR?.present_1sg || verb.lemma_pt,
  }
}

export function composePropositionPlan({
  verbs,
  entities,
  places,
  verbId,
  senseId,
  frameId,
  subject = { en: 'I', pt: 'Eu' },
  arguments: args = {},
  fixedFeatures = {},
  requestedFeatures = {},
}) {
  const verb = findVerb(verbs, verbId)
  const sense = findSense(verb, senseId)
  const frame = findFrame(sense, frameId)
  const featureContract = normalizeFeatureContract(frame, fixedFeatures, requestedFeatures)
  const renderedArguments = []
  const argumentRows = []
  const stages = [verb.lexical_stage, sense.first_exposure_stage]

  for (const spec of frame.complements || []) {
    const arg = args[spec.slot]
    if (!arg && spec.required) fail('ARGUMENT_REQUIRED', spec.slot)
    if (!arg) continue
    const unit = validateArgument(spec, arg, { entities, places })
    const rendered = renderComplement(spec, arg, unit, { entities, places })
    renderedArguments.push(rendered)
    argumentRows.push({
      slot: spec.slot,
      role: spec.role || spec.slot,
      syntactic_type: spec.syntactic_type,
      source: arg.source,
      unit_id: unit.unit_id,
      ...(spec.relation ? { relation: spec.relation } : {}),
    })
    stages.push(unit.lexical_stage)
  }

  const verbText = verbSurface(verb, sense, featureContract.resolved_features)
  const textEn = [subject.en, verbText.en, ...renderedArguments.map((row) => row.en)].filter(Boolean).join(' ')
  const textPt = [subject.pt, verbText.pt, ...renderedArguments.map((row) => row.pt)].filter(Boolean).join(' ')
  const slotSignature = signature({
    verb_id: verb.unit_id,
    sense_id: sense.sense_id,
    argument_frame_id: frame.frame_id,
    arguments: argumentRows,
    features: featureContract.resolved_features,
  })

  return {
    plan_kind: 'typed_proposition',
    predicate: {
      lexeme_id: verb.unit_id,
      sense_id: sense.sense_id,
      argument_frame_id: frame.frame_id,
      syntax_family: frame.syntax_family,
    },
    arguments: argumentRows,
    ...featureContract,
    lexical_refs: [verb.unit_id, sense.sense_id, ...argumentRows.map((row) => row.unit_id)],
    prerequisites: [],
    introduced_stage: maxStage(stages),
    slot_signature: slotSignature,
    surface: { en: `${textEn}.`, pt: `${textPt}.` },
  }
}

function matchesErrorPattern(pattern, request, unit) {
  if (pattern.sense_id && pattern.sense_id !== request.senseId) return false
  if (pattern.syntactic_type && pattern.syntactic_type !== request.syntacticType) return false
  if (pattern.entity_source && pattern.entity_source !== request.argument.source) return false
  if (!hasAll(unit.roles, pattern.require_roles || [])) return false
  return true
}

export function composePropositionByStructure({
  verbs,
  entities,
  places,
  verbId,
  senseId,
  syntacticType,
  argument,
  subject,
  fixedFeatures = {},
  requestedFeatures = {},
}) {
  const verb = findVerb(verbs, verbId)
  const sense = findSense(verb, senseId)
  const unit = resolveUnit(argument.source, argument.unit_id, { entities, places })
  const frame = (sense.argument_frames || []).find((candidate) => {
    const spec = candidate.complements?.[0]
    return spec?.syntactic_type === syntacticType &&
      (spec.entity_sources || []).includes(argument.source) &&
      hasAll(unit.roles, spec.require_roles || [])
  })

  if (!frame) {
    const forbidden = (verb.crosslingual_error_patterns || []).find((pattern) =>
      matchesErrorPattern(pattern, { senseId, syntacticType, argument }, unit))
    if (forbidden) fail('CROSSLINGUAL_ERROR_PATTERN_FORBIDDEN', forbidden.error_id)
    fail('ARGUMENT_FRAME_NOT_LICENSED', `${verbId}:${senseId}:${syntacticType}:${argument.unit_id}`)
  }

  const slot = frame.complements[0].slot
  return composePropositionPlan({
    verbs,
    entities,
    places,
    verbId,
    senseId,
    frameId: frame.frame_id,
    subject,
    arguments: { [slot]: argument },
    fixedFeatures,
    requestedFeatures,
  })
}

export function validateSemanticEntityLexicon(lexicon) {
  const errors = []
  if (!lexicon?.lexicon_id) errors.push('ENTITY_LEXICON_ID_REQUIRED')
  if (lexicon?.en_variant !== 'en_US') errors.push('ENTITY_EN_VARIANT_REQUIRED:en_US')
  if (lexicon?.pt_variant !== 'pt_BR') errors.push('ENTITY_PT_VARIANT_REQUIRED:pt_BR')
  if (!Array.isArray(lexicon?.units) || lexicon.units.length === 0) errors.push('ENTITY_UNITS_REQUIRED')
  if (deepHasKey(lexicon, 'target')) errors.push('LEXICAL_TARGET_STATE_FORBIDDEN')

  const ids = new Set()
  for (const unit of lexicon?.units || []) {
    if (!unit?.unit_id) errors.push('ENTITY_UNIT_ID_REQUIRED')
    else if (ids.has(unit.unit_id)) errors.push(`ENTITY_UNIT_ID_DUPLICATE:${unit.unit_id}`)
    else ids.add(unit.unit_id)
    if (unit?.type !== 'entity') errors.push(`ENTITY_TYPE_INVALID:${unit?.unit_id}`)
    if (!unit?.en || !unit?.pt) errors.push(`ENTITY_SURFACE_REQUIRED:${unit?.unit_id}`)
    if (!COUNTABILITY.has(unit?.countability)) errors.push(`ENTITY_COUNTABILITY_INVALID:${unit?.unit_id}`)
    if (!['m', 'f'].includes(unit?.pt_gender)) errors.push(`ENTITY_PT_GENDER_INVALID:${unit?.unit_id}`)
    if (stageIndex(unit?.lexical_stage) < 0) errors.push(`ENTITY_STAGE_INVALID:${unit?.unit_id}`)
    if (!Array.isArray(unit?.roles) || unit.roles.length === 0) errors.push(`ENTITY_ROLES_REQUIRED:${unit?.unit_id}`)
  }
  return { valid: errors.length === 0, errors, count: lexicon?.units?.length || 0 }
}

export function validateVerbArgumentLexicon(lexicon) {
  const errors = []
  if (!lexicon?.lexicon_id) errors.push('VERB_LEXICON_ID_REQUIRED')
  if (deepHasKey(lexicon, 'pattern_en')) errors.push('LEXICAL_PATTERN_EN_FORBIDDEN')
  if (deepHasKey(lexicon, 'target')) errors.push('LEXICAL_TARGET_STATE_FORBIDDEN')
  if (!Array.isArray(lexicon?.units) || lexicon.units.length === 0) errors.push('VERB_UNITS_REQUIRED')

  const verbIds = new Set()
  const senseIds = new Set()
  const frameIds = new Set()
  const errorIds = new Set()
  for (const verb of lexicon?.units || []) {
    if (!verb?.unit_id) errors.push('VERB_UNIT_ID_REQUIRED')
    else if (verbIds.has(verb.unit_id)) errors.push(`VERB_UNIT_ID_DUPLICATE:${verb.unit_id}`)
    else verbIds.add(verb.unit_id)
    if (verb?.type !== 'verb') errors.push(`VERB_TYPE_INVALID:${verb?.unit_id}`)
    if (stageIndex(verb?.lexical_stage) < 0) errors.push(`VERB_STAGE_INVALID:${verb?.unit_id}`)
    if (!verb?.forms?.en?.base || !verb?.forms?.pt_BR?.present_1sg) errors.push(`VERB_FORMS_REQUIRED:${verb?.unit_id}`)

    for (const sense of verb?.senses || []) {
      if (!sense?.sense_id) errors.push(`VERB_SENSE_ID_REQUIRED:${verb?.unit_id}`)
      else if (senseIds.has(sense.sense_id)) errors.push(`VERB_SENSE_ID_DUPLICATE:${sense.sense_id}`)
      else senseIds.add(sense.sense_id)
      if (stageIndex(sense?.first_exposure_stage) < 0) errors.push(`VERB_SENSE_STAGE_INVALID:${sense?.sense_id}`)
      if (!Array.isArray(sense?.argument_frames) || sense.argument_frames.length === 0) errors.push(`ARGUMENT_FRAMES_REQUIRED:${sense?.sense_id}`)

      for (const frame of sense?.argument_frames || []) {
        if (!frame?.frame_id) errors.push(`ARGUMENT_FRAME_ID_REQUIRED:${sense?.sense_id}`)
        else if (frameIds.has(frame.frame_id)) errors.push(`ARGUMENT_FRAME_ID_DUPLICATE:${frame.frame_id}`)
        else frameIds.add(frame.frame_id)
        if (!frame?.syntax_family) errors.push(`ARGUMENT_FRAME_SYNTAX_FAMILY_REQUIRED:${frame?.frame_id}`)
        if (!Array.isArray(frame?.negotiable_features)) errors.push(`ARGUMENT_FRAME_NEGOTIABLE_FEATURES_REQUIRED:${frame?.frame_id}`)
        if (!Array.isArray(frame?.complements) || frame.complements.length === 0) errors.push(`ARGUMENT_FRAME_COMPLEMENTS_REQUIRED:${frame?.frame_id}`)
      }
    }

    for (const pattern of verb?.crosslingual_error_patterns || []) {
      if (!pattern?.error_id) errors.push(`CROSSLINGUAL_ERROR_ID_REQUIRED:${verb?.unit_id}`)
      else if (errorIds.has(pattern.error_id)) errors.push(`CROSSLINGUAL_ERROR_ID_DUPLICATE:${pattern.error_id}`)
      else errorIds.add(pattern.error_id)
      if (!pattern?.reason) errors.push(`CROSSLINGUAL_ERROR_REASON_REQUIRED:${pattern?.error_id}`)
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    verbs: lexicon?.units?.length || 0,
    senses: senseIds.size,
    argument_frames: frameIds.size,
  }
}

export function auditSemanticNetworkPilot({ verbs, entities, places }) {
  let rawCandidateCount = 0
  let licensedCandidateCount = 0
  const exclusionReasons = {}
  const signatures = new Set()
  const usedLexicalUnits = new Set()
  const frameIds = new Set()
  const syntaxFamilies = new Set()

  for (const verb of verbs?.units || []) {
    for (const sense of verb.senses || []) {
      for (const frame of sense.argument_frames || []) {
        frameIds.add(frame.frame_id)
        syntaxFamilies.add(frame.syntax_family)
        const spec = frame.complements?.[0]
        if (!spec) continue
        for (const source of spec.entity_sources || []) {
          const lexicon = source === 'entities' ? entities : places
          for (const unit of lexicon?.units || []) {
            rawCandidateCount += 1
            try {
              const plan = composePropositionPlan({
                verbs,
                entities,
                places,
                verbId: verb.unit_id,
                senseId: sense.sense_id,
                frameId: frame.frame_id,
                arguments: { [spec.slot]: { source, unit_id: unit.unit_id } },
              })
              licensedCandidateCount += 1
              signatures.add(plan.slot_signature)
              usedLexicalUnits.add(plan.predicate.lexeme_id)
              for (const row of plan.arguments) usedLexicalUnits.add(row.unit_id)
            } catch (error) {
              const code = error instanceof SemanticNetworkError ? error.code : 'UNKNOWN_ERROR'
              exclusionReasons[code] = (exclusionReasons[code] || 0) + 1
            }
          }
        }
      }
    }
  }

  return {
    lexical_heads: usedLexicalUnits.size,
    eligible_lexical_units: usedLexicalUnits.size,
    distinct_argument_frames: frameIds.size,
    distinct_syntax_families: syntaxFamilies.size,
    distinct_slot_signatures: signatures.size,
    raw_candidate_count: rawCandidateCount,
    licensed_candidate_count: licensedCandidateCount,
    semantic_exclusion_rate: rawCandidateCount === 0 ? 0 : (rawCandidateCount - licensedCandidateCount) / rawCandidateCount,
    exclusion_reasons: exclusionReasons,
  }
}
