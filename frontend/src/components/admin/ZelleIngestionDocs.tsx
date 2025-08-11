import React from 'react';
import { Link } from 'react-router-dom';

const ZelleIngestionDocs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Zelle Ingestion Guide</h1>
          <p className="mt-2 text-gray-600">How Zelle payments are ingested from Gmail, reconciled, and secured.</p>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
            <p className="mt-2 text-gray-700">
              The system ingests Zelle payment notifications sent to the church Gmail account (Chase/Zelle). We parse key
              fields from Gmail, preview candidates, and allow Treasurer/Admin to reconcile unmatched payments by creating
              Transactions in our canonical ledger.
            </p>
            <ul className="mt-3 list-disc ml-6 text-gray-700">
              <li><strong>Preview</strong>: Safe, read-only list of parsed candidates (no DB writes).</li>
              <li><strong>Sync</strong>: Insert-only upsert that writes new Transactions when a member match is found.</li>
              <li><strong>Reconciliation</strong>: Manually assign a member and create a Transaction for unmatched items.</li>
              <li><strong>Idempotency</strong>: Enforced by <code>transactions.external_id</code> uniqueness.</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Security & Access</h2>
            <ul className="mt-2 list-disc ml-6 text-gray-700">
              <li>All Zelle API routes are protected by Firebase Auth and role checks.</li>
              <li>Allowed roles: <code>treasurer</code> and <code>admin</code>.</li>
              <li>Routes mounted under <code>/api/zelle</code> in the backend.</li>
            </ul>
            <pre className="mt-4 p-3 bg-gray-900 text-gray-100 rounded overflow-auto text-sm"><code>{`// backend/src/routes/zelleRoutes.js
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

// Preview (read-only)
GET /api/zelle/preview/gmail?limit=10

// Manual sync (insert-only)
GET /api/zelle/sync/gmail?dryRun=true

// Reconcile (create Transaction)
POST /api/zelle/reconcile/create-transaction`}</code></pre>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Gmail Parsing & Ingestion</h2>
            <p className="mt-2 text-gray-700">
              The Gmail poller parses Zelle notification messages and extracts amount, date, sender email,
              memo phone, and Gmail <code>messageId</code>. The <code>external_id</code> is set to a stable value (e.g., <code>gmail:&lt;messageId&gt;</code>)
              to guarantee idempotency.
            </p>
            <ul className="mt-3 list-disc ml-6 text-gray-700">
              <li><strong>Preview</strong>: Returns parsed items and whether a Transaction would be created, but makes no changes.</li>
              <li><strong>Sync</strong>: Creates Transactions only if a member match is found (by email or phone).</li>
              <li><strong>Status</strong>: Zelle Transactions are created with <code>status = 'succeeded'</code> and <code>payment_method = 'zelle'</code>.</li>
            </ul>
            <div className="mt-3 text-sm text-gray-600">
              Source: <code>backend/src/services/gmailZelleIngest.js</code>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Reconciliation Workflow</h2>
            <ol className="mt-2 list-decimal ml-6 text-gray-700">
              <li>Open Treasurer Dashboard → Zelle Review tab.</li>
              <li>Review preview candidates. For unmatched items, enter the correct Member ID.</li>
              <li>Select the appropriate Payment Type (membership_due, tithe, donation, event, other).</li>
              <li>Click “Create” to post <code>POST /api/zelle/reconcile/create-transaction</code>. The list refreshes automatically.</li>
            </ol>
            <p className="mt-3 text-gray-700">
              The backend enforces insert-only behavior: if the same <code>external_id</code> already exists, the API returns 409 and no data is changed.
            </p>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Backfill Strategy</h2>
            <ul className="mt-2 list-disc ml-6 text-gray-700">
              <li>After member data is fully populated, re-run ingestion over a larger window (e.g., by month) to capture older payments.</li>
              <li>Use preview for safety, then perform sync in batches to respect Gmail quotas.</li>
              <li>Replay-safe due to <code>external_id</code> uniqueness; existing Transactions are never modified.</li>
              <li>Optional: Import CSVs from the bank for older periods using synthetic external IDs (e.g., <code>chase:&lt;file&gt;:&lt;row&gt;</code>).</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Troubleshooting</h2>
            <ul className="mt-2 list-disc ml-6 text-gray-700">
              <li><strong>Auth errors</strong>: Ensure you are signed in and your role is Treasurer or Admin.</li>
              <li><strong>403/401</strong>: Firebase token missing/expired or insufficient role.</li>
              <li><strong>409 on reconcile</strong>: Duplicate <code>external_id</code> already exists; no action needed.</li>
              <li><strong>Parsing issues</strong>: Check Gmail template changes and <code>gmailZelleIngest.js</code> parsing logic.</li>
              <li><strong>Timezone/amount</strong>: Verify <code>payment_date</code> format and amount parsing for older templates.</li>
            </ul>
          </section>

          <div className="flex items-center justify-between">
            <Link to="/treasurer" className="text-blue-600 hover:text-blue-700">← Back to Treasurer Dashboard</Link>
            <a
              href="/api-docs"
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={(e) => e.preventDefault()}
              title="API docs coming soon"
            >
              API docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZelleIngestionDocs;
