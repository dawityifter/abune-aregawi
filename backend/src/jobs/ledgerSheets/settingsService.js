'use strict';

const { ChurchSetting } = require('../../models');
const { getLedgerSheetsConfig } = require('./config');
const { exportLedgerToSheets } = require('./ledgerExportService');

const SETTINGS_KEYS = {
  schedule: 'ledger_sheets_schedule',
  lastRun: 'ledger_sheets_last_run'
};

const DEFAULT_SCHEDULE = {
  enabled: false,
  frequency: 'weekly',
  dayOfWeek: 0,
  hour: 2,
  minute: 0,
  syncPreviousYear: true
};

let activeRunPromise = null;

function parseJsonSetting(setting, fallback) {
  if (!setting || !setting.value) {
    return fallback;
  }

  try {
    return JSON.parse(setting.value);
  } catch (_) {
    return fallback;
  }
}

async function getScheduleSettings() {
  const setting = await ChurchSetting.findByPk(SETTINGS_KEYS.schedule);
  const value = parseJsonSetting(setting, DEFAULT_SCHEDULE);
  return normalizeSchedule(value);
}

async function saveScheduleSettings(input) {
  const schedule = normalizeSchedule(input);
  await ChurchSetting.upsert({
    key: SETTINGS_KEYS.schedule,
    value: JSON.stringify(schedule)
  });
  return schedule;
}

async function getLastRunState() {
  const setting = await ChurchSetting.findByPk(SETTINGS_KEYS.lastRun);
  return parseJsonSetting(setting, null);
}

async function setLastRunState(runState) {
  await ChurchSetting.upsert({
    key: SETTINGS_KEYS.lastRun,
    value: JSON.stringify(runState)
  });
}

function normalizeSchedule(input = {}) {
  const frequency = input.frequency === 'daily' ? 'daily' : 'weekly';
  const hour = clampNumber(input.hour, 0, 23, DEFAULT_SCHEDULE.hour);
  const minute = clampNumber(input.minute, 0, 59, DEFAULT_SCHEDULE.minute);
  const dayOfWeek = clampNumber(input.dayOfWeek, 0, 6, DEFAULT_SCHEDULE.dayOfWeek);

  return {
    enabled: Boolean(input.enabled),
    frequency,
    dayOfWeek,
    hour,
    minute,
    syncPreviousYear: input.syncPreviousYear === undefined
      ? DEFAULT_SCHEDULE.syncPreviousYear
      : Boolean(input.syncPreviousYear)
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function getCurrentCentralTimeParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday]
  };
}

