const CLASSIFICATION_ARRAY_FIELDS = [
  "keywords",
  "domains",
  "profileSignals",
  "classifications",
];

function arraysMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeArticleClassificationArrays(existing = {}, updates = {}) {
  const values = {};
  let changed = false;

  for (const field of CLASSIFICATION_ARRAY_FIELDS) {
    const nextValue = updates[field];
    const currentValue = existing[field];
    const hasArrayUpdate = Array.isArray(nextValue);

    values[field] = hasArrayUpdate ? nextValue : currentValue;
    changed ||= hasArrayUpdate && !arraysMatch(nextValue, currentValue);
  }

  return { values, changed };
}
