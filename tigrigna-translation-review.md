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

## Bank auto-reconcile button + deferred-upload notice (new keys to review)
Added an "Auto-reconcile pending" button in Bank Transactions (batched backlog sweep)
and a notice when a very large upload defers the inline pass:

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| bankTransactions.autoReconcile | Auto-reconcile pending | ተጸበይቲ ኣወሃህድ | ⚠️ "reconcile" as ኣወሃህድ (harmonize/match) — verify |
| bankTransactions.autoReconciling | Auto-reconciling… | የወሃህድ ኣሎ… | ⚠️ |
| bankTransactions.autoReconcileHelp | (tooltip: re-check pending vs known payers/payees/Zelle refs) | ኩሎም ተጸበይቲ ልውውጣት ኣንጻር… | ⚠️ |
| bankTransactions.autoReconcileDone | Examined {examined}…; {matched} matched or recorded | {examined} ተጸበይቲ ልውውጣት ተፈቲሾም፤… | ⚠️ |
| bankTransactions.autoReconcileFailed | Auto-reconcile failed | ኣውቶማቲክ ዕርቂ ኣይተዓወተን | ⚠️ ዕርቂ (reconciliation/peace-making) vs ምውህሃድ — pick one term consistently |
| bankUpload.autoDeferred | Large import: automatic reconciliation was skipped… | ዓቢ ምጽዓን፦… | ⚠️ |

## Member Information report (new keys to review)
New "Member Information" report type in the Payment Reports dropdown (active member
directory with spouse contact, printable with the church heading):

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| memberInfoReport.type | Member Information | ሓበሬታ ኣባላት | ✅ |
| memberInfoReport.title | Member Information Report | ጸብጻብ ሓበሬታ ኣባላት | ⚠️ |
| memberInfoReport.colSpouseFirst | Spouse First | ስም መጻምዲ | ⚠️ "spouse first name" compressed |
| memberInfoReport.colSpouseLast | Spouse Last | ስም ኣቦ መጻምዲ | ⚠️ "father name of spouse" — verify convention |
| memberInfoReport.colSpousePhone | Spouse Phone | ስልኪ መጻምዲ | ✅ |

## Household Membership Directory report (new keys to review)
New "Household Membership Directory" report type in the Reports tab with filtering,
summary statistics, and household member details. New keys under `memberReports.*` and
`householdReport.*`. Note: `householdReport.totalDependents` and `householdReport.dependentsSection`
use `ጽግዕተኛታት` (an alternative term to the existing `ተደገፍቲ` at line 2809).
Verify which term is preferred for this context.

**Task 9 update:** the report-generation filter panel (include-inactive/last-name/city/
membership-status + Generate button) was replaced with a "Sort by" (last name / first
name) control. The rows below marked REMOVED were deleted from `en`/`ti` in
`dictionaries.ts` (no remaining consumer); three new `sortBy`/`sortLastName`/`sortFirstName`
rows were added, `sortBy`'s draft still needs a native check.

