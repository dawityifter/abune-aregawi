import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import AnnouncementFormModal, { AnnouncementFormData } from './AnnouncementFormModal';

interface Announcement {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled';
}

type FilterStatus = 'active' | 'expired' | 'cancelled' | 'all';

interface Props {
  canManage: boolean;
  getIdToken: () => Promise<string>;
}

const AnnouncementsPanel: React.FC<Props> = ({ canManage, getIdToken }) => {
  const { dict } = useI18n();
  const od = dict.outreachDashboard;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/announcements?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setAnnouncements(data.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, getIdToken]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: AnnouncementFormData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getIdToken();
      const url = editTarget
        ? `${process.env.REACT_APP_API_URL}/api/announcements/${editTarget.id}`
        : `${process.env.REACT_APP_API_URL}/api/announcements`;
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include', body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setModalOpen(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(od.announcements.confirmCancel)) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/announcements/${id}/cancel`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to cancel');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const statusBadge = (a: Announcement) => {
    const today = new Date().toISOString().split('T')[0];
    if (a.status === 'cancelled') return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{od.announcements.statusCancelled}</span>;
    if (a.end_date < today) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">{od.announcements.statusExpired}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{od.announcements.statusActive}</span>;
  };

  const filters: { label: string; value: FilterStatus }[] = [
    { label: od.announcements.statusActive, value: 'active' },
    { label: od.announcements.statusExpired, value: 'expired' },
    { label: od.announcements.statusCancelled, value: 'cancelled' },
    { label: od.announcements.filterAll, value: 'all' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm ${filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {canManage && (
          <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-2">
            <i className="fas fa-plus"></i> {od.announcements.addButton}
          </button>
        )}
      </div>

      {loading && <div className="text-sm text-gray-500">{od.loadingMembers}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && announcements.length === 0 && (
        <div className="text-sm text-gray-500">{od.announcements.noAnnouncements}</div>
      )}

      {!loading && announcements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[od.announcements.columns.title, od.announcements.columns.dates, od.announcements.columns.status, od.announcements.columns.actions].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {announcements.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{a.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{a.start_date} – {a.end_date}</td>
                  <td className="px-4 py-2">{statusBadge(a)}</td>
                  <td className="px-4 py-2 text-sm whitespace-nowrap">
                    {canManage && a.status !== 'cancelled' && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditTarget(a); setModalOpen(true); }}
                          className="text-primary-600 hover:underline">{od.announcements.editButton}</button>
                        <button onClick={() => handleCancel(a.id)}
                          className="text-red-600 hover:underline">{od.announcements.cancelButton}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AnnouncementFormModal
          initial={editTarget ? { ...editTarget } : undefined}
          busy={saving}
          error={saveError}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
};

export default AnnouncementsPanel;
