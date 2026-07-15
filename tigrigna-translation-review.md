# Tigrigna Translation Review — Phase 1 (admin / stats / roles)

These 61 keys were migrated from the legacy `LanguageContext` object into
`frontend/src/i18n/dictionaries.ts`. They previously rendered **English** in
Tigrigna mode (silent fallback). Drafts below need a native-speaker check.

Legend: ✅ confident · ⚠️ please verify wording · 🔴 likely needs a better term

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| admin.panel | Admin Panel | ፓነል ኣመሓዳሪ | ✅ |
| manage.members | Manage Members | ኣባላት ኣመሓድር | ✅ |
| manage.members.and.roles | Manage members and roles | ኣባላትን ሓላፍነታትን ኣመሓድር | ✅ |
| access.admin.panel | Access Admin Panel | ናብ ፓነል ኣመሓዳሪ እተ | ✅ |
| role.management | Role Management | ምሕደራ ሓላፍነት | ✅ |
| manage.member.roles.and.permissions | Manage member roles and permissions | ሓላፍነትን ፍቓዳትን ኣባላት ኣመሓድር | ⚠️ |
| update.member.roles | Update Member Roles | ሓላፍነታት ኣባላት ኣሐድስ | ✅ |
| change.role | Change Role | ሓላፍነት ቀይር | ✅ |
| new.role | New Role | ሓድሽ ሓላፍነት | ✅ |
| current.role | Current Role | ህሉው ሓላፍነት | ✅ |
| role.descriptions | Role Descriptions | መግለጺ ሓላፍነታት | ✅ |
| update.role | Update Role | ሓላፍነት ኣሐድስ | ✅ |
| updating.role.for | Updating role for | ሓላፍነት የሐድስ ኣሎ ን | 🔴 trailing preposition reads awkwardly; verify sentence context |
| new.permissions | New Permissions | ሓደስቲ ፍቓዳት | ✅ |
| updating | Updating... | የሐድስ ኣሎ... | ✅ |
| statistics | Statistics | ስታቲስቲክስ | ⚠️ transliteration; ኣሃዛዊ መረዳእታ is an alternative |
| overview.of.church.membership | Overview of church membership | ሓፈሻዊ ትሕዝቶ ኣባልነት ቤተ ክርስቲያን | ⚠️ |
| active.members | Active Members | ንጡፋት ኣባላት | ✅ |
| total.children | Total Children | ጠቕላላ ህጻናት | ✅ |
| recent.registrations | Recent Registrations | ናይ ቀረባ እዋን ምዝገባታት | ✅ |
| role.breakdown | Role Breakdown | ኣከፋፍላ ሓላፍነት | ⚠️ "breakdown" = ኣከፋፍላ (distribution); confirm |
| gender.breakdown | Gender Breakdown | ኣከፋፍላ ጾታ | ⚠️ |
| marital.status.breakdown | Marital Status Breakdown | ኣከፋፍላ ኩነታት መርዓ | ⚠️ |
| language.preference.breakdown | Language Preference Breakdown | ኣከፋፍላ ምርጫ ቋንቋ | ⚠️ |
| membership.status | Membership Status | ኩነታት ኣባልነት | ✅ |
| members.with.children | Members with Children | ህጻናት ዘለዎም ኣባላት | ✅ |
| activity.metrics | Activity Metrics | መለክዒ ንጥፈታት | ⚠️ |
| new.registrations.30.days | New Registrations (30 days) | ሓደስቲ ምዝገባታት (30 መዓልቲ) | ✅ |
| avg.children.per.family | Avg Children per Family | ማእከላይ ህጻናት ብቤተሰብ | ⚠️ |
| active.rate | Active Rate | መጠን ንጡፋት | ⚠️ |
| quick.actions | Quick Actions | ቅልጡፍ ተግባራት | ✅ |
| export.member.list | Export Member List | ዝርዝር ኣባላት ኣውጽእ | ✅ |
| generate.report | Generate Report | ጸብጻብ ኣውጽእ | ✅ |
| send.communication | Send Communication | መልእኽቲ ስደድ | ✅ |
| refresh.statistics | Refresh Statistics | ስታቲስቲክስ ኣሐድስ | ⚠️ (see `statistics`) |
| no.data.available | No data available | ዳታ የለን | ⚠️ ዳታ is a loanword; ሓበሬታ የለን alternative |
| edit.member | Edit Member | ኣባል ኣርም | ✅ |
| search | Search | ድለ | ✅ |
| all.roles | All Roles | ኩሎም ሓላፍነታት | ✅ |
| all.statuses | All Statuses | ኩሉ ኩነታት | ✅ |
| active | Active | ንጡፍ | ✅ |
| inactive | Inactive | ዘይንጡፍ | ✅ |
| joined | Joined | ዝተጸምበረ | ⚠️ as a date column, ዝተጸምበረሉ ዕለት may read better |
| children | Children | ህጻናት | ✅ |
| current.permissions | Current Permissions | ህሉው ፍቓዳት | ✅ |
| confirm.delete.member | Are you sure you want to delete this member? | ነዚ ኣባል ክትድምስሶ ርግጸኛ ዲኻ? | ⚠️ singular/informal ዲኻ; use ዲኹም for formal/plural |
| basic.info | Basic Information | ቀንዲ ሓበሬታ | ✅ |
| contact.info | Contact Information | ሓበሬታ ርክብ | ✅ |
| street.address | Street Address | ኣድራሻ ጎደና | ✅ |
| ministries | Ministries | ኣገልግሎታት | 🔴 overlaps with "services"; consider ክፍልታት ኣገልግሎት |
| ministries.placeholder | List ministries you are interested in... | ዝግደሰሎም ኣገልግሎታት ዘርዝር... | ⚠️ |
| bank_transfer | Bank Transfer | ብባንኪ ምትሕልላፍ | ✅ |
| select.language | Select language | ቋንቋ ምረጽ | ✅ |
| english | English | እንግሊዝኛ | ✅ |
| tigrinya | Tigrinya | ትግርኛ | ✅ |
| amharic | Amharic | ኣምሓርኛ | ✅ |
| no.children.registered | No children registered | ዝተመዝገበ ህጻን የለን | ✅ |
| spiritual.father | Spiritual Father | መንፈሳዊ ኣቦ | ✅ |
| contact.address | Contact & Address | ርክብን ኣድራሻን | ✅ |
| common.edit | Edit | ኣርም | ✅ |
| common.delete | Delete | ደምስስ | ✅ |