Legend: ✅ confident · ⚠️ please verify wording · 🔴 likely needs a better term

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| memberReports.tab | Reports | ጸብጻባት | ⚠️ |
| memberReports.selectLabel | Report | ጸብጻብ | ⚠️ |
| memberReports.memberInformation | Member Information | ሓበሬታ ኣባላት | ✅ |
| memberReports.householdDirectory | Household Membership Directory | መዝገብ ኣባልነት ስድራቤት | ⚠️ |
| householdReport.title | Household Membership Directory | መዝገብ ኣባልነት ስድራቤት | ⚠️ |
| ~~householdReport.filters~~ | ~~Filters~~ | ~~መጻረዪታት~~ | REMOVED (Task 9) — filter panel dropped |
| ~~householdReport.includeInactive~~ | ~~Include inactive members~~ | ~~ዘይንጡፋት ኣባላት ኣካትት~~ | REMOVED (Task 9) |
| ~~householdReport.lastName~~ | ~~Last name~~ | ~~ስም ኣቦ~~ | REMOVED (Task 9) — superseded by `sortLastName` |
| ~~householdReport.city~~ | ~~City~~ | ~~ከተማ~~ | REMOVED (Task 9) |
| ~~householdReport.membershipStatus~~ | ~~Membership status~~ | ~~ኩነታት ኣባልነት~~ | REMOVED (Task 9) |
| ~~householdReport.anyStatus~~ | ~~Any~~ | ~~ኩሉ~~ | REMOVED (Task 9) |
| ~~householdReport.statusPending~~ | ~~Pending~~ | ~~ዝጽበ~~ | REMOVED (Task 9) |
| ~~householdReport.statusComplete~~ | ~~Complete~~ | ~~ዝተዛዘመ~~ | REMOVED (Task 9) |
| ~~householdReport.statusIncomplete~~ | ~~Incomplete~~ | ~~ዘይተዛዘመ~~ | REMOVED (Task 9) |
| ~~householdReport.generate~~ | ~~Generate~~ | ~~ኣውጽእ~~ | REMOVED (Task 9) |
| householdReport.sortBy | Sort by | ብ... ሰርዕ | ⚠️ new (Task 9) — please verify wording, feels incomplete on its own |
| householdReport.sortLastName | Last name | ስም ኣቦ | ✅ new (Task 9) — reuses the previous `lastName` draft |
| householdReport.sortFirstName | First name | ቀዳማይ ስም | ⚠️ new (Task 9) |
| householdReport.savePdf | Save as PDF | ከም PDF ኣቐምጥ | ⚠️ |
| householdReport.summaryTitle | Membership Summary | ጽማቕ ኣባልነት | ✅ |
| householdReport.totalFamilies | Total Families | ጠቕላላ ስድራቤታት | ✅ |
| householdReport.totalParishMembers | Total Parish Members | ጠቕላላ ኣባላት ቤተ ክርስቲያን | ⚠️ |
| householdReport.totalHeads | Heads of Household | ሓለፍቲ ስድራቤት | ⚠️ |
| householdReport.totalSpouses | Spouses | መጻምድቲ | ✅ |
| householdReport.totalDependents | Dependents | ጠቕላላ ተደገፍቲ | ✅ uses established term from line 2837 |
| householdReport.generatedOn | Generated on | ዝተፈጥረሉ ዕለት | ✅ |
| householdReport.generatedBy | Generated by | ዘውጽኦ | ⚠️ |
| householdReport.headOfHousehold | Head of Household | ሓላፊ ስድራቤት | ✅ |
| householdReport.spouse | Spouse | መጻምዲ | ✅ |
| householdReport.dependentsSection | Dependents | ተደገፍቲ | ✅ uses established term from line 2849 |
| householdReport.householdMembers | Household Members | ኣባላት ስድራቤት | ✅ |
| householdReport.mobile | Mobile | ሞባይል | ⚠️ transliteration |
| householdReport.memberId | Member ID | መለለዪ ኣባል | ✅ |
| householdReport.noResults | No households found. | ስድራቤት ኣይተረኽበን። | ⚠️ reworded (Task 9) — no longer references "filters" |
| householdReport.page | Page | ገጽ | ✅ |
| householdReport.of | of | ካብ | ⚠️ "of" in pagination context; verify idiom |
| householdReport.previous | Previous | ዝሓለፈ | ✅ |
| householdReport.next | Next | ቀጻሊ | ✅ |
| ~~householdReport.loading~~ | ~~Loading...~~ | ~~ይጽዕን ኣሎ...~~ | REMOVED (Task 9) — no remaining consumer |

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

## 2026-08-02 — Expense editing + skipped check numbers (NEW drafts, please review)
New `ti` strings added alongside the expense-flow work. All are first drafts by a
non-native speaker and need confirmation.

### `treasurer.skippedChecks.*` (legacy `LanguageContext.tsx`) — modeled on the existing `skippedReceipts` block

