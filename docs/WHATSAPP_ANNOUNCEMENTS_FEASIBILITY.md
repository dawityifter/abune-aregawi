# Posting Church Announcements to WhatsApp via Twilio — Feasibility Investigation

**Date:** 2026-08-09
**Status:** Investigation only. No code written, no project files modified.
**Question:** Can we add our Twilio number to our existing congregation WhatsApp group so priests/admins can publish an announcement from the website and have it appear in the group?

---

## A. Feasibility verdict

### 🔴 Not supported — for the flow as described

> Website → Twilio → **existing congregation WhatsApp group**

This cannot be built, at any price, through Twilio or through Meta's official APIs. It is not a
limitation of our stack, our plan tier, or our configuration. It is a structural property of how
Meta separates the consumer WhatsApp network from the WhatsApp Business Platform.

Three independent blockers each kill it on their own:

| # | Blocker | Consequence |
|---|---|---|
| 1 | Twilio's WhatsApp API has no group address type — `to:` is always `whatsapp:+<E.164>`, a single person | No way to express "send to group X" |
| 2 | Meta's Groups API (Oct 2025) only works on groups **the business itself created**, caps them at **8 participants**, and has no "add me to an existing group" endpoint | Even the native API can't reach a 250+ member group |
| 3 | A number registered to the Cloud API is **de-registered from consumer WhatsApp** | The church number cannot simultaneously be a normal group member and be API-driven |

### 🔴 Also not supported — the obvious fallback, for us specifically

> Website → Twilio → **individual WhatsApp messages to each member**

This one is technically supported by the platform but blocked **for our situation**, because:

- Church announcements categorize as **Marketing** templates under Meta's rules, and
- **Meta has blocked delivery of Marketing templates to all US (+1) phone numbers since April 1, 2025**, with no announced timeline for restoring it.

Our congregation is in Dallas. Essentially every member has a +1 number. Messages would fail with
Twilio error `63049`. This is the finding that most changes the recommendation, and it is the one
most likely to be missing from any older blog post or tutorial on this subject.

### 🟢 What *is* supported

- A **one-tap "Share to WhatsApp" hand-off** from our admin dashboard into the existing group (below, Recommendation Phase 1). Fully compliant, no Meta approval, no cost, works today.
- A **WhatsApp Channel** for one-way announcements — but posting is manual only; there is no official Channels API.
- **SMS via Twilio** — which we already have built and which has none of these restrictions.

---

## B. Why — the underlying mechanics

### B.1 There are two different WhatsApp networks

| | Consumer / WhatsApp Business **app** | WhatsApp **Business Platform** (Cloud API / Twilio) |
|---|---|---|
| Who uses it | Our congregation, our current group | Our website backend |
| Groups | Full support, up to 1,024 members | Only API-created groups, 8 members |
| How you send | A human taps in the app | HTTPS API call |
| Number registration | Number lives on a phone/app | Number is bound to a WABA, **removed from the consumer app** |

A phone number can be on **one side or the other, not both**. The moment our Twilio number is
registered as a WhatsApp sender, it stops being a consumer WhatsApp account — so it cannot be
"added to the group" the way a person's phone is. Conversely, if a human added our number to the
group from their phone today, that would only work while the number is a consumer account, at which
point Twilio has no API access to it.

This is the root cause. Everything else follows from it.

### B.2 Twilio's WhatsApp API has no group primitive

Twilio's WhatsApp send is a Programmable Messaging / Conversations call whose `To` is a single
WhatsApp user address. There is no group JID, no group SID, no `recipient_type: group`. Twilio's
WhatsApp docs describe notifications, 24-hour conversational sessions, and chatbots — nothing else.

**Careful:** Twilio publishes a Code Exchange sample literally titled *"WhatsApp Group Messaging."*
It is **not** a WhatsApp group. It is a Twilio **Conversations** room that fans out **individual 1:1
WhatsApp messages** to up to 50 participants through one business profile. Members do not see a
group; each sees a private thread with the church. It is also bound by the 24-hour session window —
"after 24 hours, the session ends and the end user will not receive any more group messages."
Anyone skimming search results will likely conclude from this page that Twilio supports groups. It
does not.

### B.3 Meta's Groups API exists — and still doesn't help us