## Phase 2a — newly wired components (drafts to review)

Full strings live in `frontend/src/i18n/dictionaries.ts` under each namespace.
Notable phrases the reviewer should check closely:

**`duesPage.*`** (DuesPage)
- `dueShort` "Due" → `ክፍሊት` — used on tiny month tiles; a shorter word may fit better.
- `stat.yearlyPledge` "Yearly Pledge" → `ዓመታዊ ቃል ኪዳን` (ቃል ኪዳን = "covenant/vow"; confirm tone).
- `months.short.*` are transliterated Gregorian abbreviations — verify spelling.

**`donatePage.*`** (DonatePage)
- `auth.template` — the full ACH/card authorization sentence; please read end-to-end for legal accuracy.
- `auth.chargeCard` / `auth.debitAccount` are phrased as "for you to charge from my card/account" to fit the sentence; verify grammar in context.
- `frequency` "Frequency" → `ድግግሞሽ` (⚠️ this is the Amharic term; confirm the Tigrigna equivalent).
- `zelle.title` "Donate via Zelle" → `ብዘለ ውፈዩ` (Zelle transliterated as ዘለ).
- `subtitle`, `questions.body` — longer sentences worth a fluency check.

**`dependentsPage.*`** (DependentsManagement)
- `title` "Spouse & Dependents" → `መጻምድትን ተጸበይትን`; `add`/`editTitle` use `ተጸባዪ` for "dependent" — confirm that's the preferred term (vs ጽግዕተኛ).
- `lastName` "Last Name *" → `ስም ኣቦሓጎ *` (grandfather's name convention) vs `middleName` → `ስም ኣቦ` (father's name); verify this matches how the church labels names.
- `errors.deleteConfirm` uses informal `ዲኻ`; switch to `ዲኹም` if formal.

**`pledgeForm.*` / `pledgeTracker.*`**
- "Pledge" rendered as `ቃል ኪዳን` throughout — long phrase; confirm acceptable or prefer a shorter term (e.g. ጻውዒት/መብጽዓ).
- `pledgeForm.eventNamePlaceholder`, `pledgeTracker.subtitle` — longer sentences worth a fluency check.

**`achPayment.*` / `stripePayment.*`**
- Banking terms transliterated: `routingNumber` → `ራውቲንግ ቁጽሪ`, `checking` → `ቸኪንግ`. Confirm whether transliteration or a descriptive Tigrigna term is preferred.
- `importantText` / `securityText` (ACH disclaimers) — please read for accuracy.
- Shared `achPayment` keys (amount/type/cancel/pay) are reused by StripePayment.