| Key | English | ti draft | Confidence |
|-----|---------|----------|------------|
| skippedChecks.button | Show Skipped Check Numbers | ዝተዘለሉ ቁጽሪ ቼክ ርኣይ | ⚠️ mirrors receipts wording |
| skippedChecks.title | Missing Check Numbers | ዝጠፍኡ ቁጽሪ ቼክ | ⚠️ |
| skippedChecks.warning | Please check your checkbook… | በጃኹም መዝገብ ቼክኩም ተወከሱ። እዞም ዝስዕቡ ቁጽሪ ቼክ ኣብ መዝገብ የለውን። | ⚠️ "checkbook" rendered as መዝገብ ቼክ |
| skippedChecks.range | Checked range | ዝተረጋገፀ ካብ | ⚠️ copied from receipts |
| skippedChecks.noneFound | No skipped check numbers found… | ኣብዚ ዝተረጋገፀ ቁጽሪ ዝተዘለለ ቼክ የለን! | ⚠️ |
| skippedChecks.note | It is important to record every check… | ልክዕ ዝኾነ ፋይናንስ መዝገብ ንምሓዝ ኩሉ ቼክ ክምዝገብ ኣገዳሲ እዩ። | ⚠️ |
| skippedChecks.close | Close | ዕጸ | ✅ matches existing usage |

### `treasurerDashboard.expenses.*` (`dictionaries.ts`)

| Key | English | ti draft | Confidence |
|-----|---------|----------|------------|
| addModal.checkNumberRequired | Check number is required for check payments | ንክፍሊት ብቼክ ቁጽሪ ቼክ ኣድላዪ እዩ | ⚠️ phrasing |
| invoiceNumber | Invoice Number | ቁጽሪ ኢንቮይስ | ⚠️ transliteration — is there a native term? |
| missingCheckNumber | No check # | ቁጽሪ ቼክ የለን | ✅ |
| edit.edit | Edit | ኣርም | ⚠️ confirm vs. ኣስተኻኽል |
| edit.save | Save Changes | ለውጥታት ኣቐምጥ | ⚠️ |
| edit.saving | Saving... | የቐምጥ ኣሎ... | ✅ matches addModal.saving pattern |
| edit.cancel | Cancel | ሰርዝ | ✅ existing usage |
| edit.saveFailed | Failed to save changes | ለውጥታት ምቕማጥ ኣይተኻእለን | ⚠️ |
| edit.payeeReadOnly | Payee cannot be changed after an expense is recorded. | ወጪ ድሕሪ ምምዝጋቡ ተቀባሊ ክቕየር ኣይክእልን። | ⚠️ |
| edit.categoryRequired | Please select an expense category | በጃኹም ዓይነት ወጪ ምረጹ | ✅ |
| edit.amountInvalid | Please enter a valid amount greater than $0.00 | በጃኹም ካብ $0.00 ዝዓቢ ቅኑዕ መጠን ኣእትዉ | ⚠️ |
| edit.dateRequired | Please select an expense date | በጃኹም ዕለት ወጪ ምረጹ | ✅ |
| edit.dateFuture | Expense date cannot be in the future | ዕለት ወጪ ኣብ መጻኢ ክኸውን ኣይክእልን | ⚠️ |

## 2026-08-02 — Square non-member donor + bulk attribution (NEW drafts, please review)
New/changed `ti` strings in the `square:` block of `dictionaries.ts`.

| Key | English | ti draft | Confidence |
|-----|---------|----------|------------|
| square.nonMemberDonor | Non-member donor | ኣባል ዘይኮነ ወሃቢ | ⚠️ replaces old `anonymous` ("ስሙ ዘይተፈልጠ ወሃቢ" = "donor whose name is unknown"), which no longer fits now that a name is required |
| square.donorName | Donor name | ስም ወሃቢ | ✅ |
| square.donorNameRequired | Enter the donor name | ስም ወሃቢ ኣእትዉ | ✅ |
| square.confirmHint | Select a member, or mark as a non-member donor and enter a name | ኣባል ምረጽ፡ ወይ ኣባል ዘይኮነ ወሃቢ ኢልካ ምልክት ገይርካ ስም ኣእትው | ⚠️ long sentence, confirm phrasing |
| square.selectAll | Select all | ኩሉ ምረጽ | ✅ |
| square.selectedCount | selected | ተመሪጹ | ⚠️ used as "N ተመሪጹ" — confirm number agreement |
| square.bulkConfirm | Confirm | ኣረጋግጽ | ✅ |
| square.clearSelection | Clear | ኣጽሪ | ⚠️ |
| square.bulkDonorHint | All selected payments will be recorded under this donor name. | ኩሎም እተመረጹ ክፍሊታት ብዚ ስም ወሃቢ ክምዝገቡ እዮም። | ⚠️ |
| square.bulkResult | confirmed | ተረጋጊጹ | ⚠️ used as "N ተረጋጊጹ" |
| square.bulkFailed | failed | ኣይተሳኸዐን | ⚠️ |

