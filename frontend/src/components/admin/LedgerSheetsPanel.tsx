import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

type Frequency = 'daily' | 'weekly';

interface ScheduleSettings {
  enabled: boolean;
  frequency: Frequency;
  dayOfWeek: number;
  hour: number;
  minute: number;
  syncPreviousYear: boolean;
  nextRunAt?: string | null;
}

interface LastRunState {
  status?: 'running' | 'success' | 'failed';
  mode?: 'full' | 'sync' | 'scheduled';
  requestedBy?: string | null;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  exportedYears?: number[];
}

interface LedgerSheetsStatus {
  environment: string;
  environmentLabel: string;
  spreadsheetName: string;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  folderConfigured: boolean;
  schedulerAvailable: boolean;
  oauthConfigured: boolean;
  schedule: ScheduleSettings;
  lastRun: LastRunState | null;
}

const DEFAULT_FORM: ScheduleSettings = {
  enabled: false,
  frequency: 'weekly',
  dayOfWeek: 0,
  hour: 2,
  minute: 0,
  syncPreviousYear: true
};

const dayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const LedgerSheetsPanel: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<LedgerSheetsStatus | null>(null);
  const [form, setForm] = useState<ScheduleSettings>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<'full' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!firebaseUser) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await firebaseUser.getIdToken(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/ledger-sheets`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to load ledger export settings');
      }

      setStatus(payload.data);
      setForm({
        enabled: Boolean(payload.data?.schedule?.enabled),
        frequency: payload.data?.schedule?.frequency === 'daily' ? 'daily' : 'weekly',
        dayOfWeek: Number(payload.data?.schedule?.dayOfWeek ?? 0),
        hour: Number(payload.data?.schedule?.hour ?? 2),
        minute: Number(payload.data?.schedule?.minute ?? 0),
        syncPreviousYear: payload.data?.schedule?.syncPreviousYear !== false
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load ledger export settings');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const scheduleTime = useMemo(
    () => `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}`,
    [form.hour, form.minute]
  );

  const handleSaveSchedule = async () => {
    if (!firebaseUser) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const token = await firebaseUser.getIdToken(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/ledger-sheets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to save ledger export schedule');
      }

      setStatus(payload.data);
      setSuccessMessage('Ledger export schedule saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save ledger export schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (mode: 'full' | 'sync') => {
    if (!firebaseUser) {
      return;
    }

    try {
      setRunningAction(mode);
      setError(null);
      setSuccessMessage(null);
      const token = await firebaseUser.getIdToken(true);
      const endpoint = mode === 'full' ? 'export' : 'sync';
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/ledger-sheets/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to run ledger export');
      }

      setSuccessMessage(
        mode === 'full'
          ? 'Full ledger export completed.'
          : 'Ledger sync completed.'
      );
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to run ledger export');
    } finally {
      setRunningAction(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.tabs.backups')}</h2>
            <p className="mt-1 text-gray-600">
              Export ledger entries to Google Sheets, sync the current year on demand, and control the recurring schedule.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleRun('full')}
              disabled={runningAction !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md font-medium"
            >
              {runningAction === 'full' ? 'Exporting...' : 'Run Full Export'}
            </button>
            <button
              type="button"
              onClick={() => handleRun('sync')}
              disabled={runningAction !== null}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-md font-medium"
            >
              {runningAction === 'sync' ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Environment</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{status?.environmentLabel || status?.environment}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Spreadsheet</dt>
            <dd className="mt-1 text-sm text-gray-900 break-words">{status?.spreadsheetName || 'Not configured'}</dd>
            {status?.spreadsheetUrl && (
              <a href={status.spreadsheetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700">
                Open spreadsheet
              </a>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Google Access</dt>
            <dd className="mt-1 text-sm text-gray-900">
              OAuth: {status?.oauthConfigured ? 'Configured' : 'Missing'}
            </dd>
            <dd className="mt-1 text-sm text-gray-900">
              Folder: {status?.folderConfigured ? 'Configured' : 'Missing'}
            </dd>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <dt className="text-sm font-medium text-gray-500">Last Run</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {status?.lastRun?.status ? `${status.lastRun.status} (${status.lastRun.mode || 'manual'})` : 'No runs yet'}
            </dd>
            {status?.lastRun?.finishedAt && (
              <dd className="mt-1 text-xs text-gray-500">{new Date(status.lastRun.finishedAt).toLocaleString()}</dd>
            )}
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Scheduled Sync</h3>
            <p className="mt-1 text-sm text-gray-600">
              The scheduler runs inside the backend server process. Keep it enabled only in the environment that should own the recurring job.
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${status?.schedulerAvailable ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {status?.schedulerAvailable ? 'Server Scheduler Enabled' : 'Server Scheduler Disabled'}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-900">Enable scheduled sync</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
              <select
                value={form.frequency}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  frequency: event.target.value === 'daily' ? 'daily' : 'weekly'
                }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            {form.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Day of week</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    dayOfWeek: Number(event.target.value)
                  }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  {dayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time (America/Chicago)</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(event) => {
                  const [hour, minute] = event.target.value.split(':').map(Number);
                  setForm((current) => ({
                    ...current,
                    hour: Number.isFinite(hour) ? hour : current.hour,
                    minute: Number.isFinite(minute) ? minute : current.minute
                  }));
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.syncPreviousYear}
                onChange={(event) => setForm((current) => ({ ...current, syncPreviousYear: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">Also sync the previous year tab</span>
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">Current Schedule Summary</h4>
            <p className="mt-3 text-sm text-gray-700">
              {form.enabled
                ? form.frequency === 'weekly'
                  ? `Runs every ${dayOptions.find((day) => day.value === form.dayOfWeek)?.label} at ${scheduleTime} Central time.`
                  : `Runs every day at ${scheduleTime} Central time.`
                : 'Scheduled sync is currently disabled.'}
            </p>
            <p className="mt-3 text-sm text-gray-700">
              Sync scope: {form.syncPreviousYear ? 'current year and previous year' : 'current year only'}
            </p>
            <p className="mt-3 text-sm text-gray-700">
              Next run: {status?.schedule?.nextRunAt ? new Date(status.schedule.nextRunAt).toLocaleString() : 'Not scheduled'}
            </p>
            {status?.lastRun?.error && (
              <p className="mt-3 text-sm text-red-700">
                Last error: {status.lastRun.error}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-4 py-2 rounded-md font-medium"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LedgerSheetsPanel;
