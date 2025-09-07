import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatE164ToDisplay } from '../../utils/formatPhoneNumber';

interface ModalWelcomeNoteProps {
  memberId: number | string;
  memberName: string;
  memberPhone?: string;
  busy?: boolean;
  error?: string | null;
  onClose: (success: boolean, note?: string) => void;
}

const MAX_CHARS = 2000;

const ModalWelcomeNote: React.FC<ModalWelcomeNoteProps> = ({ memberId, memberName, memberPhone, busy = false, error = null, onClose }) => {
  const { firebaseUser } = useAuth();
  const [note, setNote] = useState('');
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const trimmed = useMemo(() => note.trim(), [note]);
  const remaining = MAX_CHARS - note.length;
  const canSave = trimmed.length >= 3 && trimmed.length <= MAX_CHARS && !busy;

  useEffect(() => {
    // focus textarea when modal opens
    const el = document.getElementById('welcome-note-textarea') as HTMLTextAreaElement | null;
    if (el) el.focus();
  }, []);

  // Load member profile summary for outreach review
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!firebaseUser) { setProfileLoading(false); return; }
      setProfileLoading(true);
      setProfileError(null);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${encodeURIComponent(String(memberId))}`, {
          headers: {
            Authorization: `Bearer ${idToken}`
          },
          credentials: 'include'
        });
        if (!resp.ok) {
          throw new Error(`Failed to load profile (${resp.status})`);
        }
        const data = await resp.json();
        const memberObj = (data && (data.data?.member || data.member)) || null;
        const payload = memberObj || data?.data || data || null;
        if (!cancelled) setProfile(payload);
      } catch (e: any) {
        if (!cancelled) setProfileError(e?.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [firebaseUser, memberId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Add Welcome Note</h3>
          <p className="text-sm text-gray-600 mt-1">for {memberName}{memberPhone ? ` (${memberPhone})` : ''}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Profile Summary */}
          {!profileLoading && profile && (
            <div className="border rounded-md p-3 bg-gray-50">
              <div className="text-sm font-medium text-gray-900 mb-2">Member Summary</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {/* Name */}
                <div>
                  <span className="text-gray-500">Name: </span>
                  <span className="text-gray-900">
                    {(profile.firstName || profile.first_name || '')}
                    {profile.middleName || profile.middle_name ? ` ${(profile.middleName || profile.middle_name)}` : ''}
                    {profile.lastName || profile.last_name ? ` ${(profile.lastName || profile.last_name)}` : ''}
                  </span>
                </div>
                {/* Phone */}
                <div>
                  <span className="text-gray-500">Phone: </span>
                  <span className="text-gray-900">
                    {formatE164ToDisplay(profile.phoneNumber || profile.phone_number || '') || '—'}
                  </span>
                </div>
                {/* Email */}
                <div>
                  <span className="text-gray-500">Email: </span>
                  <span className="text-gray-900">{profile.email || '—'}</span>
                </div>
                {/* Yearly Pledge */}
                <div>
                  <span className="text-gray-500">Yearly Pledge: </span>
                  <span className="text-gray-900">{profile.yearlyPledge ?? profile.yearly_pledge ?? 'Not set'}</span>
                </div>
                {/* Address */}
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Address: </span>
                  <span className="text-gray-900">
                    {[
                      (profile.streetLine1 || profile.street_line1),
                      (profile.apartmentNo || profile.apartment_no),
                      (profile.city),
                      (profile.state),
                      (profile.postalCode || profile.postal_code)
                    ].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                {/* Statuses */}
                <div>
                  <span className="text-gray-500">Registration: </span>
                  <span className="text-gray-900">{profile.registrationStatus || profile.registration_status || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Household Size: </span>
                  <span className="text-gray-900">{profile.householdSize ?? profile.household_size ?? '—'}</span>
                </div>
              </div>
            </div>
          )}
          {profileLoading && (
            <div className="text-xs text-gray-500">Loading profile…</div>
          )}
          {profileError && (
            <div className="text-xs text-gray-500">Profile unavailable</div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
          <label htmlFor="welcome-note-textarea" className="block text-sm font-medium text-gray-700">
            Note (1–2000 characters)
          </label>
          <textarea
            id="welcome-note-textarea"
            className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Please note your greeting and pastoral conversation. For example: asked about their family and household details, when they moved to the Dallas–DFW area, and gently invited them to consider a yearly membership pledge as the Lord provides."
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{trimmed.length < 3 ? 'Enter at least 3 characters' : 'Looks good'}</span>
            <span>{remaining} remaining</span>
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            onClick={() => onClose(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded text-white ${canSave ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-400 cursor-not-allowed'}`}
            onClick={() => onClose(true, trimmed)}
            disabled={!canSave}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalWelcomeNote;
