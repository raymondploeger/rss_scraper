const MAX_CROSS_BUCKET_DAY_DIFFERENCE = 10;

const BANKNOTE_DESIGN_EVENT_TYPES = new Set([
  "banknote_new_design",
  "banknote_new_series",
  "banknote_redesign",
  "new_banknote_series",
  "commemorative_note",
  "commemorative_issue",
]);

function normalizedValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(normalizedValue).filter(Boolean)));
}

function hasSharedValue(leftValues, rightValues) {
  const rightSet = new Set(rightValues);
  return leftValues.some((value) => rightSet.has(value));
}

function getEventTypeFamily(event) {
  const eventType = normalizedValue(event?.canonicalEventType);
  if (normalizedValue(event?.domain) === "banknote" && BANKNOTE_DESIGN_EVENT_TYPES.has(eventType)) {
    return "banknote_design";
  }
  return eventType;
}

function getEventDateMs(event) {
  const dateMs = new Date(event?.pubDate || "").getTime();
  return Number.isNaN(dateMs) ? NaN : dateMs;
}

function getSharedHardAnchor(left, right) {
  const leftEntities = normalizedValues([left?.primaryEntity, left?.country]);
  const rightEntities = normalizedValues([right?.primaryEntity, right?.country]);
  if (hasSharedValue(leftEntities, rightEntities)) {
    return "entity_or_country";
  }

  if (normalizedValue(left?.authority) && normalizedValue(left?.authority) === normalizedValue(right?.authority)) {
    return "authority";
  }

  if (hasSharedValue(normalizedValues(left?.systems), normalizedValues(right?.systems))) {
    return "system";
  }

  return "";
}

/**
 * Returns candidate-index keys only for hard anchors. The caller may cap each
 * bucket, which keeps cross-key comparisons local rather than global O(n²).
 */
export function getCrossBucketCandidateKeys(event) {
  const domain = normalizedValue(event?.domain);
  const topicFamily = normalizedValue(event?.topicFamily);
  const eventTypeFamily = getEventTypeFamily(event);
  if (!domain || !topicFamily || !eventTypeFamily) {
    return [];
  }

  const prefix = `${domain}|${topicFamily}|${eventTypeFamily}`;
  const anchors = [
    ...normalizedValues([event?.primaryEntity, event?.country]).map((value) => `entity:${value}`),
    ...normalizedValues([event?.authority]).map((value) => `authority:${value}`),
    ...normalizedValues(event?.systems).map((value) => `system:${value}`),
  ];
  return Array.from(new Set(anchors.map((anchor) => `${prefix}|${anchor}`)));
}

/**
 * Conservative, pure decision for comparing groups whose identity keys differ.
 * Pair-specific conflict/noise/document checks are supplied by the app adapter.
 */
export function decideCrossBucketNearMatch(left, right, { hardConflict = false } = {}) {
  const leftKey = normalizedValue(left?.identityEventKey);
  const rightKey = normalizedValue(right?.identityEventKey);
  if (!leftKey || !rightKey || leftKey === rightKey) {
    return { matched: false, reason: "not_cross_bucket" };
  }
  if (hardConflict || left?.excluded || right?.excluded) {
    return { matched: false, reason: "existing_conflict_or_exclusion" };
  }

  const leftDateMs = getEventDateMs(left);
  const rightDateMs = getEventDateMs(right);
  if (Number.isNaN(leftDateMs) || Number.isNaN(rightDateMs) || Math.abs(leftDateMs - rightDateMs) > MAX_CROSS_BUCKET_DAY_DIFFERENCE * 86400000) {
    return { matched: false, reason: "outside_10_day_window" };
  }

  if (normalizedValue(left?.domain) !== normalizedValue(right?.domain) || normalizedValue(left?.topicFamily) !== normalizedValue(right?.topicFamily)) {
    return { matched: false, reason: "different_domain_or_topic_family" };
  }
  if (!getEventTypeFamily(left) || getEventTypeFamily(left) !== getEventTypeFamily(right)) {
    return { matched: false, reason: "incompatible_canonical_event_type" };
  }

  const leftEntities = normalizedValues([left?.primaryEntity, left?.country]);
  const rightEntities = normalizedValues([right?.primaryEntity, right?.country]);
  if (leftEntities.length && rightEntities.length && !hasSharedValue(leftEntities, rightEntities)) {
    return { matched: false, reason: "conflicting_primary_entity_or_country" };
  }

  const hardAnchor = getSharedHardAnchor(left, right);
  if (!hardAnchor) {
    return { matched: false, reason: "missing_shared_hard_anchor" };
  }

  const fingerprint = left?.fingerprint || right?.fingerprint;
  if (!fingerprint?.grouped || fingerprint.confidence !== "high") {
    return { matched: false, reason: "fingerprint_not_high_confidence" };
  }
  return { matched: true, reason: `high_confidence_${hardAnchor}` };
}
