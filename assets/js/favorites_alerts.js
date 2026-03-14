(function (root) {
  const STORAGE_KEY = "closesnow_favorite_alert_state_v1";
  const RULE_VERSION = "favorites_alert_rules_v1";
  const MAX_ALERT_ITEMS = 200;

  const normalizeText = (value) => String(value || "").trim();

  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const asIsoString = (value, fallback = "") => {
    const text = normalizeText(value);
    if (!text) return fallback;
    const dt = new Date(text);
    return Number.isNaN(dt.getTime()) ? fallback : dt.toISOString();
  };

  const dayLabel = (value) => {
    const text = normalizeText(value);
    return text ? text.slice(0, 10) : "";
  };

  const firstDays = (report, count) => {
    const daily = report && Array.isArray(report.daily) ? report.daily : [];
    return daily.slice(0, count).filter((day) => day && typeof day === "object");
  };

  const sumMetric = (days, key) => days.reduce((total, day) => total + (asFiniteNumber(day[key]) || 0), 0);

  const maxMetric = (days, key) => {
    let maxValue = null;
    days.forEach((day) => {
      const value = asFiniteNumber(day[key]);
      if (value === null) return;
      maxValue = maxValue === null ? value : Math.max(maxValue, value);
    });
    return maxValue;
  };

  const countMatchingDays = (days, predicate) => {
    let count = 0;
    days.forEach((day) => {
      if (predicate(day)) count += 1;
    });
    return count;
  };

  const firstMatchingDay = (days, predicate) => {
    for (const day of days) {
      if (predicate(day)) return dayLabel(day.date);
    }
    return "";
  };

  const resortName = (report) => (
    normalizeText(report && (report.display_name || report.query || report.resort_id)) || "Favorite resort"
  );

  const formatNumber = (value) => {
    const num = asFiniteNumber(value);
    if (num === null) return "0";
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
  };

  const defaultState = () => ({
    schema_version: STORAGE_KEY,
    rule_version: RULE_VERSION,
    updated_at: "",
    snapshots_by_resort_id: {},
    alerts: [],
  });

  const normalizeSnapshot = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const resortId = normalizeText(raw.resort_id);
    if (!resortId) return null;
    return {
      resort_id: resortId,
      resort_name: normalizeText(raw.resort_name) || "Favorite resort",
      payload_generated_at: asIsoString(raw.payload_generated_at),
      snapshot_taken_at: asIsoString(raw.snapshot_taken_at),
      today_snowfall_cm: asFiniteNumber(raw.today_snowfall_cm) || 0,
      next3day_total_snowfall_cm: asFiniteNumber(raw.next3day_total_snowfall_cm) || 0,
      week1_total_snowfall_cm: asFiniteNumber(raw.week1_total_snowfall_cm) || 0,
      rain_total_next3d_mm: asFiniteNumber(raw.rain_total_next3d_mm) || 0,
      rain_day_count_next3d: asFiniteNumber(raw.rain_day_count_next3d) || 0,
      warm_day_count_next3d: asFiniteNumber(raw.warm_day_count_next3d) || 0,
      max_temp_next3d_c: asFiniteNumber(raw.max_temp_next3d_c),
      first_rain_day: normalizeText(raw.first_rain_day),
      first_warm_day: normalizeText(raw.first_warm_day),
    };
  };

  const normalizeAlertItem = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const id = normalizeText(raw.id);
    const resortId = normalizeText(raw.resort_id);
    const severity = normalizeText(raw.severity);
    const type = normalizeText(raw.type);
    if (!id || !resortId || !severity || !type) return null;
    const metrics = raw.metrics && typeof raw.metrics === "object" && !Array.isArray(raw.metrics)
      ? {
          window: normalizeText(raw.metrics.window),
          unit: normalizeText(raw.metrics.unit),
          previous: asFiniteNumber(raw.metrics.previous),
          current: asFiniteNumber(raw.metrics.current),
          delta: asFiniteNumber(raw.metrics.delta),
        }
      : null;
    return {
      id,
      resort_id: resortId,
      resort_name: normalizeText(raw.resort_name) || "Favorite resort",
      severity,
      type,
      created_at: asIsoString(raw.created_at),
      payload_generated_at: asIsoString(raw.payload_generated_at),
      previous_payload_generated_at: asIsoString(raw.previous_payload_generated_at),
      title: normalizeText(raw.title),
      message: normalizeText(raw.message),
      metrics,
    };
  };

  const normalizeState = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultState();
    const state = defaultState();
    state.updated_at = asIsoString(raw.updated_at);
    const snapshots = raw.snapshots_by_resort_id && typeof raw.snapshots_by_resort_id === "object"
      ? raw.snapshots_by_resort_id
      : {};
    Object.entries(snapshots).forEach(([resortId, snapshot]) => {
      const normalized = normalizeSnapshot({ resort_id: resortId, ...snapshot });
      if (normalized) state.snapshots_by_resort_id[normalized.resort_id] = normalized;
    });
    const alerts = Array.isArray(raw.alerts) ? raw.alerts : [];
    state.alerts = alerts.map(normalizeAlertItem).filter(Boolean).slice(0, MAX_ALERT_ITEMS);
    return state;
  };

  const loadState = (storage = root.localStorage) => {
    if (!storage || typeof storage.getItem !== "function") return defaultState();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return defaultState();
    }
  };

  const persistState = (state, storage = root.localStorage) => {
    const normalized = normalizeState(state);
    if (!storage || typeof storage.setItem !== "function") return normalized;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Ignore storage failures.
    }
    return normalized;
  };

  const buildSnapshot = (report, payloadGeneratedAt = "") => {
    if (!report || typeof report !== "object") return null;
    const resortId = normalizeText(report.resort_id);
    if (!resortId) return null;
    const next3Days = firstDays(report, 3);
    return {
      resort_id: resortId,
      resort_name: resortName(report),
      payload_generated_at: asIsoString(payloadGeneratedAt),
      snapshot_taken_at: new Date().toISOString(),
      today_snowfall_cm: asFiniteNumber(next3Days[0] && next3Days[0].snowfall_cm) || 0,
      next3day_total_snowfall_cm: sumMetric(next3Days, "snowfall_cm"),
      week1_total_snowfall_cm: asFiniteNumber(report.week1_total_snowfall_cm) || 0,
      rain_total_next3d_mm: sumMetric(next3Days, "rain_mm"),
      rain_day_count_next3d: countMatchingDays(next3Days, (day) => (asFiniteNumber(day.rain_mm) || 0) >= 2),
      warm_day_count_next3d: countMatchingDays(next3Days, (day) => (asFiniteNumber(day.temperature_max_c) || Number.NEGATIVE_INFINITY) >= 2),
      max_temp_next3d_c: maxMetric(next3Days, "temperature_max_c"),
      first_rain_day: firstMatchingDay(next3Days, (day) => (asFiniteNumber(day.rain_mm) || 0) >= 2),
      first_warm_day: firstMatchingDay(next3Days, (day) => (asFiniteNumber(day.temperature_max_c) || Number.NEGATIVE_INFINITY) >= 2),
    };
  };

  const buildAlert = ({
    type,
    severity,
    current,
    previous,
    title,
    message,
    windowName,
    unit,
    previousValue,
    currentValue,
    delta,
  }) => ({
    id: [
      type,
      current.resort_id,
      current.payload_generated_at,
      formatNumber(delta),
    ].join(":"),
    resort_id: current.resort_id,
    resort_name: current.resort_name,
    severity,
    type,
    created_at: current.payload_generated_at || new Date().toISOString(),
    payload_generated_at: current.payload_generated_at,
    previous_payload_generated_at: previous.payload_generated_at,
    title,
    message,
    metrics: {
      window: windowName,
      unit,
      previous: previousValue,
      current: currentValue,
      delta,
    },
  });

  const compareSnapshots = (previousRaw, currentRaw) => {
    const previous = normalizeSnapshot(previousRaw);
    const current = normalizeSnapshot(currentRaw);
    if (!previous || !current) return [];

    const alerts = [];
    const next3SnowGain = current.next3day_total_snowfall_cm - previous.next3day_total_snowfall_cm;
    const week1SnowGain = current.week1_total_snowfall_cm - previous.week1_total_snowfall_cm;
    if (next3SnowGain >= 10 || week1SnowGain >= 15) {
      const useNext3 = next3SnowGain >= 10;
      const delta = useNext3 ? next3SnowGain : week1SnowGain;
      const previousValue = useNext3 ? previous.next3day_total_snowfall_cm : previous.week1_total_snowfall_cm;
      const currentValue = useNext3 ? current.next3day_total_snowfall_cm : current.week1_total_snowfall_cm;
      alerts.push(buildAlert({
        type: "snowfall_gain",
        severity: delta >= 20 || currentValue >= 25 ? "high" : "medium",
        current,
        previous,
        title: `Snowfall jumped at ${current.resort_name}`,
        message: `${current.resort_name} gained ${formatNumber(delta)} cm compared with your last snapshot.`,
        windowName: useNext3 ? "next_3_days" : "week_1",
        unit: "cm",
        previousValue,
        currentValue,
        delta,
      }));
    }

    const next3SnowLoss = previous.next3day_total_snowfall_cm - current.next3day_total_snowfall_cm;
    const week1SnowLoss = previous.week1_total_snowfall_cm - current.week1_total_snowfall_cm;
    if (next3SnowLoss >= 12 || week1SnowLoss >= 18) {
      const useNext3 = next3SnowLoss >= 12;
      const delta = useNext3 ? next3SnowLoss : week1SnowLoss;
      const previousValue = useNext3 ? previous.next3day_total_snowfall_cm : previous.week1_total_snowfall_cm;
      const currentValue = useNext3 ? current.next3day_total_snowfall_cm : current.week1_total_snowfall_cm;
      alerts.push(buildAlert({
        type: "snowfall_loss",
        severity: delta >= 20 || (previousValue >= 15 && currentValue <= 3) ? "high" : "medium",
        current,
        previous,
        title: `Snowfall backed off at ${current.resort_name}`,
        message: `${current.resort_name} lost ${formatNumber(delta)} cm from the forecast since your last snapshot.`,
        windowName: useNext3 ? "next_3_days" : "week_1",
        unit: "cm",
        previousValue,
        currentValue,
        delta,
      }));
    }

    const rainIncrease = current.rain_total_next3d_mm - previous.rain_total_next3d_mm;
    if (
      current.rain_total_next3d_mm >= 5 &&
      current.warm_day_count_next3d > 0 &&
      (
        previous.rain_total_next3d_mm < 2 ||
        rainIncrease >= 4 ||
        current.rain_day_count_next3d > previous.rain_day_count_next3d
      )
    ) {
      alerts.push(buildAlert({
        type: "rain_crossover",
        severity: current.rain_total_next3d_mm >= 10 || current.rain_day_count_next3d >= 2 ? "high" : "medium",
        current,
        previous,
        title: `Rain risk moved into ${current.resort_name}`,
        message: current.first_rain_day
          ? `${current.resort_name} now shows ${formatNumber(current.rain_total_next3d_mm)} mm of rain starting around ${current.first_rain_day}.`
          : `${current.resort_name} now shows ${formatNumber(current.rain_total_next3d_mm)} mm of rain in the next 3 days.`,
        windowName: "next_3_days",
        unit: "mm",
        previousValue: previous.rain_total_next3d_mm,
        currentValue: current.rain_total_next3d_mm,
        delta: rainIncrease,
      }));
    }

    const previousMaxTemp = asFiniteNumber(previous.max_temp_next3d_c);
    const currentMaxTemp = asFiniteNumber(current.max_temp_next3d_c);
    const warmingDelta = currentMaxTemp !== null && previousMaxTemp !== null ? currentMaxTemp - previousMaxTemp : null;
    if (warmingDelta !== null && currentMaxTemp >= 3 && warmingDelta >= 4) {
      alerts.push(buildAlert({
        type: "warming_shift",
        severity: currentMaxTemp >= 6 || warmingDelta >= 7 ? "high" : "medium",
        current,
        previous,
        title: `Warmer temperatures are moving into ${current.resort_name}`,
        message: current.first_warm_day
          ? `${current.resort_name} warmed by ${formatNumber(warmingDelta)} C, with above-freezing highs showing up around ${current.first_warm_day}.`
          : `${current.resort_name} warmed by ${formatNumber(warmingDelta)} C in the next 3 days.`,
        windowName: "next_3_days",
        unit: "c",
        previousValue: previousMaxTemp,
        currentValue: currentMaxTemp,
        delta: warmingDelta,
      }));
    }

    return alerts;
  };

  const syncPayload = ({ payload, favoriteResortIds, storage = root.localStorage } = {}) => {
    const state = loadState(storage);
    const payloadGeneratedAt = asIsoString(
      payload && payload.generated_at_utc,
      new Date().toISOString(),
    );
    const favoriteIds = Array.from(new Set(
      (Array.isArray(favoriteResortIds) ? favoriteResortIds : [])
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ));
    const reports = payload && Array.isArray(payload.reports) ? payload.reports : [];
    const reportsByResortId = {};
    reports.forEach((report) => {
      const resortId = normalizeText(report && report.resort_id);
      if (resortId) reportsByResortId[resortId] = report;
    });

    const nextSnapshots = {};
    const nextAlerts = Array.isArray(state.alerts) ? state.alerts.slice() : [];
    const knownAlertIds = new Set(nextAlerts.map((alert) => alert.id));
    const newAlerts = [];

    favoriteIds.forEach((resortId) => {
      const previous = state.snapshots_by_resort_id[resortId] || null;
      const report = reportsByResortId[resortId];
      if (!report) {
        if (previous) nextSnapshots[resortId] = previous;
        return;
      }

      const current = buildSnapshot(report, payloadGeneratedAt);
      if (!current) return;

      if (
        previous &&
        previous.payload_generated_at &&
        current.payload_generated_at &&
        current.payload_generated_at < previous.payload_generated_at
      ) {
        nextSnapshots[resortId] = previous;
        return;
      }

      if (
        previous &&
        previous.payload_generated_at &&
        current.payload_generated_at &&
        current.payload_generated_at > previous.payload_generated_at
      ) {
        compareSnapshots(previous, current).forEach((alert) => {
          if (knownAlertIds.has(alert.id)) return;
          knownAlertIds.add(alert.id);
          nextAlerts.unshift(alert);
          newAlerts.push(alert);
        });
      }

      nextSnapshots[resortId] = current;
    });

    const nextState = {
      schema_version: STORAGE_KEY,
      rule_version: RULE_VERSION,
      updated_at: payloadGeneratedAt,
      snapshots_by_resort_id: nextSnapshots,
      alerts: nextAlerts.slice(0, MAX_ALERT_ITEMS),
    };

    return {
      state: persistState(nextState, storage),
      newAlerts,
    };
  };

  root.CloseSnowFavoritesAlerts = {
    STORAGE_KEY,
    RULE_VERSION,
    buildSnapshot,
    compareSnapshots,
    loadState,
    persistState,
    syncPayload,
  };
})(typeof window !== "undefined" ? window : globalThis);
