import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useI18n } from '../../i18n/I18nProvider';

export interface AnnouncementFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  title_ti?: string;
  description_ti?: string;
}

interface Props {
  initial?: AnnouncementFormData & { id?: string };
  busy: boolean;
  error: string | null;
  onSave: (data: AnnouncementFormData) => void;
  onClose: () => void;
}

const AnnouncementFormModal: React.FC<Props> = ({ initial, busy, error, onSave, onClose }) => {
  const { dict } = useI18n();
  const od = dict.outreachDashboard;
  const [title, setTitle] = useState(initial?.title || '');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');
  const [titleTi, setTitleTi] = useState(initial?.title_ti || '');
  const [descriptionTi, setDescriptionTi] = useState(initial?.description_ti || '');
  const [tiSectionOpen, setTiSectionOpen] = useState(!!initial?.title_ti);

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: initial?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    onSave({
      title: title.trim(),
      description: editor?.getHTML() || '',
      start_date: startDate,
      end_date: endDate,
      title_ti: titleTi.trim() || undefined,
      description_ti: descriptionTi.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          {initial?.id ? od.announcements.modalEditTitle : od.announcements.modalCreateTitle}
        </h2>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.titleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.startDateLabel}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.endDateLabel}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.descriptionLabel}</label>
            {/* TipTap toolbar */}
            <div className="border rounded-t flex gap-1 px-2 py-1 bg-gray-50">
              {[
                { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
                { label: '• List', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                { label: '1. List', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.action}
                  className={`px-2 py-0.5 text-xs rounded ${btn.active ? 'bg-primary-200 font-bold' : 'hover:bg-gray-200'}`}
                >{btn.label}</button>
              ))}
            </div>
            <EditorContent
              editor={editor}
              className="border border-t-0 rounded-b min-h-[120px] px-3 py-2 text-sm prose max-w-none focus:outline-none"
            />
          </div>
          {/* Tigrinya translation section */}
          <div className="border rounded p-3 bg-gray-50">
            <button
              type="button"
              onClick={() => setTiSectionOpen(o => !o)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 w-full text-left"
            >
              <i className={`fas fa-chevron-${tiSectionOpen ? 'down' : 'right'} text-xs`}></i>
              {od.announcements.tigrinyaSectionToggle}
            </button>
            {tiSectionOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.titleTiLabel}</label>
                  <input
                    type="text"
                    value={titleTi}
                    onChange={e => setTitleTi(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                    dir="auto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.descriptionTiLabel}</label>
                  <textarea
                    value={descriptionTi}
                    onChange={e => setDescriptionTi(e.target.value)}
                    rows={4}
                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 resize-y"
                    dir="auto"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
              {od.addWelcomeNote.cancel}
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400">
              {busy ? od.addWelcomeNote.saving : od.announcements.saveButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnnouncementFormModal;