## Batch 2b — departments & meetings (drafts to review)
Newly wired: `DepartmentsPage`, `DepartmentDashboard`, `AddMeetingModal`, `AddTaskModal`,
`MeetingDetailsPage`, `MeetingEmailModal`. The `department.*` and `meeting.*` keys were
migrated from the legacy `LanguageContext` into `dictionaries.ts` (their existing ti was
kept verbatim, so only the **new** keys below are drafts).

Legend: ✅ confident · ⚠️ please verify wording · 🔴 likely needs a better term

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| departmentsPage.title | Departments & Service | ክፍልታት ስራሕን ኣገልግሎትን | ⚠️ |
| departmentsPage.subtitle | View your departments or explore opportunities to serve | ክፍልታት ስራሕኩም ርኣዩ ወይ ንኸተገልግሉ ዘኽእሉ ዕድላት ኣናድዩ | ⚠️ long sentence, verify flow |
| departmentsPage.browseTab | Browse All | ኩሎም ርአ | ⚠️ "browse" rendered as "see all" |
| departmentsPage.emptyMyDesc | You haven't joined any departments yet… | ገና ናብ ዝኾነ ክፍሊ ስራሕ ኣይተጸንበርኩምን። … | ⚠️ |
| departmentType.ministry | Ministry | ኣገልግሎት | 🔴 collides with `service` below — pick distinct church terms |
| departmentType.service | Service | ግልጋሎት | 🔴 near-synonym of `ministry`; confirm distinction |
| departmentType.committee | Committee | ኮሚቴ | ⚠️ transliteration |
| departmentType.administrative | Administrative | ምምሕዳራዊ | ✅ |
| taskStatus.pending | Not Started | ዘይተጀመረ | ⚠️ note: label is "Not Started", not "Pending" |
| taskStatus.in_progress | In Progress | ኣብ መስርሕ | ✅ |
| taskStatus.rejected | Rejected | ተነጺጉ | ✅ |
| taskPriority.urgent | Urgent | ህጹጽ | ✅ |
| taskPriority.high | High | ላዕለዋይ | ⚠️ "high" priority = ላዕለዋይ; confirm idiom |
| meetingModal.createTitle | Schedule New Meeting | ሓድሽ ኣኼባ መደብ | ⚠️ verify verb "schedule" |
| meetingModal.notes | Meeting Notes / Minutes | ቃለ ጉባኤ / ትሕዝቶ | ⚠️ |
| taskModal.objective | Objective | ዕላማ | ⚠️ same word used for meeting "Purpose" (ዕላማ); ok? |
| taskModal.assignedTo | Assigned To | ዝተመደበሉ | ⚠️ |
| taskModal.rejectedDateRequired | Rejected date is required when status is rejected | ኩነታት ተነጺጉ ኮይኑ ዝተነጽገሉ ዕለት የድሊ | ⚠️ |
| meeting.email.loadingPreview | Loading email preview… | ቅድመ እይታ ኢመይል ይጽዕን ኣሎ… | ✅ (new; fixes a slot that previously reused previewFailed) |

## Batch 2d — misc / auth (drafts to review)
Newly wired: `CreditsPage`, `ParishPulseSignUp`, `ProtectedRoute`, `LiveEmbed`,
`TransliterationHelpModal`, `RegistrationSteps` (5 remaining hardcoded strings only —
the rest already used legacy keys with ti). `Login`/`ChatWidget` had no user-facing text;
`ErrorBoundary` left in English (class component, last-resort crash fallback).

Legend: ✅ confident · ⚠️ please verify wording · 🔴 likely needs a better term

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| creditsPage.title | Tech Team / Credits | ናይ ቴክኒክ ጉጅለ / ኣፍልጦ | ⚠️ "Credits" as ኣፍልጦ |
| parishPulse.title | Parish Pulse Sign-Up | Parish Pulse ምዝገባ | ⚠️ brand name kept in English |
| parishPulse.disclaimer | (SMS consent text) | …ናይ SMS መልእኽቲ ንምቕባል ትሰማምዑ… | ⚠️ legal/consent wording — verify |
| transliterationHelp.instruction | Type the Latin characters… | ተመሳሳሊ ናይ ግእዝ ፊደል ንምርካብ… | ⚠️ dropped inline bold on Latin/Ge'ez |
| liveEmbed.mute / unmute | Mute / Unmute | ድምጺ ዕጾ / ድምጺ ክፈት | ⚠️ verify idiom |
| registration.yearlyPledgeLabel | Yearly Membership Pledge (USD) | ዓመታዊ ናይ ኣባልነት ቃል (USD) | ✅ |