Removed: `square.anonymous` (both `en` and `ti`) — no remaining consumer.

---

## Phase 4 — member-facing additions (Aug 2026)

New keys written for the liturgical band, parish announcements, and the
baptismal-name prompt. These are **drafts by a non-native speaker** and reach
members directly on the dashboard and home page, so they matter more than the
admin strings above.

The baptismal-name copy is the one to read most carefully: it asks a personal
question, and the tone in Tigrigna needs to sound like the parish wanting to
know someone rather than a form collecting a field.

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| liturgical.heading | Today in the Church | ሎሚ ኣብ ቤተ ክርስቲያን | ⚠️ |
| liturgical.feast | Feast | በዓል | ✅ |
| liturgical.fast | Fast | ጾም | ✅ |
| liturgical.ordinary | An ordinary day | ንቡር መዓልቲ | ⚠️ |
| liturgical.dayOf | Day {day} of {total} | {day} መዓልቲ ካብ {total} | ⚠️ word order |
| liturgical.commemoration | Commemoration | ዝኽሪ | ✅ |
| liturgical.nextFeast | Next feast | ዝቕጽል በዓል | ✅ |
| liturgical.tomorrow | tomorrow | ጽባሕ | ✅ |
| liturgical.inDays | in {days} days | ድሕሪ {days} መዓልታት | ✅ |
| parishNews.title | From the Parish | ካብ ቤተ ክርስቲያን | ⚠️ |
| parishNews.dashboardTitle | Parish News | ዜና ቤተ ክርስቲያን | ✅ |
| parishNews.through | Through | ክሳብ | ✅ |
| parishNews.loadError | Announcements are unavailable right now. | ሕጂ ሓበሬታታት ክቐርብ ኣይክእልን። | ⚠️ |
| baptismalName.title | What is your baptismal name? | ስመ ጥምቀትካ እንታይ እዩ? | 🔴 gendered form — see note |
| baptismalName.why | Your baptismal name connects you to a saint and to a day in the church year… | ስመ ጥምቀትካ ምስ ሓደ ቅዱስን ምስ ሓደ መዓልቲ ናይ ዓውደ ኣዋርሕ ቤተ ክርስቲያንን የተኣሳስረካ። ንክንፈልጦ ንደሊ፡ ማሕበር ንመዓልቲ ስምካ ክዝክሮ። | 🔴 |
| baptismalName.label | Baptismal name | ስመ ጥምቀት | ✅ |
| baptismalName.placeholder | In Ge'ez or English — e.g. Welde Mariam | ብግእዝ ወይ ብእንግሊዝኛ — ኣብነት፡ ወልደ ማርያም | ⚠️ |
| baptismalName.save | Save | ዕቀብ | ✅ |
| baptismalName.saving | Saving… | ይዕቀብ ኣሎ… | ⚠️ |
| baptismalName.notNow | Not now | ሕጂ ኣይኮነን | ⚠️ |
| baptismalName.error | That did not save. Please try again. | ኣይተዓቀበን። በጃኻ እንደገና ፈትን። | ⚠️ |

### Known problem: grammatical gender

Tigrigna marks gender on second-person forms, and these drafts use the
**masculine** throughout — ስመ ጥምቀት**ካ**, በጃ**ኻ**, ፈት**ን**. Addressing every
member as masculine is wrong for roughly half the parish.

Three ways out, for a native speaker to choose between:

1. **A neutral rephrasing** that avoids second person entirely — e.g. framing
   the question as "ስመ ጥምቀት" with no possessive. Usually the cleanest.
2. **Gendered strings selected from `Member.gender`**, which is already on the
   record. Correct, but doubles these keys and fails for members with no gender
   recorded.
3. **Plural/formal address**, if that reads naturally as respectful here rather
   than distant.

This is a language judgement, not a technical one. Until it is resolved, the
masculine forms ship — which is worth knowing rather than discovering.