Meta launched a real Groups API in October 2025. It is worth being precise about it, because its
existence is what makes this question genuinely worth investigating rather than dismissing.

What it actually provides:

- **Eligibility:** Official Business Account (OBA) only. Not available to WhatsApp Business *app*
  numbers, and not available to numbers onboarded through Multi-solution Conversations.
- **Max participants per group: 8.** (Consumer WhatsApp groups allow 1,024. The API number is 8.)
- Up to 10,000 such groups per business number.
- **The business creates the group.** Participants join via an invite link that the business sends
  them using an approved template. There is no endpoint to add a participant directly, and users
  cannot be added involuntarily.
- **A business cannot be added to a group a user created.** Only one API contact may be in a group,
  and an API account cannot join a group created by another API contact.
- Unsupported inside groups: calling, disappearing messages, view-once, commerce messages,
  interactive messages, editing/deleting messages, hiding the participant list.

So even on the most modern, most permissive official API: our existing group is invisible to it, and
if we recreated our congregation inside it we would need **~50 separate 8-person groups** for 400
people, each requiring every member to accept an invite link. That is not a solution.

### B.4 The Marketing-template block is the decisive constraint for a US church

Even setting groups aside entirely, the "just message all 400 members individually" approach fails
for us:

1. Business-initiated WhatsApp messages must use a **pre-approved template** (free-form text is only
   allowed inside a 24-hour window opened by the *member* messaging us first).
2. Templates are categorized by Meta as Marketing / Utility / Authentication / Service. Utility
   requires content that is "non-promotional… and specific to or requested by the user" or
   "essential or critical to the user." A fasting-season notice or event announcement does not meet
   that bar — Meta categorizes general organizational announcements as **Marketing**.
3. Meta **auto-recategorizes** templates it judges miscategorized, with as little as 1 day's notice.
   Trying to disguise announcements as Utility templates is not a workaround; it gets reclassified
   and can flag the account for categorization misuse.
4. **Meta blocks Marketing template delivery to US phone numbers** (since 2025-04-01). Twilio's own
   changelog says plainly: messages to US recipients using a marketing template fail with error
   `63049`, Meta has given no timeline for re-enabling, and Twilio recommends transitioning to
   **SMS/MMS** for US marketing reach.

Twilio — the vendor who would earn the revenue — is telling US customers to use SMS instead. That is
a strong signal.

### B.5 What about unofficial tools?

There is a visible ecosystem (Whapi.Cloud, Maytapi, WAHA, and similar) advertising WhatsApp group
*and* Channel posting APIs. These work by driving a logged-in WhatsApp Web/multi-device session
programmatically. They are not Meta products, they violate WhatsApp's Terms of Service, and the
standard failure mode is the number getting banned — which for us would mean **losing the church's
WhatsApp number and its access to the congregation group**, possibly permanently. Per the
investigation brief, these are excluded and I do not recommend them.

---

## C. Official documentation

### Twilio