## Batch 2c — admin / finance (drafts to review)
Newly wired all 12: `BankUpload`, `MonthlyBankSummary`, `ActivityLogViewer`, `MemberSearch`,
`PaymentList`, `LoansPage`, `VendorList`, `VendorFormModal`, `EmployeeList`, `EmployeeFormModal`,
`MemberDuesViewer`, `SmsBroadcast`. Many keys use `{param}` interpolation. Currency/enum
codes and month names left as data. SMS compliance footer left in English (outgoing payload,
not UI). Highest-uncertainty drafts below (the bulk of column headers / labels are ✅):

Legend: ✅ confident · ⚠️ please verify wording · 🔴 likely needs a better term

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| vendorList.typeUtility | Utility | ኣገልግሎት (ውሃ/ሓይሊ) | 🔴 no clean single term; verify |
| vendorList.typeContractor | Contractor | ተቖራጻይ | ⚠️ |
| vendorList.typeLender | Lender | ኣለቓሒ | ⚠️ |
| employeeList.freqBiWeekly | bi-weekly | ክልተ ሰሙናዊ | ⚠️ |
| employeeForm.salaryFrequency | Salary Frequency | ተደጋጋምነት ደሞዝ | ⚠️ |
| memberDues.tithes / offerings | Tithes / Offerings | ዕሽር / መባእ | ⚠️ confirm church usage |
| memberDues.systemId | System ID | መለለዪ ስርዓት | ⚠️ |
| memberDues.stableGrowth | Stable Growth | ርጉእ ዕቤት | ⚠️ (decorative label) |
| bankUpload.autoReconciled | Auto-reconciled: {count} of {examined} pending | ብቐጥታ ዝተዓረቑ፦ … | ⚠️ verify reconcile term ተዓረቐ |
| loansPage.warning | These are liability records… NOT tax-deductible. | እዚኦም ናይ ዕዳ መዛግብቲ… | ⚠️ legal phrasing — verify |
| smsBroadcast.costPrefix/segsWord | Est. Cost / segs | ግምታዊ ወጻኢ / ክፋላት | ⚠️ SMS "segment" = ክፋል; confirm |
| smsBroadcast.standardEncoding | Standard Encoding | ስሩዕ ኢንኮዲንግ | ⚠️ "encoding" transliterated |
| paymentList.filterBehind | Behind on Payments | ብክፍሊት ዝደንጎየ | ⚠️ |

## Treasurer dashboard — dues-progress metric (new keys to review)
Added an "annual progress" headline bar (collected ÷ full-year pledged) plus an
"on pace" badge (collected ÷ expected-to-date). New keys under `treasurerDashboard.stats`:

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| onPace | On pace | ፍጥነት ኣከባ | ⚠️ "pace/rate of collection" — verify |
| onPaceHelp | (tooltip: collected vs expected to date…) | ዝተኣከበ ክፍሊት ኣንጻር ክሳብ እዚ እዋን… | ⚠️ |
| pledged | pledged | ተማባጺዑ | ⚠️ confirm term for "pledged total" |

## Phase 3 — pre-existing mistranslations FIXED (in legacy `LanguageContext.tsx`, please confirm)
These legacy homepage/CTA `ti` values were semantically wrong (a different meaning, or garbled)
and have been corrected. All are `en → old ti (meaning) → new ti`:

| Key | English | Old ti (wrong) | New ti | Confidence |
|-----|---------|----------------|--------|------------|
| volunteer | Volunteer | ተጋሩ ("Tigrayans") | ወለንተኛ | ✅ |
| location | Location | ኩነታት ("status") | ቦታ | ✅ |
| address | Address | ኩነታት ("status") | ኣድራሻ | ✅ |
| get.directions | Get Directions | ኣዛምድ ("coordinate") | መገዲ ርኸብ | ✅ |
| plan.visit | Plan a Visit | ምብጻሕ ኣዘዝምድ (garbled) | ምብጻሕ መደብ | ⚠️ confirm phrasing |
| register.member | Register Member | ደምድም ኣኽትም ("conclude/seal") | ኣባል መዝግብ | ✅ |
| view.dues | View Dues / Login | ክፍሊት ርኣይ / እተኻ (typo) | ክፍሊት ርኣይ / እቶ | ✅ (login = እቶ) |
| participation | Participation Made Easy | ክፍሊት ቀሊል እዩ ("Payment is easy") | ተሳትፎ ቀሊል እዩ | ⚠️ if section is about giving, old wording may be intentional |

Note: `volunteer.desc` was already correct (ኣብ ጕጅለ ኣገልግሎትና ተጸምብር…), only the label was wrong.
