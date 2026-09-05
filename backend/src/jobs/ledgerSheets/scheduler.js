'use strict';

const { getLedgerSheetsConfig } = require('./config');
const {
  getLatestDueSlot,
  getScheduleSettings,
  getLastRunState,
  runLedgerSheetsExport,
  setLastRunState
} = require('./settingsService');

let timer = null;
let isChecking = false;
let lastTriggeredSlot = null;

async function checkLedgerSheetsSchedule(logger = console) {
  if (isChecking) {
    return;
  }

  const config = getLedgerSheetsConfig();
  if (!config.exportEnabled) {
    return;
  }

  isChecking = true;
  try {
    const schedule = await getScheduleSettings();
    if (!schedule.enabled) {
      return;
    }

    const dueSlot = getLatestDueSlot(schedule);
    if (!dueSlot) {
      return;
    }

    if (lastTriggeredSlot === dueSlot) {
      return;
    }

    const lastRun = await getLastRunState();
    if (lastRun?.status === 'success' && lastRun.scheduledSlot === dueSlot) {
      lastTriggeredSlot = dueSlot;
      return;
    }

    logger.log(`Ledger Sheets scheduler triggering run for slot ${dueSlot}`);
    lastTriggeredSlot = dueSlot;
    await runLedgerSheetsExport({
      mode: 'scheduled',
      scheduleOverride: schedule,
      requestedBy: 'scheduler',
      scheduledSlot: dueSlot,
      logger
    });
  } catch (error) {
    logger.error('Ledger Sheets scheduler check failed:', error.message);
    await setLastRunState({
      status: 'failed',
      mode: 'scheduled',
      requestedBy: 'scheduler',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: error.message
    });
  } finally {
    isChecking = false;
  }
}

function startLedgerSheetsScheduler(logger = console) {
  if (timer) {
    return timer;
  }

  logger.log('Starting Ledger Sheets scheduler loop');
  checkLedgerSheetsSchedule(logger).catch((error) => {
    logger.error('Initial Ledger Sheets scheduler check failed:', error.message);
  });

  timer = setInterval(() => {
    checkLedgerSheetsSchedule(logger).catch((error) => {
      logger.error('Recurring Ledger Sheets scheduler check failed:', error.message);
    });
  }, 60 * 1000);

  return timer;
}

function stopLedgerSheetsScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  checkLedgerSheetsSchedule,
  startLedgerSheetsScheduler,
  stopLedgerSheetsScheduler
};
