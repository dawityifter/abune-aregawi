import React, { useContext, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageContext } from '../../contexts/LanguageContext';

interface EmailRecipient {
  id: number;
  name: string;
  email?: string;
  reason?: string;
  error?: string;
}

interface EmailPreviewData {
  subject: string;
  body: string;
  recipients: EmailRecipient[];
  skipped: EmailRecipient[];
  recipientCount: number;
  skippedCount: number;
}

interface MeetingEmailModalProps {
  departmentId: string;
  meetingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}

const MeetingEmailModal: React.FC<MeetingEmailModalProps> = ({
  departmentId,
  meetingId,
  isOpen,
  onClose,
  onSent
}) => {
  const { t } = useContext(LanguageContext)!;
  const { firebaseUser } = useAuth();
  const [preview, setPreview] = useState<EmailPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setError(null);
      return;
    }

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await firebaseUser?.getIdToken();
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/meetings/${meetingId}/email-preview`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || t('meeting.email.previewFailed'));
        }

        setPreview(result.data);
      } catch (err: any) {
        setError(err.message || t('meeting.email.previewFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [departmentId, firebaseUser, isOpen, meetingId, t]);

  const handleSend = async () => {
    if (!preview) return;

    try {
      setSending(true);
      setError(null);
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/meetings/${meetingId}/email-members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: preview.subject,
            body: preview.body
          })
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Failed to send meeting email');
      }

      onSent(result.message || `${preview.recipientCount} email(s) sent.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send meeting email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const skippedReasonLabel = (reason?: string) => {
    if (reason === 'invalid_email') return t('meeting.email.reason.invalid');
    return t('meeting.email.reason.missing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('meeting.email.modalTitle')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('meeting.email.sentSummary')}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={t('meeting.email.cancel')}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary-700"></div>
              <p>{t('meeting.email.previewFailed')}...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {preview && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
                      <div className="text-sm font-semibold text-green-800">{t('meeting.email.recipients')}</div>
                      <div className="mt-2 text-3xl font-bold text-green-900">{preview.recipientCount}</div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <div className="text-sm font-semibold text-amber-800">{t('meeting.email.skipped')}</div>
                      <div className="mt-2 text-3xl font-bold text-amber-900">{preview.skippedCount}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-700">{t('meeting.email.subject')}</div>
                    <p className="mt-2 text-sm text-gray-900">{preview.subject}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-700">{t('meeting.email.body')}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{preview.body}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-700">{t('meeting.email.recipients')}</div>
                      <span className="text-xs text-gray-500">{preview.recipientCount}</span>
                    </div>
                    {preview.recipients.length > 0 ? (
                      <div className="space-y-2">
                        {preview.recipients.map((recipient) => (
                          <div key={recipient.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                            <span className="text-sm font-medium text-gray-900">{recipient.name}</span>
                            <span className="text-sm text-gray-600">{recipient.email}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{t('meeting.email.noRecipients')}</p>
                    )}
                  </div>

                  {preview.skipped.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-amber-900">{t('meeting.email.skipped')}</div>
                        <span className="text-xs text-amber-700">{preview.skippedCount}</span>
                      </div>
                      <div className="space-y-2">
                        {preview.skipped.map((recipient) => (
                          <div key={recipient.id} className="rounded-lg bg-white/70 px-3 py-2">
                            <div className="text-sm font-medium text-gray-900">{recipient.name}</div>
                            <div className="text-xs text-amber-800">
                              {recipient.email ? `${recipient.email} • ` : ''}{skippedReasonLabel(recipient.reason)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t('meeting.email.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={loading || sending || !preview || preview.recipientCount === 0}
            className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? t('meeting.email.sending') : t('meeting.email.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingEmailModal;
