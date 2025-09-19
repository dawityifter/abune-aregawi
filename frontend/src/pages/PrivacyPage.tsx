import React from 'react';

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-blue max-w-none">
          <p>
            Abune Aregawi Church ("we", "us", "our") respects your privacy. This Privacy Policy describes how we collect,
            use, and share information about you when you interact with our website, services, and communications, including
            SMS notifications. This policy is designed to satisfy industry best practices and messaging program requirements
            (including Twilio A2P) by clearly explaining our data practices and your choices.
          </p>

          <h2>Information We Collect</h2>
          <ul>
            <li><strong>Contact Information</strong> such as your name, phone number, email, and postal address.</li>
            <li><strong>Account Information</strong> such as your Firebase UID and basic profile details.</li>
            <li><strong>Donation and Payment Details</strong> as necessary to process contributions (handled by trusted payment processors such as Stripe).</li>
            <li><strong>Usage Information</strong> such as pages visited and interactions with our services, collected via standard analytics.</li>
            <li><strong>Communications Preferences</strong> including SMS consent status and opt-in/opt-out records.</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <ul>
            <li><strong>Membership and Community Services</strong> to create and manage your member profile and participation.</li>
            <li><strong>Donations and Dues</strong> to process payments, send receipts, and maintain contribution records.</li>
            <li><strong>Communications</strong> to send church updates and event reminders via SMS, email, or phone (with your consent where required).</li>
            <li><strong>Security and Compliance</strong> to protect our community, prevent fraud, and comply with legal obligations.</li>
          </ul>

          <h2>SMS Messaging Disclosure</h2>
          <p>
            By providing your phone number and opting in, you consent to receive SMS notifications from Abune Aregawi Church
            about church events and reminders. Message frequency may vary. Message and data rates may apply. Consent is not a
            condition of any purchase. You may reply <strong>HELP</strong> for help and <strong>STOP</strong> to unsubscribe
            at any time. We may send a final message to confirm your opt-out.
          </p>

          <h2>Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share information with trusted service providers solely to
            operate our services, such as:
          </p>
          <ul>
            <li><strong>Authentication</strong> and identity management (e.g., Firebase).</li>
            <li><strong>Messaging</strong> providers to deliver SMS (e.g., Twilio or its resellers) and email.</li>
            <li><strong>Payment Processing</strong> to handle donations and dues (e.g., Stripe).</li>
            <li><strong>Hosting and Analytics</strong> to operate and improve our website.</li>
          </ul>
          <p>
            These providers are bound by agreements to protect your information and use it only for the services we request.
          </p>

          <h2>Data Retention</h2>
          <p>
            We retain information for as long as necessary to provide our services, meet legal and accounting obligations, and
            maintain accurate contribution records. When no longer needed, we will securely delete or anonymize the data.
          </p>

          <h2>Your Choices and Rights</h2>
          <ul>
            <li><strong>Opt-Out of SMS</strong> by replying <strong>STOP</strong> to any message.</li>
            <li><strong>Manage Communications</strong> by updating your preferences in your profile or contacting us.</li>
            <li><strong>Access/Update</strong> your information by contacting the church office.</li>
            <li><strong>Delete</strong> certain information subject to legal and record-keeping requirements.</li>
          </ul>

          <h2>Security</h2>
          <p>
            We implement reasonable administrative, technical, and physical safeguards to protect personal information. No
            method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2>Children's Privacy</h2>
          <p>
            Our services are intended for a general audience. For minors involved in church programs, parent/guardian consent
            is required where appropriate. We do not knowingly collect personal information from children without appropriate consent.
          </p>

          <h2>International Users</h2>
          <p>
            Our services are operated in the United States. If you access the services from outside the U.S., you understand
            that your information may be transferred to and processed in the U.S. where data protection laws may differ.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will revise the "Last updated" date above and, where
            appropriate, provide additional notice.
          </p>

          <h2>Contact Us</h2>
          <p>
            For questions about this Privacy Policy or our data practices, please contact:
          </p>
          <p>
            Abune Aregawi Church<br/>
            1621 S Jupiter Rd, Garland, TX 75042<br/>
            Email: abunearegawitx@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