function toIsoStringForChicagoLocal(parts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:00`;
}

function getLatestDueSlot(schedule, now = new Date()) {
  if (!schedule.enabled) {
    return null;
  }

  const parts = getCurrentCentralTimeParts(now);
  const currentMinuteOfDay = parts.hour * 60 + parts.minute;
  const scheduledMinuteOfDay = schedule.hour * 60 + schedule.minute;

  if (schedule.frequency === 'daily') {
    if (currentMinuteOfDay < scheduledMinuteOfDay) {
      return null;
    }

    return toIsoStringForChicagoLocal({
      ...parts,
      hour: schedule.hour,
      minute: schedule.minute
    });
  }

  if (parts.weekday !== schedule.dayOfWeek || currentMinuteOfDay < scheduledMinuteOfDay) {
    return null;
  }

  return toIsoStringForChicagoLocal({
    ...parts,
    hour: schedule.hour,
    minute: schedule.minute
  });
}

function getNextRunAt(schedule, now = new Date()) {
  if (!schedule.enabled) {
    return null;
  }

  const parts = getCurrentCentralTimeParts(now);
  const currentMinuteOfDay = parts.hour * 60 + parts.minute;
  const scheduledMinuteOfDay = schedule.hour * 60 + schedule.minute;

  if (schedule.frequency === 'daily') {
    if (currentMinuteOfDay < scheduledMinuteOfDay) {
      return buildNextRunLocal(parts, 0, schedule);
    }
    return buildNextRunLocal(parts, 1, schedule);
  }

  let dayDelta = (schedule.dayOfWeek - parts.weekday + 7) % 7;
  if (dayDelta === 0 && currentMinuteOfDay >= scheduledMinuteOfDay) {
    dayDelta = 7;
  }

  return buildNextRunLocal(parts, dayDelta, schedule);
}

function buildNextRunLocal(parts, dayDelta, schedule) {
  const baseUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayDelta, 12, 0, 0));
  return toIsoStringForChicagoLocal({
    year: baseUtc.getUTCFullYear(),
    month: baseUtc.getUTCMonth() + 1,
    day: baseUtc.getUTCDate(),
    hour: schedule.hour,
    minute: schedule.minute
  });
}

function getScheduledYears(schedule, now = new Date()) {
  const currentYear = getCurrentCentralTimeParts(now).year;
  const years = [currentYear];
  if (schedule.syncPreviousYear) {
    years.unshift(currentYear - 1);
  }
  return years;
}

function buildSpreadsheetUrl(spreadsheetId) {
  if (!spreadsheetId) {
    return null;
  }
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

async function getLedgerSheetsStatus() {
  const config = getLedgerSheetsConfig();
  const schedule = await getScheduleSettings();
  const lastRun = await getLastRunState();

  return {
    environment: config.environment,
    environmentLabel: config.environmentLabel,
    spreadsheetName: config.spreadsheetName,
    spreadsheetId: config.spreadsheetId || null,
    spreadsheetUrl: buildSpreadsheetUrl(config.spreadsheetId),
    folderConfigured: Boolean(config.folderId),
    schedulerAvailable: config.exportEnabled,
    oauthConfigured: Boolean(config.clientId && config.clientSecret && config.refreshToken),
    schedule: {
      ...schedule,
      nextRunAt: getNextRunAt(schedule)
    },
    lastRun
  };
}

async function runLedgerSheetsExport({ mode, scheduleOverride, requestedBy, scheduledSlot = null, logger = console }) {
  if (activeRunPromise) {
    throw new Error('A ledger Sheets export is already running. Please wait for it to finish.');
  }

  const config = getLedgerSheetsConfig();
  const activeSchedule = scheduleOverride || await getScheduleSettings();

  let years;
  if (mode === 'full') {
    years = [];
  } else if (mode === 'scheduled' || mode === 'sync') {
    years = getScheduledYears(activeSchedule);
  } else {
    throw new Error(`Unsupported export mode: ${mode}`);
  }

  const startedAt = new Date().toISOString();
  const runContext = {
    mode,
    requestedBy: requestedBy || null,
    startedAt,
    status: 'running',
    scheduledSlot
  };
  await setLastRunState(runContext);

  activeRunPromise = (async () => {
    try {
      const result = await exportLedgerToSheets({
        config,
        years,
        dryRun: false,
        logger
      });

      const completedState = {
        ...runContext,
        status: 'success',
        finishedAt: new Date().toISOString(),
        spreadsheetId: result.spreadsheetId,
        spreadsheetName: result.spreadsheetName,
        exportedYears: result.exportedYears
      };
      await setLastRunState(completedState);
      return completedState;
    } catch (error) {
      const failedState = {
        ...runContext,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: error.message
      };
      await setLastRunState(failedState);
      throw error;
    } finally {
      activeRunPromise = null;
    }
  })();

  return activeRunPromise;
}

module.exports = {
  DEFAULT_SCHEDULE,
  getLastRunState,
  getLatestDueSlot,
  getLedgerSheetsStatus,
  getScheduleSettings,
  getScheduledYears,
  getNextRunAt,
  normalizeSchedule,
  runLedgerSheetsExport,
  saveScheduleSettings,
  setLastRunState
};