- [Overview of the WhatsApp Business Platform with Twilio](https://www.twilio.com/docs/whatsapp/api) — capability surface; no group primitive
- [WhatsApp Best Practices and FAQs](https://www.twilio.com/docs/whatsapp/best-practices-and-faqs)
- [**WhatsApp Marketing Messages to U.S. Numbers No Longer Supported**](https://www.twilio.com/en-us/changelog/whatsapp-marketing-messages-to-u-s--numbers-no-longer-supported) — the decisive one
- [Error 63049: Meta chose not to deliver this WhatsApp marketing message](https://www.twilio.com/docs/api/errors/63049)
- [Code Exchange: "WhatsApp Group Messaging"](https://www.twilio.com/code-exchange/whatsapp-group-messaging) — Conversations fan-out, not a real group
- [WhatsApp sender self sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)
- [Message template approvals and statuses](https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses)
- [WhatsApp messaging pricing](https://www.twilio.com/en-us/whatsapp/pricing)

### Meta / WhatsApp

- [Groups API overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups) — OBA-only, 8 participants, invite-link joining
- [Get started with Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/get-started)
- [Group messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)
- [Marketing templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates) — US delivery pause
- [Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization) — Marketing vs Utility criteria, auto-recategorization
- [Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) — approval required, review up to 24h
- [Getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)
- [Pricing (per-message model, effective 2025-07-01)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/)
- [WhatsApp Business Policy](https://business.whatsapp.com/policy)
- [About channels on the WhatsApp Business app](https://faq.whatsapp.com/809740894165112)
- [Introducing WhatsApp Channels](https://blog.whatsapp.com/introducing-whatsapp-channels-a-private-way-to-follow-what-matters)

---

## D. Alternatives evaluated

| Option | Reaches existing group? | Official? | Automated? | Verdict for us |
|---|---|---|---|---|
| Twilio → WhatsApp group | ✗ | — | — | 🔴 Impossible |
| Meta Groups API | ✗ (new groups only, 8 people) | ✓ | ✓ | 🔴 Wrong scale |
| Twilio Conversations "group" | ✗ (1:1 fan-out, ≤50, 24h window) | ✓ | ✓ | 🔴 Wrong scale + not a group |
| WhatsApp template broadcast to members | ✗ (1:1) | ✓ | ✓ | 🔴 Marketing blocked to US numbers |
| WhatsApp Channel | ✗ (separate surface) | ✓ | ✗ manual only | 🟡 Good surface, no API |
| WhatsApp Business app + human | ✓ | ✓ | ✗ | 🟡 Status quo |
| **"Share to WhatsApp" deep link from our site** | **✓** | **✓** | 🟡 one tap | **🟢 Best fit** |
| Unofficial automation (Whapi/WAHA/etc.) | ✓ | ✗ ToS violation | ✓ | ⛔ Excluded — ban risk |
| **SMS via our existing Twilio integration** | ✗ | ✓ | ✓ | 🟢 Already built, no restrictions |

### On WhatsApp Channels specifically

The brief asks directly whether Channels are a better fit. Answering the sub-questions:

- **Could priests publish from our website into a Channel?** **No.** There is no official Channels
  API. Every result offering "Channel posting via API" is an unofficial session-hijack tool. Channel
  posts are made by a human admin in the WhatsApp app.
- **Would members need to join something different?** **Yes.** A Channel is a separate surface from a
  group. All ~400 members would have to find and follow it. Realistically this is a multi-month
  adoption effort with incomplete uptake, and elderly members are the likeliest to be missed.
- **Could we keep the group for conversation and use a Channel for announcements?** Yes, and that is
  the intended design of Channels — one-way broadcast, admins post, followers can't reply, up to 16
  co-admins. It's a genuinely good fit *editorially*. It just doesn't solve the automation problem,
  which is the actual thing being asked for. It trades "priest copies text into the group" for
  "priest copies text into the Channel," plus a migration.

**Assessment:** a Channel is worth doing eventually as a public-facing announcement surface, but it
does not justify being the answer to this investigation, and it should not displace the existing
group.

---

## E. Recommendation

The real problem to solve is **"the priest shouldn't have to retype or re-copy an announcement into
several places."** That problem is fully solvable. Only the specific mechanism in the brief
(Twilio → group) is not.

### Phase 1 — "Share to WhatsApp" from the admin dashboard ✅ recommended, do this first

After a priest saves an announcement, the dashboard shows a **Share to WhatsApp** button. It opens
WhatsApp with the fully-formatted bilingual message **pre-composed**, and the priest picks the
congregation group from their normal chat list and hits send.

```
Priest → Admin Dashboard → Create Announcement → [Share to WhatsApp]
      → WhatsApp opens, text pre-filled → pick group → Send
```

Why this is the right call:

- It is the **only compliant way to get content into the existing group**, full stop.
- **No copy/paste, no retyping, no formatting drift** — which is the actual pain point.
- Message appears from the church account members already recognize.
- **Zero cost, zero Meta approval, zero new infrastructure, no WABA, no template review.**
- Nothing to migrate; the congregation does nothing differently.
- Can also target the Channel later, or any other chat, with the same button.

Cost: one button and a URL-builder. Roughly a day of work.

The one honest limitation: it is one human tap, not full automation. Given that everything else in
this space is either impossible or bannable, one tap is a very good outcome.

### Phase 2 — Multi-channel publish, reusing what we already have ✅ recommended

Extend the announcement composer to the checkbox model from the brief:

```
Publish to:  ☑ Website   ☑ SMS   ☑ Share to WhatsApp
```

- **Website** — already works today.
- **SMS** — we already have a working Twilio SMS broadcast with recipient targeting, batching, role
  gating, and activity logging. It has **none** of WhatsApp's template, opt-in-approval, or US
  marketing restrictions, and at ~450 recipients it costs roughly **$4 per announcement**
  (~$0.0079–0.0083 per US SMS segment; bilingual text will likely be multi-segment — see below).
- **Share to WhatsApp** — Phase 1's button.

For a Dallas congregation, **SMS is the reliable automated channel and WhatsApp is the
human-in-the-loop channel.** That split is exactly what Twilio itself recommends for US audiences.

### Phase 3 — WhatsApp Channel (optional, later)

Create a Channel for public announcements, keep the existing group for conversation, and add a
"copy for Channel" action alongside the WhatsApp share. Purely additive, and only worth it if we
want a public-facing, followable announcement feed.

### Not recommended

- Registering the Twilio number as a WhatsApp sender **for this purpose**. It costs setup effort and
  Meta review, and delivers nothing we can use: it can't reach the group, and its 1:1 messages to US
  members would be blocked as Marketing. Only revisit if Meta lifts the US marketing pause **and** we
  decide 1:1 WhatsApp messaging is worth it over SMS.
- Any unofficial WhatsApp automation library. The downside is losing the church's number.

### Bilingual handling

Both phases handle English + Tigrigna the same way and without platform friction: we already store
`title`/`description` and `title_ti`/`description_ti` on the announcement, so we compose one message
containing both languages, English first, separated by a divider. No template approval is involved
in Phase 1 or in SMS, so there is no constraint on Ge'ez script, length, or line breaks beyond SMS
segment counting.

Note for SMS: Ge'ez characters force **UCS-2 encoding**, which drops the segment size to 70
characters. A bilingual announcement will be several segments. Worth showing a live segment/cost
estimate in the composer, which our SMS panel already has precedent for.

---

## F. Step-by-step setup

### Phase 1 (no external setup at all)

There is nothing to configure in Twilio or Meta. The entire feature is a URL:

```
https://wa.me/?text=<url-encoded bilingual announcement>
```

Opening this on mobile launches WhatsApp with the text pre-filled and shows a chat picker; on
desktop it opens WhatsApp Web. Steps:

1. Build the bilingual message string from the announcement record.
2. URL-encode it.
3. Render a **Share to WhatsApp** button on the announcement admin view.
4. Test on iOS, Android, and desktop, and confirm Ge'ez script survives encoding intact.
5. Have a priest post one real announcement to the group.

### Phase 2 (SMS — already configured)

Our Twilio credentials and sender are already in place and in production use. Work is limited to
wiring the announcement composer to the existing SMS send path and adding a confirmation/preview step.

### If Meta ever lifts the US marketing pause (WhatsApp sender setup, for reference)

Recorded here so we don't have to re-derive it. **Do not start this now.**

1. Meta Business Portfolio with admin access; complete **Business Verification** (can take weeks).
2. Create a WhatsApp Business Account (WABA). Twilio requires all senders in an account to share one WABA.
3. Choose the sender number. It must **not already be registered on WhatsApp** — so it cannot be a
   number currently in the congregation group. It must be able to receive an SMS or voice
   verification.
4. Complete Twilio WhatsApp self sign-up and register the sender.
5. Submit the **display name** for Meta approval. Rejection caps us at 250 business-initiated
   messages/day and Meta may disconnect the sender.
6. Pursue **Official Business Account** status if Groups API is ever relevant.
7. Create and submit message templates; review takes up to 24 hours.
8. Configure the inbound webhook and status callback URLs on the sender.
9. Collect and record **documented opt-in** from every member before sending (see below).
10. Test against the sandbox, then a small pilot group, then production.

### Credentials/config that would be required

| Value | Where from | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio console | **already set** |
| `TWILIO_AUTH_TOKEN` | Twilio console | **already set** |
| `TWILIO_PHONE_NUMBER` | Twilio console | **already set** (SMS) |
| `TWILIO_WHATSAPP_FROM` | after sender registration | `whatsapp:+1XXXXXXXXXX` — not needed for Phase 1/2 |
| `TWILIO_WHATSAPP_TEMPLATE_SID` | Twilio Content Template Builder | per approved template |
| Meta Business Portfolio ID / WABA ID | Meta Business Manager | only for direct Cloud API |
| Webhook URL | our backend | inbound + status callback |

**None of these are needed for the recommended Phases 1 and 2.**

---

## G. Compliance notes

Even though Phase 1 sidesteps the Business Platform entirely, these apply to any future WhatsApp
messaging and are good practice for our SMS today:

- **Opt-in is mandatory** for business-initiated WhatsApp messages. It must name the church, state
  what will be sent, and be recorded with timestamp and source. A phone number in our member table is
  not opt-in.
- **Opt-out must be honored** — clear instructions, and unsubscribes respected.
- **Quality rating**: blocks and spam reports throttle or pause the number. A congregation is
  forgiving, but low read-rates alone can degrade template quality status.
- **Never put member PII in template variables** beyond what's necessary; per repo policy, no real
  member data in code, tests, docs, or commits.

---

## H. What would change in our Node.js application

Our codebase is already well positioned — the announcement model and a Twilio service both exist.

### Already present

- [backend/src/models/Announcement.js](backend/src/models/Announcement.js) — already bilingual: `title`, `description`, `title_ti`, `description_ti`, plus `start_date`, `end_date`, `status`, `created_by_member_id`
- [backend/src/controllers/announcementController.js](backend/src/controllers/announcementController.js)
- [backend/src/routes/announcementRoutes.js](backend/src/routes/announcementRoutes.js)
- [backend/src/services/twilioService.js](backend/src/services/twilioService.js) — `sendSms`, plus a throttled `sendSmsBatch` (20 concurrent, 1s between batches)
- [backend/src/routes/smsRoutes.js](backend/src/routes/smsRoutes.js) — role-gated to `secretary`, `church_leadership`, `admin`, with activity logging
- [frontend/src/components/admin/AnnouncementsPanel.tsx](frontend/src/components/admin/AnnouncementsPanel.tsx)

### Phase 1 changes (small)

- **Frontend:** a `buildWhatsAppShareText(announcement)` helper that composes the bilingual body, and
  a **Share to WhatsApp** button in `AnnouncementsPanel.tsx` linking to the encoded `wa.me` URL.
- **Backend:** nothing required. Optionally a `shared_to_whatsapp_at` timestamp column so the panel
  can show which announcements have been posted.

### Phase 2 changes (moderate)

- **Backend:** an announcement→SMS publish endpoint (e.g. `POST /api/announcements/:id/publish`)
  taking the selected channels, reusing `sendSmsBatch` and the existing recipient-resolution logic
  from `smsController`. Role-gate it to the same `ALLOWED` list and wrap it in
  `activityLoggerMiddleware`.
- **Data:** a small `announcement_publications` table (announcement_id, channel, status, sent_count,
  failed_count, published_by, published_at) so we can show delivery history and prevent double-sends.
  Add via the standard sequelize-cli migration path.
- **Frontend:** the channel checkbox UI, a recipient-count and cost preview, a confirmation step, and
  a publication-history view.

### Deliberately not built

No WhatsApp sender registration, no template management, no WhatsApp webhook handling, and no group
or Channel automation — none of it would function for our congregation today.

---

## Summary

| Question | Answer |
|---|---|
| Can Twilio post to our existing WhatsApp group? | **No.** No group primitive; consumer and API networks are disjoint |
| Does Meta's Groups API help? | **No.** Business-created groups only, 8 participants max |
| Can we broadcast 1:1 to members via WhatsApp instead? | **No** — Marketing templates are blocked to US numbers since 2025-04-01 |
| Is there an official Channels API? | **No.** Manual posting only |
| Any compliant path into the existing group? | **Yes** — one-tap "Share to WhatsApp" from our dashboard |
| Best automated channel for us | **SMS**, which we have already built and which Twilio itself recommends for US reach |
| Recommended | Phase 1 share button → Phase 2 multi-channel publish (Website + SMS + WhatsApp share) → Phase 3 Channel, optional |

*Note: the brief cites both ~250 and ~450 members; sizing above assumes ~450 to be conservative.*
