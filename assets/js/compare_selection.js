(() => {
  const DEFAULT_QUERY_KEY = "compare";
  const DEFAULT_MAX_SELECTION = 4;

  const normalizeResortId = (value) => String(value || "").trim();

  const _positiveIntOr = (value, fallback) => {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : fallback;
  };

  const normalizeResortIds = (values) => {
    const input = Array.isArray(values) ? values : [values];
    const seen = new Set();
    const out = [];
    input.forEach((raw) => {
      String(raw || "")
        .split(",")
        .map(normalizeResortId)
        .filter(Boolean)
        .forEach((resortId) => {
          if (seen.has(resortId)) return;
          seen.add(resortId);
          out.push(resortId);
        });
    });
    return out;
  };

  const sanitizeSelection = (values, options = {}) => {
    const validIds = new Set(normalizeResortIds(options.validResortIds || []));
    const normalized = normalizeResortIds(values);
    const filtered = validIds.size ? normalized.filter((resortId) => validIds.has(resortId)) : normalized;
    return filtered.slice(0, _positiveIntOr(options.maxSelection, DEFAULT_MAX_SELECTION));
  };

  const parseSelectionFromParams = (params, options = {}) => {
    const queryKey = normalizeResortId(options.queryKey || DEFAULT_QUERY_KEY) || DEFAULT_QUERY_KEY;
    const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams(params || "");
    return sanitizeSelection(searchParams.getAll(queryKey), options);
  };

  const parseSelectionFromSearch = (search, options = {}) => {
    const normalizedSearch = String(search || "").replace(/^\?/, "");
    return parseSelectionFromParams(new URLSearchParams(normalizedSearch), options);
  };

  const withSelectionInParams = (params, values, options = {}) => {
    const queryKey = normalizeResortId(options.queryKey || DEFAULT_QUERY_KEY) || DEFAULT_QUERY_KEY;
    const searchParams = params instanceof URLSearchParams ? new URLSearchParams(params.toString()) : new URLSearchParams(params || "");
    searchParams.delete(queryKey);
    sanitizeSelection(values, options).forEach((resortId) => {
      searchParams.append(queryKey, resortId);
    });
    return searchParams;
  };

  const toggleSelection = (selection, resortId, options = {}) => {
    const current = sanitizeSelection(selection, options);
    const normalizedId = normalizeResortId(resortId);
    const validIds = new Set(normalizeResortIds(options.validResortIds || []));
    const maxSelection = _positiveIntOr(options.maxSelection, DEFAULT_MAX_SELECTION);

    if (!normalizedId || (validIds.size && !validIds.has(normalizedId))) {
      return { selection: current, changed: false, added: false, removed: false, reason: "invalid" };
    }

    if (current.includes(normalizedId)) {
      return {
        selection: current.filter((value) => value !== normalizedId),
        changed: true,
        added: false,
        removed: true,
        reason: "removed",
      };
    }

    if (current.length >= maxSelection) {
      return { selection: current, changed: false, added: false, removed: false, reason: "max" };
    }

    return {
      selection: [...current, normalizedId],
      changed: true,
      added: true,
      removed: false,
      reason: "added",
    };
  };

  window.CloseSnowCompareSelection = {
    DEFAULT_QUERY_KEY,
    DEFAULT_MAX_SELECTION,
    normalizeResortId,
    normalizeResortIds,
    sanitizeSelection,
    parseSelectionFromParams,
    parseSelectionFromSearch,
    withSelectionInParams,
    toggleSelection,
  };
})();
