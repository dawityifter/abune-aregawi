# Church Services Assessment Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, anonymous, bilingual (EN/TI), mobile-first online version of the 56-question Church Services Assessment Survey, storing responses in a new table and exposing a first-pass admin report.

**Architecture:** A new `survey_responses` table (JSONB `answers` column) behind a public `POST /api/survey/responses` (rate-limited) and an admin-only `GET /api/survey/report`; a fixed 56-question config shared conceptually by backend (validation) and frontend (rendering); a multi-step wizard at `/survey` reusing the existing `LanguageContext`/i18n system; a basic admin tallies page at `/admin/survey-report`.

**Tech Stack:** Express + Sequelize (Postgres/sqlite), express-validator, express-rate-limit, React 19 + TypeScript, existing `LanguageContext`/`dictionaries.ts` i18n, Jest + supertest (backend), Jest + React Testing Library (frontend).

## Global Constraints

- No name, phone, email, or member_id anywhere on the survey response record — fully anonymous, per `docs/superpowers/specs/2026-08-15-church-services-survey-design.md`.
- No question is mandatory; the wizard's Next/Submit buttons are never disabled by unanswered questions.
- The English question/option set (as extracted from `frontend/public/docs/Church Services Assesment Survey_English.pdf`) is canonical; Tigrigna is a faithful translation of that same structure, not a re-transcription of the Tigrigna PDF's own (slightly different) wording — approved resolution for the mismatches found during brainstorming.
- Survey slug for this instance: `church-services-assessment-2026`.
- Backend role-gating for the report route MUST use the array form `authorize(['admin', 'secretary', 'board'])` — NOT `authorize('admin', 'secretary', 'board')` (that variadic form is a known latent bug elsewhere in this codebase; see `backend/src/routes/volunteerRoutes.js`, flagged separately, not to be copied).
- Backend tests: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <file>` (run from `backend/`).
- Frontend tests: `CI=true npx react-scripts test --watchAll=false <pattern>` (run from `frontend/`).
- New migrations go in `backend/migrations/` (sequelize-cli, tracked in `SequelizeMeta`) — never `backend/src/database/migrations/`.
- Commit after each task's tests pass, following this repo's existing commit style (no `--no-verify`).

---

## Canonical question data (used by Tasks 2 and 5)

56 questions across 11 sections. `type` is `single` (radio), `multi` (checkboxes), or `text` (textarea). `otherOptionKey` names the option that reveals a companion free-text field (stored as `${id}Other`). `maxSelect` caps how many checkboxes a `multi` question allows.

| id | section | type | optionKeys | notes |
|---|---|---|---|---|
| q1 | 1 | single | under18, age18to28, age29to38, age39to48, age49to60, age61to75, age76plus | |
| q2 | 1 | single | male, female | |
| q3 | 1 | single | firstTimeGuest, lessThan6Months, sixMonthsTo2Years, threeTo5Years, moreThan5Years | |
| q4 | 1 | multi | familyFriendInvitation, movedToArea, seekingSpiritualGuidance, tigrayOrthodoxCommunity, holyDaySpecialProgram, childrenFamilyMinistry, other | otherOptionKey: other |
| q5 | 1 | multi | growCloserToGod, receiveHolyMysteries, liturgyPrayerChanting, sermonSpiritualTeaching, fellowshipCommunity, childrenYouthEducation, orthodoxTraditionCulture | |
| q6 | 1 | single | always, often, sometimes, rarely, notYet | |
| q7 | 1 | text | — | |
| q8 | 2 | multi | divineLiturgyCommunion, mahletSeatatKidan, sundaySibket, sundaySchoolYouth, bibleStudyAdult, virtualOnlinePrograms | |
| q9 | 2 | single | veryEasy, mostlyEasy, sometimesDifficult, veryDifficult | |
| q10 | 2 | single | highlyAppropriate, acceptableNeedsAdjustment, tooLongForFamily, preferAdjustedSchedule | |
| q11 | 2 | single | deeplyEnrichingIdeal, goodButLittleLong, moderatelyHelpfulNeedsFocus, desiresDeeperLongerSermon | |
| q12 | 2 | single | exceptionalUplifting, goodNeedsBroaderParticipation, fairNeedsOrganizationTraining, needsStructuralImprovement | |
| q13 | 2 | multi | workSchedules, distanceTransportation, languageComprehension, needClearerSchedule, lackYouthEngagement, needPastoralOutreach | |
| q14 | 2 | text | — | |
| q15 | 3 | single | tigrinya, english, geez, bilingual, other | otherOptionKey: other |
| q16 | 3 | multi | kidaseLiturgyTextScreens, sibketSermonTranslation, sundaySchoolYouth, sacramentPreparation, announcementsBulletins, scriptureReadings | |
| q17 | 3 | single | stronglySupport, support, neutralNoPreference, doNotSupport, needMoreInfo | |
| q18 | 3 | text | — | |
| q19 | 4 | single | yesAtThisParish, yesAtAnotherParish, noSeekingGuidance, noNotCurrently | |
| q20 | 4 | single | monthlyOrAsNeeded, every2to3Months, duringMajorFasts, rarelyOrNever | |
| q21 | 4 | single | verySupported, supported, somewhatSupported, notSupportedEnough, haveNotRequested | |
| q22 | 4 | single | regularly, sometimes, rarely, never, newToChurch | |
| q23 | 4 | multi | homeHospitalVisits, financialPersonalHardship, spiritualCounseling, newcomerWelcome, bereavementGrief, preMaritalFamilyCounseling | |
| q24 | 4 | text | — | |
| q25 | 5 | multi | yesAges0to9, yesAges10to17, yesAges18to30, noNotApplicable | |
| q26 | 5 | single | highlyEffective, moderateNeedsModernBilingual, inadequateUrgentYouthMinistry, unsureNotApplicable | |
| q27 | 5 | multi | ageGradedSundaySchool, clergyMentorship, englishBibleStudyApologetics, youthFellowshipRetreats, sacredZemaLiturgicalTraining, parentSupport | |
| q28 | 5 | text | — | |
| q29 | 6 | single | exceptionalExcellent, satisfactoryGood, fairMinorCareNeeded, needsMajorCleanup | |
| q30 | 6 | single | excellent, good, fair, needsImprovement | |
| q31 | 6 | single | fullyFunctional, adequateNeedsTextEnhancement, soundNeedsTuning, needsImmediateTechUpgrade | |
| q32 | 6 | multi | soundSystem, displayScreens, chairsSeating, airConditioning, elevator, lighting, other | otherOptionKey: other, maxSelect: 2 |
| q33 | 6 | single | worshipArea, dejeselamCommonAreas, sanctuarySurroundings, sundaySchoolClassrooms, parkingTrafficFlow, accessibilityElders, buildingSafetySigns | |
| q34 | 7 | single | excellent, good, fair, needsImprovement | |
| q35 | 7 | multi | inPersonAnnouncement, textSms, whatsappViber, email, printedNotice, facebookSocialMedia, churchWebsite | |
| q36 | 7 | single | veryWell, well, sometimes, needsImprovement, iDoNotKnow | |
| q37 | 7 | multi | newcomerWelcomeFollowUp, careElders, familyFellowship, youngAdultFellowship, charityOutreach, supportFamiliesInCrisis, communityEducationWorkshops, evangelismMission | |
| q38 | 7 | text | — | |
| q39 | 8 | multi | zemaChoirWorshipSupport, cleaningSetupMaintenance, sundaySchoolYouthTeaching, welcomingNewcomerSupport, mediaSoundScreensTech, charityVisitationOutreach, fundraisingEventOrganization, professionalSkills, needMoreInfo | otherOptionKey: professionalSkills |
| q40 | 8 | single | veryClear, mostlyClear, somewhatUnclear, notClear, newHaveNotReceivedInfo | |
| q41 | 8 | multi | clearMinistryRoles, volunteerSignUpForm, trainingGuidance, personalInvitationFollowUp, regularSchedule, childcareDuringActivities, recognitionEncouragement, other | otherOptionKey: other |
| q42 | 8 | multi | prayer, regularGiving, specialProjectBuilding, volunteerTime, professionalTechnicalExpertise, invitingOthers, outreachCharity, needMoreInfo | |
| q43 | 9 | single | veryHighConfidence, highConfidence, someConfidence, lowConfidence, notEnoughInfo | |
| q44 | 9 | single | veryClearly, clearly, sometimesClearly, notClearly, iDoNotKnow | |
| q45 | 9 | single | veryConfident, confident, somewhatConfident, notConfident, notEnoughInfo | |
| q46 | 9 | multi | regularFinancialSummaries, clearAnnualPlansGoals, betterExplanationMajorDecisions, moreOpportunitiesMemberQuestions, clearVolunteerMinistryResponsibilities, fasterResponseToConcerns, consistentPoliciesProcedures | maxSelect: 3 |
| q47 | 9 | text | — | |
| q48 | 10 | single | yesVisitedInPerson, seenPhotosUpdates, awareButNotVisited, notYetNotInformed | |
| q49 | 10 | single | veryInformed, informed, somewhatInformed, notInformed | |
| q50 | 10 | single | excellentProgress, goodProgress, satisfactory, movingTooSlowly, notEnoughInfo | |
| q51 | 10 | multi | completeNewBuildingResponsibly, expandChildrenYouthMinistry, strengthenClergyPastoralCapacity, developCharityOutreach, improveWorshipTeachingLanguageAccess, buildFinancialSustainability, trainFutureServantsDeaconsLeaders, strengthenEvangelismWelcomeFamilies | maxSelect: 3 |
| q52 | 10 | text | — | |
| q53 | 11 | single | verySatisfied, satisfied, neutral, dissatisfied, veryDissatisfied | |
| q54 | 11 | text | — | |
| q55 | 11 | text | — | |
| q56 | 11 | text | — | |

Top-of-form `member_status` (separate field, not a numbered question): `firstTimeGuest`, `newMember`, `existingMember`.

---

### Task 1: Backend — SurveyResponse model + migration

**Files:**
- Create: `backend/migrations/20260815000000-create-survey-responses.js`
- Create: `backend/src/models/SurveyResponse.js`
- Modify: `backend/src/models/index.js`
- Create: `backend/src/__tests__/models/surveyResponse.test.js`

**Interfaces:**
- Produces: `SurveyResponse` Sequelize model exported from `backend/src/models/index.js`, table `survey_responses` with columns `id` (UUID pk), `survey_slug` (string), `locale` (string), `member_status` (string, nullable), `answers` (JSONB), `ip_hash` (string, nullable), `submitted_at` (date), `created_at` (date, no `updated_at`).

- [ ] **Step 1: Write the failing test**

```js
// backend/src/__tests__/models/surveyResponse.test.js
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, SurveyResponse } = require('../../models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

describe('SurveyResponse model', () => {
  it('creates a response with a generated UUID id and defaulted submitted_at', async () => {
    const row = await SurveyResponse.create({
      survey_slug: 'church-services-assessment-2026',
      locale: 'en',
      answers: { q1: 'age18to28' }
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.submitted_at).toBeInstanceOf(Date);
    expect(row.answers).toEqual({ q1: 'age18to28' });
    expect(row.member_status).toBeNull();
  });

  it('rejects a row with no answers', async () => {
    await expect(
      SurveyResponse.create({ survey_slug: 'church-services-assessment-2026', locale: 'en' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/models/surveyResponse.test.js`
Expected: FAIL — `SurveyResponse` is undefined (model doesn't exist yet).

- [ ] **Step 3: Create the migration**

```js
// backend/migrations/20260815000000-create-survey-responses.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('survey_responses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      survey_slug: { type: Sequelize.STRING(100), allowNull: false },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      member_status: { type: Sequelize.STRING(30), allowNull: true },
      answers: { type: Sequelize.JSONB, allowNull: false },
      ip_hash: { type: Sequelize.STRING(64), allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('survey_responses', ['survey_slug'], { name: 'survey_responses_slug_idx' });
    await queryInterface.addIndex('survey_responses', ['survey_slug', 'submitted_at'], { name: 'survey_responses_slug_submitted_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('survey_responses');
  }
};
```

- [ ] **Step 4: Create the model**

```js
// backend/src/models/SurveyResponse.js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SurveyResponse extends Model {}

  SurveyResponse.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    survey_slug: { type: DataTypes.STRING(100), allowNull: false },
    locale: { type: DataTypes.STRING(5), allowNull: false },
    member_status: { type: DataTypes.STRING(30), allowNull: true },
    answers: { type: DataTypes.JSONB, allowNull: false },
    ip_hash: { type: DataTypes.STRING(64), allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    sequelize,
    modelName: 'SurveyResponse',
    tableName: 'survey_responses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true
  });

  return SurveyResponse;
};
```

- [ ] **Step 5: Register the model in `backend/src/models/index.js`**

Add near the other `const X = require('./X')(sequelize);` lines:

```js
  const SurveyResponse = require('./SurveyResponse')(sequelize);
```

Add `SurveyResponse,` to the `models` object literal (alongside `MemberLoan`, `SquarePayment`, etc.).

- [ ] **Step 6: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/models/surveyResponse.test.js`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/20260815000000-create-survey-responses.js backend/src/models/SurveyResponse.js backend/src/models/index.js backend/src/__tests__/models/surveyResponse.test.js
git commit -m "feat: add survey_responses table and SurveyResponse model"
```

---

### Task 2: Backend — survey question definitions + answer validator

**Files:**
- Create: `backend/src/config/surveyDefinitions/churchServicesAssessment2026.js`
- Create: `backend/src/__tests__/config/surveyDefinitions.test.js`

**Interfaces:**
- Consumes: nothing (pure data + pure function module).
- Produces: `SURVEY_SLUG` (string constant `'church-services-assessment-2026'`), `MEMBER_STATUS_OPTIONS` (`['firstTimeGuest','newMember','existingMember']`), `SURVEY_DEFINITIONS` (object keyed by slug: `{ [SURVEY_SLUG]: { slug, questions } }`, `questions` is the 56-entry array from the table above), `isValidAnswers(surveySlug, answers)` returning `{ valid: boolean, error?: string }`. Task 3 and Task 4 both `require` this module.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/__tests__/config/surveyDefinitions.test.js
const {
  SURVEY_SLUG,
  SURVEY_DEFINITIONS,
  MEMBER_STATUS_OPTIONS,
  isValidAnswers
} = require('../../config/surveyDefinitions/churchServicesAssessment2026');

describe('churchServicesAssessment2026 survey definitions', () => {
  it('defines exactly 56 questions with unique ids', () => {
    const { questions } = SURVEY_DEFINITIONS[SURVEY_SLUG];
    expect(questions).toHaveLength(56);
    expect(new Set(questions.map(q => q.id)).size).toBe(56);
  });

  it('defines the 3 member status options', () => {
    expect(MEMBER_STATUS_OPTIONS).toEqual(['firstTimeGuest', 'newMember', 'existingMember']);
  });

  it('accepts a valid mixed-type answer payload', () => {
    const result = isValidAnswers(SURVEY_SLUG, {
      q1: 'age18to28',
      q4: ['familyFriendInvitation', 'other'],
      q4Other: 'A friend from work',
      q7: 'Free text answer'
    });
    expect(result).toEqual({ valid: true });
  });

  it('rejects an unknown survey_slug', () => {
    expect(isValidAnswers('not-a-real-slug', {}).valid).toBe(false);
  });

  it('rejects an unknown question id', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q999: 'x' }).valid).toBe(false);
  });

  it('rejects an invalid option for a single-select question', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q1: 'not-a-real-option' }).valid).toBe(false);
  });

  it('rejects a multi-select answer that is not an array', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q4: 'familyFriendInvitation' }).valid).toBe(false);
  });

  it('rejects a multi-select answer exceeding maxSelect', () => {
    expect(isValidAnswers(SURVEY_SLUG, {
      q32: ['soundSystem', 'displayScreens', 'chairsSeating']
    }).valid).toBe(false);
  });

  it('accepts a multi-select answer at exactly maxSelect', () => {
    expect(isValidAnswers(SURVEY_SLUG, {
      q32: ['soundSystem', 'displayScreens']
    })).toEqual({ valid: true });
  });

  it('rejects a non-string text answer', () => {
    expect(isValidAnswers(SURVEY_SLUG, { q7: 123 }).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/config/surveyDefinitions.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the definitions + validator module**

```js
// backend/src/config/surveyDefinitions/churchServicesAssessment2026.js
'use strict';

const SURVEY_SLUG = 'church-services-assessment-2026';

const MEMBER_STATUS_OPTIONS = ['firstTimeGuest', 'newMember', 'existingMember'];

const questions = [
  { id: 'q1', section: 1, type: 'single', optionKeys: ['under18', 'age18to28', 'age29to38', 'age39to48', 'age49to60', 'age61to75', 'age76plus'] },
  { id: 'q2', section: 1, type: 'single', optionKeys: ['male', 'female'] },
  { id: 'q3', section: 1, type: 'single', optionKeys: ['firstTimeGuest', 'lessThan6Months', 'sixMonthsTo2Years', 'threeTo5Years', 'moreThan5Years'] },
  { id: 'q4', section: 1, type: 'multi', optionKeys: ['familyFriendInvitation', 'movedToArea', 'seekingSpiritualGuidance', 'tigrayOrthodoxCommunity', 'holyDaySpecialProgram', 'childrenFamilyMinistry', 'other'], otherOptionKey: 'other' },
  { id: 'q5', section: 1, type: 'multi', optionKeys: ['growCloserToGod', 'receiveHolyMysteries', 'liturgyPrayerChanting', 'sermonSpiritualTeaching', 'fellowshipCommunity', 'childrenYouthEducation', 'orthodoxTraditionCulture'] },
  { id: 'q6', section: 1, type: 'single', optionKeys: ['always', 'often', 'sometimes', 'rarely', 'notYet'] },
  { id: 'q7', section: 1, type: 'text' },
  { id: 'q8', section: 2, type: 'multi', optionKeys: ['divineLiturgyCommunion', 'mahletSeatatKidan', 'sundaySibket', 'sundaySchoolYouth', 'bibleStudyAdult', 'virtualOnlinePrograms'] },
  { id: 'q9', section: 2, type: 'single', optionKeys: ['veryEasy', 'mostlyEasy', 'sometimesDifficult', 'veryDifficult'] },
  { id: 'q10', section: 2, type: 'single', optionKeys: ['highlyAppropriate', 'acceptableNeedsAdjustment', 'tooLongForFamily', 'preferAdjustedSchedule'] },
  { id: 'q11', section: 2, type: 'single', optionKeys: ['deeplyEnrichingIdeal', 'goodButLittleLong', 'moderatelyHelpfulNeedsFocus', 'desiresDeeperLongerSermon'] },
  { id: 'q12', section: 2, type: 'single', optionKeys: ['exceptionalUplifting', 'goodNeedsBroaderParticipation', 'fairNeedsOrganizationTraining', 'needsStructuralImprovement'] },
  { id: 'q13', section: 2, type: 'multi', optionKeys: ['workSchedules', 'distanceTransportation', 'languageComprehension', 'needClearerSchedule', 'lackYouthEngagement', 'needPastoralOutreach'] },
  { id: 'q14', section: 2, type: 'text' },
  { id: 'q15', section: 3, type: 'single', optionKeys: ['tigrinya', 'english', 'geez', 'bilingual', 'other'], otherOptionKey: 'other' },
  { id: 'q16', section: 3, type: 'multi', optionKeys: ['kidaseLiturgyTextScreens', 'sibketSermonTranslation', 'sundaySchoolYouth', 'sacramentPreparation', 'announcementsBulletins', 'scriptureReadings'] },
  { id: 'q17', section: 3, type: 'single', optionKeys: ['stronglySupport', 'support', 'neutralNoPreference', 'doNotSupport', 'needMoreInfo'] },
  { id: 'q18', section: 3, type: 'text' },
  { id: 'q19', section: 4, type: 'single', optionKeys: ['yesAtThisParish', 'yesAtAnotherParish', 'noSeekingGuidance', 'noNotCurrently'] },
  { id: 'q20', section: 4, type: 'single', optionKeys: ['monthlyOrAsNeeded', 'every2to3Months', 'duringMajorFasts', 'rarelyOrNever'] },
  { id: 'q21', section: 4, type: 'single', optionKeys: ['verySupported', 'supported', 'somewhatSupported', 'notSupportedEnough', 'haveNotRequested'] },
  { id: 'q22', section: 4, type: 'single', optionKeys: ['regularly', 'sometimes', 'rarely', 'never', 'newToChurch'] },
  { id: 'q23', section: 4, type: 'multi', optionKeys: ['homeHospitalVisits', 'financialPersonalHardship', 'spiritualCounseling', 'newcomerWelcome', 'bereavementGrief', 'preMaritalFamilyCounseling'] },
  { id: 'q24', section: 4, type: 'text' },
  { id: 'q25', section: 5, type: 'multi', optionKeys: ['yesAges0to9', 'yesAges10to17', 'yesAges18to30', 'noNotApplicable'] },
  { id: 'q26', section: 5, type: 'single', optionKeys: ['highlyEffective', 'moderateNeedsModernBilingual', 'inadequateUrgentYouthMinistry', 'unsureNotApplicable'] },
  { id: 'q27', section: 5, type: 'multi', optionKeys: ['ageGradedSundaySchool', 'clergyMentorship', 'englishBibleStudyApologetics', 'youthFellowshipRetreats', 'sacredZemaLiturgicalTraining', 'parentSupport'] },
  { id: 'q28', section: 5, type: 'text' },
  { id: 'q29', section: 6, type: 'single', optionKeys: ['exceptionalExcellent', 'satisfactoryGood', 'fairMinorCareNeeded', 'needsMajorCleanup'] },
  { id: 'q30', section: 6, type: 'single', optionKeys: ['excellent', 'good', 'fair', 'needsImprovement'] },
  { id: 'q31', section: 6, type: 'single', optionKeys: ['fullyFunctional', 'adequateNeedsTextEnhancement', 'soundNeedsTuning', 'needsImmediateTechUpgrade'] },
  { id: 'q32', section: 6, type: 'multi', optionKeys: ['soundSystem', 'displayScreens', 'chairsSeating', 'airConditioning', 'elevator', 'lighting', 'other'], otherOptionKey: 'other', maxSelect: 2 },
  { id: 'q33', section: 6, type: 'single', optionKeys: ['worshipArea', 'dejeselamCommonAreas', 'sanctuarySurroundings', 'sundaySchoolClassrooms', 'parkingTrafficFlow', 'accessibilityElders', 'buildingSafetySigns'] },
  { id: 'q34', section: 7, type: 'single', optionKeys: ['excellent', 'good', 'fair', 'needsImprovement'] },
  { id: 'q35', section: 7, type: 'multi', optionKeys: ['inPersonAnnouncement', 'textSms', 'whatsappViber', 'email', 'printedNotice', 'facebookSocialMedia', 'churchWebsite'] },
  { id: 'q36', section: 7, type: 'single', optionKeys: ['veryWell', 'well', 'sometimes', 'needsImprovement', 'iDoNotKnow'] },
  { id: 'q37', section: 7, type: 'multi', optionKeys: ['newcomerWelcomeFollowUp', 'careElders', 'familyFellowship', 'youngAdultFellowship', 'charityOutreach', 'supportFamiliesInCrisis', 'communityEducationWorkshops', 'evangelismMission'] },
  { id: 'q38', section: 7, type: 'text' },
  { id: 'q39', section: 8, type: 'multi', optionKeys: ['zemaChoirWorshipSupport', 'cleaningSetupMaintenance', 'sundaySchoolYouthTeaching', 'welcomingNewcomerSupport', 'mediaSoundScreensTech', 'charityVisitationOutreach', 'fundraisingEventOrganization', 'professionalSkills', 'needMoreInfo'], otherOptionKey: 'professionalSkills' },
  { id: 'q40', section: 8, type: 'single', optionKeys: ['veryClear', 'mostlyClear', 'somewhatUnclear', 'notClear', 'newHaveNotReceivedInfo'] },
  { id: 'q41', section: 8, type: 'multi', optionKeys: ['clearMinistryRoles', 'volunteerSignUpForm', 'trainingGuidance', 'personalInvitationFollowUp', 'regularSchedule', 'childcareDuringActivities', 'recognitionEncouragement', 'other'], otherOptionKey: 'other' },
  { id: 'q42', section: 8, type: 'multi', optionKeys: ['prayer', 'regularGiving', 'specialProjectBuilding', 'volunteerTime', 'professionalTechnicalExpertise', 'invitingOthers', 'outreachCharity', 'needMoreInfo'] },
  { id: 'q43', section: 9, type: 'single', optionKeys: ['veryHighConfidence', 'highConfidence', 'someConfidence', 'lowConfidence', 'notEnoughInfo'] },
  { id: 'q44', section: 9, type: 'single', optionKeys: ['veryClearly', 'clearly', 'sometimesClearly', 'notClearly', 'iDoNotKnow'] },
  { id: 'q45', section: 9, type: 'single', optionKeys: ['veryConfident', 'confident', 'somewhatConfident', 'notConfident', 'notEnoughInfo'] },
  { id: 'q46', section: 9, type: 'multi', optionKeys: ['regularFinancialSummaries', 'clearAnnualPlansGoals', 'betterExplanationMajorDecisions', 'moreOpportunitiesMemberQuestions', 'clearVolunteerMinistryResponsibilities', 'fasterResponseToConcerns', 'consistentPoliciesProcedures'], maxSelect: 3 },
  { id: 'q47', section: 9, type: 'text' },
  { id: 'q48', section: 10, type: 'single', optionKeys: ['yesVisitedInPerson', 'seenPhotosUpdates', 'awareButNotVisited', 'notYetNotInformed'] },
  { id: 'q49', section: 10, type: 'single', optionKeys: ['veryInformed', 'informed', 'somewhatInformed', 'notInformed'] },
  { id: 'q50', section: 10, type: 'single', optionKeys: ['excellentProgress', 'goodProgress', 'satisfactory', 'movingTooSlowly', 'notEnoughInfo'] },
  { id: 'q51', section: 10, type: 'multi', optionKeys: ['completeNewBuildingResponsibly', 'expandChildrenYouthMinistry', 'strengthenClergyPastoralCapacity', 'developCharityOutreach', 'improveWorshipTeachingLanguageAccess', 'buildFinancialSustainability', 'trainFutureServantsDeaconsLeaders', 'strengthenEvangelismWelcomeFamilies'], maxSelect: 3 },
  { id: 'q52', section: 10, type: 'text' },
  { id: 'q53', section: 11, type: 'single', optionKeys: ['verySatisfied', 'satisfied', 'neutral', 'dissatisfied', 'veryDissatisfied'] },
  { id: 'q54', section: 11, type: 'text' },
  { id: 'q55', section: 11, type: 'text' },
  { id: 'q56', section: 11, type: 'text' }
];

const SURVEY_DEFINITIONS = {
  [SURVEY_SLUG]: { slug: SURVEY_SLUG, questions }
};

function isValidAnswers(surveySlug, answers) {
  const def = SURVEY_DEFINITIONS[surveySlug];
  if (!def) {
    return { valid: false, error: `Unknown survey_slug: ${surveySlug}` };
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { valid: false, error: 'answers must be an object' };
  }

  const questionsById = new Map(def.questions.map(q => [q.id, q]));

  for (const [key, value] of Object.entries(answers)) {
    const otherMatch = key.match(/^(q\d+)Other$/);
    if (otherMatch) {
      const q = questionsById.get(otherMatch[1]);
      if (!q || !q.otherOptionKey) {
        return { valid: false, error: `Unexpected key: ${key}` };
      }
      if (typeof value !== 'string') {
        return { valid: false, error: `${key} must be a string` };
      }
      continue;
    }

    const q = questionsById.get(key);
    if (!q) {
      return { valid: false, error: `Unknown question id: ${key}` };
    }

    if (q.type === 'text') {
      if (typeof value !== 'string') {
        return { valid: false, error: `${key} must be a string` };
      }
    } else if (q.type === 'single') {
      if (typeof value !== 'string' || !q.optionKeys.includes(value)) {
        return { valid: false, error: `${key} has an invalid option` };
      }
    } else if (q.type === 'multi') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !q.optionKeys.includes(v))) {
        return { valid: false, error: `${key} has an invalid option` };
      }
      if (q.maxSelect && value.length > q.maxSelect) {
        return { valid: false, error: `${key} allows at most ${q.maxSelect} selections` };
      }
    }
  }

  return { valid: true };
}

module.exports = { SURVEY_SLUG, MEMBER_STATUS_OPTIONS, SURVEY_DEFINITIONS, isValidAnswers };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/config/surveyDefinitions.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/surveyDefinitions/churchServicesAssessment2026.js backend/src/__tests__/config/surveyDefinitions.test.js
git commit -m "feat: add church services survey question definitions and answer validator"
```

---

### Task 3: Backend — `POST /api/survey/responses` (public submit endpoint)

**Files:**
- Create: `backend/src/controllers/surveyController.js`
- Create: `backend/src/routes/surveyRoutes.js`
- Modify: `backend/src/server.js`
- Modify: `backend/env.example`
- Create: `backend/tests/integration/survey.test.js`

**Interfaces:**
- Consumes: `SurveyResponse` model (Task 1); `SURVEY_SLUG`, `SURVEY_DEFINITIONS`, `MEMBER_STATUS_OPTIONS`, `isValidAnswers` (Task 2).
- Produces: `surveyController.submitResponse(req, res)`, `surveyController.getReport(req, res)` (implemented in Task 4) — both exported from `backend/src/controllers/surveyController.js`. Route `POST /api/survey/responses` mounted publicly at `/api/survey`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/integration/survey.test.js
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { id: 1, role: process.env.TEST_SURVEY_ROLE || 'member', roles: [process.env.TEST_SURVEY_ROLE || 'member'] };
    next();
  }
}));

const app = require('../../src/server');
const { sequelize, SurveyResponse } = require('../../src/models');
const { SURVEY_SLUG } = require('../../src/config/surveyDefinitions/churchServicesAssessment2026');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await SurveyResponse.destroy({ where: {} });
});

describe('POST /api/survey/responses', () => {
  it('accepts a valid anonymous submission', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({
        survey_slug: SURVEY_SLUG,
        locale: 'en',
        member_status: 'existingMember',
        answers: { q1: 'age18to28', q4: ['familyFriendInvitation'], q7: 'Great parish' }
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rows = await SurveyResponse.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].member_status).toBe('existingMember');
    expect(rows[0].answers.q1).toBe('age18to28');
    expect(rows[0].ip_hash).toEqual(expect.any(String));
  });

  it('does not require member_status, locale defaults are still validated', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({ survey_slug: SURVEY_SLUG, locale: 'ti', answers: { q2: 'female' } });
    expect(res.status).toBe(201);
  });

  it('rejects an unknown survey_slug', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({ survey_slug: 'bogus', locale: 'en', answers: {} });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid locale', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({ survey_slug: SURVEY_SLUG, locale: 'fr', answers: {} });
    expect(res.status).toBe(400);
  });

  it('rejects an answer payload with an unknown question id', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({ survey_slug: SURVEY_SLUG, locale: 'en', answers: { q999: 'x' } });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized answers payload', async () => {
    const res = await request(app)
      .post('/api/survey/responses')
      .send({ survey_slug: SURVEY_SLUG, locale: 'en', answers: { q7: 'x'.repeat(21000) } });
    expect(res.status).toBe(400);
  });

  it('rate-limits after 5 submissions from the same IP within the window', async () => {
    const payload = { survey_slug: SURVEY_SLUG, locale: 'en', answers: { q2: 'male' } };
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/survey/responses').send(payload);
      expect(res.status).toBe(201);
    }
    const sixth = await request(app).post('/api/survey/responses').send(payload);
    expect(sixth.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/survey.test.js`
Expected: FAIL — `/api/survey/responses` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Write the controller**

```js
// backend/src/controllers/surveyController.js
'use strict';
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { SurveyResponse } = require('../models');
const { isValidAnswers } = require('../config/surveyDefinitions/churchServicesAssessment2026');

const MAX_ANSWERS_JSON_LENGTH = 20000;

const submitResponse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid submission', errors: errors.array() });
    }

    const { survey_slug, locale, member_status, answers } = req.body;

    if (JSON.stringify(answers).length > MAX_ANSWERS_JSON_LENGTH) {
      return res.status(400).json({ success: false, message: 'Submission too large' });
    }

    const validation = isValidAnswers(survey_slug, answers);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const salt = process.env.SURVEY_IP_SALT || 'dev-only-survey-salt-change-in-prod';
    const ip_hash = crypto.createHash('sha256').update(`${req.ip}${salt}`).digest('hex');

    await SurveyResponse.create({
      survey_slug,
      locale,
      member_status: member_status || null,
      answers,
      ip_hash,
      submitted_at: new Date()
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('submitResponse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit survey response' });
  }
};

module.exports = { submitResponse };
```

- [ ] **Step 4: Write the routes**

```js
// backend/src/routes/surveyRoutes.js
'use strict';
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { SURVEY_DEFINITIONS, MEMBER_STATUS_OPTIONS } = require('../config/surveyDefinitions/churchServicesAssessment2026');

// Loose enough that multiple family members on the same church wifi can each
// submit without being blocked, while still stopping a scripted flood.
const surveySubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many survey submissions from this IP, please try again later.' }
});

const validateSubmission = [
  body('survey_slug').isIn(Object.keys(SURVEY_DEFINITIONS)).withMessage('Unknown survey_slug'),
  body('locale').isIn(['en', 'ti']).withMessage('locale must be en or ti'),
  body('member_status').optional({ checkFalsy: true }).isIn(MEMBER_STATUS_OPTIONS).withMessage('Invalid member_status'),
  body('answers').isObject().withMessage('answers must be an object')
];

// Public — anonymous, no auth. Rate-limited on top of the global /api/ limiter in server.js.
router.post('/responses', surveySubmitLimiter, validateSubmission, surveyController.submitResponse);

// GET /report (admin/secretary/board) is added in Task 4, once surveyController.getReport exists.

module.exports = router;
```

Note: the `GET /report` route is deliberately left out of this file for now — Task 4 adds it once `surveyController.getReport` exists. Defining a route with an undefined handler throws immediately at require-time (`Route.get() requires a callback function`), so the two routes can't be wired in the same step ahead of Task 4's implementation.

- [ ] **Step 5: Mount the route in `backend/src/server.js`**

Add alongside the other `app.use('/api/...')` lines (near `app.use('/api/loans', loanRoutes);`):

```js
app.use('/api/survey', surveyRoutes);
```

And add the corresponding require near the top with the other route requires:

```js
const surveyRoutes = require('./routes/surveyRoutes');
```

- [ ] **Step 6: Document the new env var in `backend/env.example`**

Append:

```
# Salt used to hash submitter IPs on the anonymous survey (audit trail only, never raw IP)
SURVEY_IP_SALT=
```

- [ ] **Step 7: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/survey.test.js`
Expected: PASS (6 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/surveyController.js backend/src/routes/surveyRoutes.js backend/src/server.js backend/env.example backend/tests/integration/survey.test.js
git commit -m "feat: add public POST /api/survey/responses endpoint with rate limiting"
```

---

### Task 4: Backend — `GET /api/survey/report` (admin/secretary/board tallies)

**Files:**
- Modify: `backend/src/controllers/surveyController.js`
- Modify: `backend/src/routes/surveyRoutes.js`
- Modify: `backend/tests/integration/survey.test.js`

**Interfaces:**
- Consumes: `SurveyResponse` model, `SURVEY_DEFINITIONS`/`SURVEY_SLUG` (Task 2), `protect` (`firebaseAuthMiddleware`) and `authorize` from `backend/src/middleware/`.
- Produces: `GET /api/survey/report?survey_slug=...` → `{ success: true, data: { totalResponses: number, questionTallies: Record<questionId, Record<optionKey, number>>, freeTextAnswers: Record<questionId, string[]> } }`. This exact shape is what Task 11's frontend `fetchSurveyReport` and `SurveyReportPage` consume.

- [ ] **Step 1: Write the failing test (append to `backend/tests/integration/survey.test.js`)**

```js
describe('GET /api/survey/report', () => {
  beforeEach(async () => {
    await SurveyResponse.destroy({ where: {} });
    await SurveyResponse.bulkCreate([
      { survey_slug: SURVEY_SLUG, locale: 'en', answers: { q1: 'age18to28', q4: ['familyFriendInvitation', 'other'], q7: 'Loved the sermon' } },
      { survey_slug: SURVEY_SLUG, locale: 'ti', answers: { q1: 'age18to28', q4: ['movedToArea'], q7: 'More parking please' } },
      { survey_slug: SURVEY_SLUG, locale: 'en', answers: { q1: 'age29to38' } }
    ]);
  });

  it('rejects a non-admin/secretary/board role', async () => {
    process.env.TEST_SURVEY_ROLE = 'member';
    const res = await request(app).get(`/api/survey/report?survey_slug=${SURVEY_SLUG}`);
    expect(res.status).toBe(403);
  });

  it('returns tallies and free-text answers for admin', async () => {
    process.env.TEST_SURVEY_ROLE = 'admin';
    const res = await request(app).get(`/api/survey/report?survey_slug=${SURVEY_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalResponses).toBe(3);
    expect(res.body.data.questionTallies.q1).toEqual({ age18to28: 2, age29to38: 1 });
    expect(res.body.data.questionTallies.q4).toEqual({ familyFriendInvitation: 1, other: 1, movedToArea: 1 });
    expect(res.body.data.freeTextAnswers.q7).toEqual(['Loved the sermon', 'More parking please']);
  });

  it('allows secretary and board roles too', async () => {
    for (const role of ['secretary', 'board']) {
      process.env.TEST_SURVEY_ROLE = role;
      const res = await request(app).get(`/api/survey/report?survey_slug=${SURVEY_SLUG}`);
      expect(res.status).toBe(200);
    }
  });

  it('rejects an unknown survey_slug', async () => {
    process.env.TEST_SURVEY_ROLE = 'admin';
    const res = await request(app).get('/api/survey/report?survey_slug=bogus');
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/survey.test.js -t "survey/report"`
Expected: FAIL — `GET /api/survey/report` is 404 (route not wired yet).

- [ ] **Step 3: Add `getReport` to the controller**

Append to `backend/src/controllers/surveyController.js`, and add `SURVEY_DEFINITIONS` to its existing import line:

```js
const { isValidAnswers, SURVEY_DEFINITIONS } = require('../config/surveyDefinitions/churchServicesAssessment2026');
```

```js
const getReport = async (req, res) => {
  try {
    const surveySlug = req.query.survey_slug;
    const def = SURVEY_DEFINITIONS[surveySlug];
    if (!def) {
      return res.status(400).json({ success: false, message: 'Unknown survey_slug' });
    }

    const rows = await SurveyResponse.findAll({ where: { survey_slug: surveySlug }, attributes: ['answers'] });

    const questionTallies = {};
    const freeTextAnswers = {};
    def.questions.forEach(q => {
      if (q.type === 'text') {
        freeTextAnswers[q.id] = [];
      } else {
        questionTallies[q.id] = {};
      }
    });

    rows.forEach(row => {
      const answers = row.answers || {};
      def.questions.forEach(q => {
        const value = answers[q.id];
        if (value === undefined || value === null || value === '') return;

        if (q.type === 'text') {
          freeTextAnswers[q.id].push(value);
        } else if (q.type === 'single') {
          questionTallies[q.id][value] = (questionTallies[q.id][value] || 0) + 1;
        } else if (q.type === 'multi' && Array.isArray(value)) {
          value.forEach(optionKey => {
            questionTallies[q.id][optionKey] = (questionTallies[q.id][optionKey] || 0) + 1;
          });
        }
      });
    });

    return res.json({
      success: true,
      data: { totalResponses: rows.length, questionTallies, freeTextAnswers }
    });
  } catch (err) {
    console.error('getReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to build survey report' });
  }
};

module.exports = { submitResponse, getReport };
```

(This replaces the earlier `module.exports = { submitResponse };` line.)

- [ ] **Step 4: Wire the route in `backend/src/routes/surveyRoutes.js`**

Add the two imports that were deferred in Task 3, and the route itself:

```js
const { firebaseAuthMiddleware: protect } = require('../middleware/auth');
const authorize = require('../middleware/role');
```

```js
// Admin/secretary/board only. Uses the array form of authorize() — see Global Constraints.
router.get('/report', protect, authorize(['admin', 'secretary', 'board']), surveyController.getReport);
```

(Replace the `// GET /report (admin/secretary/board) is added in Task 4...` comment line with this.)

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/survey.test.js`
Expected: PASS (all 10 tests across both `describe` blocks)

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/surveyController.js backend/src/routes/surveyRoutes.js backend/tests/integration/survey.test.js
git commit -m "feat: add admin GET /api/survey/report endpoint with per-question tallies"
```

---

### Task 5: Frontend — `surveyDefinitions.ts` (structure only, no display text)

**Files:**
- Create: `frontend/src/components/survey/surveyDefinitions.ts`
- Create: `frontend/src/components/survey/__tests__/surveyDefinitions.test.ts`

**Interfaces:**
- Produces: `SURVEY_SLUG` (string), `QuestionType = 'single' | 'multi' | 'text'`, `SurveyQuestionDef { id: string; section: number; type: QuestionType; optionKeys?: string[]; otherOptionKey?: string; maxSelect?: number }`, `SURVEY_QUESTIONS: SurveyQuestionDef[]` (the same 56 entries as the backend config in Task 2 — kept in sync by hand since each side validates/renders independently, per the design's hardcoded-content decision), `SURVEY_SECTION_COUNT = 11`, `questionsForSection(section: number): SurveyQuestionDef[]`. Task 6 (i18n), Task 8 (`SurveyQuestion`), and Task 9 (`SurveyWizard`) all import from this module.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/survey/__tests__/surveyDefinitions.test.ts
import { SURVEY_QUESTIONS, SURVEY_SECTION_COUNT, questionsForSection } from '../surveyDefinitions';

describe('surveyDefinitions', () => {
  it('has exactly 56 questions with unique ids', () => {
    expect(SURVEY_QUESTIONS).toHaveLength(56);
    expect(new Set(SURVEY_QUESTIONS.map(q => q.id)).size).toBe(56);
  });

  it('covers sections 1 through 11 with no gaps', () => {
    const sections = new Set(SURVEY_QUESTIONS.map(q => q.section));
    expect(sections).toEqual(new Set(Array.from({ length: SURVEY_SECTION_COUNT }, (_, i) => i + 1)));
  });

  it('every multi/single question has at least 2 optionKeys', () => {
    SURVEY_QUESTIONS
      .filter(q => q.type !== 'text')
      .forEach(q => expect((q.optionKeys || []).length).toBeGreaterThanOrEqual(2));
  });

  it('questionsForSection(1) returns q1 through q7 in order', () => {
    expect(questionsForSection(1).map(q => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `CI=true npx react-scripts test --watchAll=false surveyDefinitions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `surveyDefinitions.ts`**

```ts
// frontend/src/components/survey/surveyDefinitions.ts
export const SURVEY_SLUG = 'church-services-assessment-2026';
export const SURVEY_SECTION_COUNT = 11;

export type QuestionType = 'single' | 'multi' | 'text';

export interface SurveyQuestionDef {
  id: string;
  section: number;
  type: QuestionType;
  optionKeys?: string[];
  otherOptionKey?: string;
  maxSelect?: number;
}

export const SURVEY_QUESTIONS: SurveyQuestionDef[] = [
  { id: 'q1', section: 1, type: 'single', optionKeys: ['under18', 'age18to28', 'age29to38', 'age39to48', 'age49to60', 'age61to75', 'age76plus'] },
  { id: 'q2', section: 1, type: 'single', optionKeys: ['male', 'female'] },
  { id: 'q3', section: 1, type: 'single', optionKeys: ['firstTimeGuest', 'lessThan6Months', 'sixMonthsTo2Years', 'threeTo5Years', 'moreThan5Years'] },
  { id: 'q4', section: 1, type: 'multi', optionKeys: ['familyFriendInvitation', 'movedToArea', 'seekingSpiritualGuidance', 'tigrayOrthodoxCommunity', 'holyDaySpecialProgram', 'childrenFamilyMinistry', 'other'], otherOptionKey: 'other' },
  { id: 'q5', section: 1, type: 'multi', optionKeys: ['growCloserToGod', 'receiveHolyMysteries', 'liturgyPrayerChanting', 'sermonSpiritualTeaching', 'fellowshipCommunity', 'childrenYouthEducation', 'orthodoxTraditionCulture'] },
  { id: 'q6', section: 1, type: 'single', optionKeys: ['always', 'often', 'sometimes', 'rarely', 'notYet'] },
  { id: 'q7', section: 1, type: 'text' },
  { id: 'q8', section: 2, type: 'multi', optionKeys: ['divineLiturgyCommunion', 'mahletSeatatKidan', 'sundaySibket', 'sundaySchoolYouth', 'bibleStudyAdult', 'virtualOnlinePrograms'] },
  { id: 'q9', section: 2, type: 'single', optionKeys: ['veryEasy', 'mostlyEasy', 'sometimesDifficult', 'veryDifficult'] },
  { id: 'q10', section: 2, type: 'single', optionKeys: ['highlyAppropriate', 'acceptableNeedsAdjustment', 'tooLongForFamily', 'preferAdjustedSchedule'] },
  { id: 'q11', section: 2, type: 'single', optionKeys: ['deeplyEnrichingIdeal', 'goodButLittleLong', 'moderatelyHelpfulNeedsFocus', 'desiresDeeperLongerSermon'] },
  { id: 'q12', section: 2, type: 'single', optionKeys: ['exceptionalUplifting', 'goodNeedsBroaderParticipation', 'fairNeedsOrganizationTraining', 'needsStructuralImprovement'] },
  { id: 'q13', section: 2, type: 'multi', optionKeys: ['workSchedules', 'distanceTransportation', 'languageComprehension', 'needClearerSchedule', 'lackYouthEngagement', 'needPastoralOutreach'] },
  { id: 'q14', section: 2, type: 'text' },
  { id: 'q15', section: 3, type: 'single', optionKeys: ['tigrinya', 'english', 'geez', 'bilingual', 'other'], otherOptionKey: 'other' },
  { id: 'q16', section: 3, type: 'multi', optionKeys: ['kidaseLiturgyTextScreens', 'sibketSermonTranslation', 'sundaySchoolYouth', 'sacramentPreparation', 'announcementsBulletins', 'scriptureReadings'] },
  { id: 'q17', section: 3, type: 'single', optionKeys: ['stronglySupport', 'support', 'neutralNoPreference', 'doNotSupport', 'needMoreInfo'] },
  { id: 'q18', section: 3, type: 'text' },
  { id: 'q19', section: 4, type: 'single', optionKeys: ['yesAtThisParish', 'yesAtAnotherParish', 'noSeekingGuidance', 'noNotCurrently'] },
  { id: 'q20', section: 4, type: 'single', optionKeys: ['monthlyOrAsNeeded', 'every2to3Months', 'duringMajorFasts', 'rarelyOrNever'] },
  { id: 'q21', section: 4, type: 'single', optionKeys: ['verySupported', 'supported', 'somewhatSupported', 'notSupportedEnough', 'haveNotRequested'] },
  { id: 'q22', section: 4, type: 'single', optionKeys: ['regularly', 'sometimes', 'rarely', 'never', 'newToChurch'] },
  { id: 'q23', section: 4, type: 'multi', optionKeys: ['homeHospitalVisits', 'financialPersonalHardship', 'spiritualCounseling', 'newcomerWelcome', 'bereavementGrief', 'preMaritalFamilyCounseling'] },
  { id: 'q24', section: 4, type: 'text' },
  { id: 'q25', section: 5, type: 'multi', optionKeys: ['yesAges0to9', 'yesAges10to17', 'yesAges18to30', 'noNotApplicable'] },
  { id: 'q26', section: 5, type: 'single', optionKeys: ['highlyEffective', 'moderateNeedsModernBilingual', 'inadequateUrgentYouthMinistry', 'unsureNotApplicable'] },
  { id: 'q27', section: 5, type: 'multi', optionKeys: ['ageGradedSundaySchool', 'clergyMentorship', 'englishBibleStudyApologetics', 'youthFellowshipRetreats', 'sacredZemaLiturgicalTraining', 'parentSupport'] },
  { id: 'q28', section: 5, type: 'text' },
  { id: 'q29', section: 6, type: 'single', optionKeys: ['exceptionalExcellent', 'satisfactoryGood', 'fairMinorCareNeeded', 'needsMajorCleanup'] },
  { id: 'q30', section: 6, type: 'single', optionKeys: ['excellent', 'good', 'fair', 'needsImprovement'] },
  { id: 'q31', section: 6, type: 'single', optionKeys: ['fullyFunctional', 'adequateNeedsTextEnhancement', 'soundNeedsTuning', 'needsImmediateTechUpgrade'] },
  { id: 'q32', section: 6, type: 'multi', optionKeys: ['soundSystem', 'displayScreens', 'chairsSeating', 'airConditioning', 'elevator', 'lighting', 'other'], otherOptionKey: 'other', maxSelect: 2 },
  { id: 'q33', section: 6, type: 'single', optionKeys: ['worshipArea', 'dejeselamCommonAreas', 'sanctuarySurroundings', 'sundaySchoolClassrooms', 'parkingTrafficFlow', 'accessibilityElders', 'buildingSafetySigns'] },
  { id: 'q34', section: 7, type: 'single', optionKeys: ['excellent', 'good', 'fair', 'needsImprovement'] },
  { id: 'q35', section: 7, type: 'multi', optionKeys: ['inPersonAnnouncement', 'textSms', 'whatsappViber', 'email', 'printedNotice', 'facebookSocialMedia', 'churchWebsite'] },
  { id: 'q36', section: 7, type: 'single', optionKeys: ['veryWell', 'well', 'sometimes', 'needsImprovement', 'iDoNotKnow'] },
  { id: 'q37', section: 7, type: 'multi', optionKeys: ['newcomerWelcomeFollowUp', 'careElders', 'familyFellowship', 'youngAdultFellowship', 'charityOutreach', 'supportFamiliesInCrisis', 'communityEducationWorkshops', 'evangelismMission'] },
  { id: 'q38', section: 7, type: 'text' },
  { id: 'q39', section: 8, type: 'multi', optionKeys: ['zemaChoirWorshipSupport', 'cleaningSetupMaintenance', 'sundaySchoolYouthTeaching', 'welcomingNewcomerSupport', 'mediaSoundScreensTech', 'charityVisitationOutreach', 'fundraisingEventOrganization', 'professionalSkills', 'needMoreInfo'], otherOptionKey: 'professionalSkills' },
  { id: 'q40', section: 8, type: 'single', optionKeys: ['veryClear', 'mostlyClear', 'somewhatUnclear', 'notClear', 'newHaveNotReceivedInfo'] },
  { id: 'q41', section: 8, type: 'multi', optionKeys: ['clearMinistryRoles', 'volunteerSignUpForm', 'trainingGuidance', 'personalInvitationFollowUp', 'regularSchedule', 'childcareDuringActivities', 'recognitionEncouragement', 'other'], otherOptionKey: 'other' },
  { id: 'q42', section: 8, type: 'multi', optionKeys: ['prayer', 'regularGiving', 'specialProjectBuilding', 'volunteerTime', 'professionalTechnicalExpertise', 'invitingOthers', 'outreachCharity', 'needMoreInfo'] },
  { id: 'q43', section: 9, type: 'single', optionKeys: ['veryHighConfidence', 'highConfidence', 'someConfidence', 'lowConfidence', 'notEnoughInfo'] },
  { id: 'q44', section: 9, type: 'single', optionKeys: ['veryClearly', 'clearly', 'sometimesClearly', 'notClearly', 'iDoNotKnow'] },
  { id: 'q45', section: 9, type: 'single', optionKeys: ['veryConfident', 'confident', 'somewhatConfident', 'notConfident', 'notEnoughInfo'] },
  { id: 'q46', section: 9, type: 'multi', optionKeys: ['regularFinancialSummaries', 'clearAnnualPlansGoals', 'betterExplanationMajorDecisions', 'moreOpportunitiesMemberQuestions', 'clearVolunteerMinistryResponsibilities', 'fasterResponseToConcerns', 'consistentPoliciesProcedures'], maxSelect: 3 },
  { id: 'q47', section: 9, type: 'text' },
  { id: 'q48', section: 10, type: 'single', optionKeys: ['yesVisitedInPerson', 'seenPhotosUpdates', 'awareButNotVisited', 'notYetNotInformed'] },
  { id: 'q49', section: 10, type: 'single', optionKeys: ['veryInformed', 'informed', 'somewhatInformed', 'notInformed'] },
  { id: 'q50', section: 10, type: 'single', optionKeys: ['excellentProgress', 'goodProgress', 'satisfactory', 'movingTooSlowly', 'notEnoughInfo'] },
  { id: 'q51', section: 10, type: 'multi', optionKeys: ['completeNewBuildingResponsibly', 'expandChildrenYouthMinistry', 'strengthenClergyPastoralCapacity', 'developCharityOutreach', 'improveWorshipTeachingLanguageAccess', 'buildFinancialSustainability', 'trainFutureServantsDeaconsLeaders', 'strengthenEvangelismWelcomeFamilies'], maxSelect: 3 },
  { id: 'q52', section: 10, type: 'text' },
  { id: 'q53', section: 11, type: 'single', optionKeys: ['verySatisfied', 'satisfied', 'neutral', 'dissatisfied', 'veryDissatisfied'] },
  { id: 'q54', section: 11, type: 'text' },
  { id: 'q55', section: 11, type: 'text' },
  { id: 'q56', section: 11, type: 'text' }
];

export function questionsForSection(section: number): SurveyQuestionDef[] {
  return SURVEY_QUESTIONS.filter(q => q.section === section);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false surveyDefinitions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/survey/surveyDefinitions.ts frontend/src/components/survey/__tests__/surveyDefinitions.test.ts
git commit -m "feat: add frontend survey question structure (church-services-assessment-2026)"
```

---

### Task 6: Frontend — `survey` i18n content (EN + TI, all 56 questions)

The English wording below is taken directly from `frontend/public/docs/Church Services Assesment Survey_English.pdf`. The Tigrigna wording is taken directly from the Tigrigna PDF wherever it already matched the English structure; a small number of strings had no equivalent in the Tigrigna PDF (because that PDF was missing an option, had different numeric brackets, or lacked a section instruction) and are freshly translated here — per the approved "English is canonical" resolution. Step 5 below logs exactly which strings are fresh translations in the project's existing `tigrigna-translation-review.md`, so a native speaker can check them like any other draft string in that file.

**Files:**
- Modify: `frontend/src/i18n/dictionaries.ts`
- Create: `frontend/src/i18n/__tests__/surveyDictionary.test.ts`
- Modify: `tigrigna-translation-review.md`

**Interfaces:**
- Produces: `t('survey.q1.label')`, `t('survey.q1.options.under18')`, `t('survey.section1.title')`, `t('survey.wizard.back')`, `t('survey.thankYou.title')`, `t('survey.homeCard.title')`, `t('survey.report.title')`, etc. — consumed via `useLanguage()`'s `t()` in Tasks 8, 9, 10, 11.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/i18n/__tests__/surveyDictionary.test.ts
import { en, ti } from '../dictionaries';
import { SURVEY_QUESTIONS } from '../../components/survey/surveyDefinitions';

describe('survey i18n coverage', () => {
  it.each(SURVEY_QUESTIONS)('$id has an en and ti label', (q) => {
    expect((en as any).survey[q.id]?.label).toEqual(expect.any(String));
    expect((ti as any).survey[q.id]?.label).toEqual(expect.any(String));
  });

  it.each(SURVEY_QUESTIONS.filter(q => q.optionKeys))('$id has en and ti text for every option', (q) => {
    q.optionKeys!.forEach(key => {
      expect((en as any).survey[q.id].options[key]).toEqual(expect.any(String));
      expect((ti as any).survey[q.id].options[key]).toEqual(expect.any(String));
    });
  });

  it('has en and ti section titles for sections 1 through 11', () => {
    for (let i = 1; i <= 11; i++) {
      expect((en as any).survey[`section${i}`].title).toEqual(expect.any(String));
      expect((ti as any).survey[`section${i}`].title).toEqual(expect.any(String));
    }
  });

  it('has en and ti member status options', () => {
    ['firstTimeGuest', 'newMember', 'existingMember'].forEach(key => {
      expect((en as any).survey.memberStatus.options[key]).toEqual(expect.any(String));
      expect((ti as any).survey.memberStatus.options[key]).toEqual(expect.any(String));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `CI=true npx react-scripts test --watchAll=false surveyDictionary.test.ts`
Expected: FAIL — `en.survey` / `ti.survey` are undefined.

- [ ] **Step 3: Add the `survey` block to the `en` dictionary**

In `frontend/src/i18n/dictionaries.ts`, insert as a new top-level property of the `en` object (the `[key: string]: any` index signature on `Dictionaries` already permits this — no interface change needed), immediately before the `en` object's closing `};` (currently around line 2599):

```ts
  survey: {
    memberStatus: {
      label: 'Member Status',
      options: { firstTimeGuest: 'First-time / Guest', newMember: 'New Member', existingMember: 'Existing Member' }
    },
    intro: {
      title: 'Church Services & Congregational Spiritual Life Assessment Survey',
      blessing: '"In the name of the Father, the Son, and the Holy Spirit, One God. Amen."',
      welcome: 'Dear Beloved Faithful in Christ, Peace be unto you. To glorify Almighty God and nurture our sacred worship, sacramental life, spiritual education, youth programs, parish facilities, and community outreach, we prayerfully invite your thoughtful and anonymous feedback.',
      verse: '"Let all things be done decently and in order." — 1 Corinthians 14:40',
      confidentialityNotice: 'Anonymous & confidential. Do not write your name or phone.'
    },
    section1: { title: 'About You & Your Spiritual Journey', instruction: 'These questions help us understand and serve our diverse faithful across all generations.' },
    section2: { title: 'Divine Liturgy, Chanting (Zema) & Spiritual Services', instruction: 'Please reflect on Kidase, Kidan, Mahlet, Seatat, Zema/Mezmur, Sermon, Sunday School, Bible study, and other spiritual programs.' },
    section3: { title: 'Language, Translation & Understanding', instruction: "Our church seeks to deliver its spiritual services to faithful in their mother tongue languages: Tigrinya, English, and Ge'ez (for Zema)." },
    section4: { title: 'Holy Sacraments & Pastoral Care', instruction: 'Please answer from your experience. Sacraments include Baptism, Chrismation, Eucharist, Confession, Matrimony, Holy Orders, & Anointing of the Sick.' },
    section5: { title: 'Youth, Children & Young Adult Ministry', instruction: 'Our children and youth are precious members of the Church and future servants of the Faith.' },
    section6: { title: 'Church Environment, Facilities & Equipment', instruction: 'Please consider cleanliness, comfort, safety, accessibility, parking, classrooms, restrooms, sound, screens, seating, AC, and the elevator.' },
    section7: { title: 'Communication, Fellowship & Community Support', instruction: 'Strong communication and loving fellowship help the church serve members in both joyful and difficult times.' },
    section8: { title: 'Service, Volunteering & Stewardship', instruction: 'Every member has God-given gifts that build up the Church. Stewardship includes prayer, time, talent, and faithful giving.' },
    section9: { title: 'Church Leadership, Administration & Financial Accountability', instruction: 'This section concerns clergy leadership, Sebeka Gubae, communication, property care, and faithful stewardship.' },
    section10: { title: 'New Church Building, Growth & Evangelical Mission', instruction: "Please consider the parish's future, the new building, outreach, and service to present and future generations." },
    section11: { title: 'Overall Spiritual Reflection & Prayerful Recommendations', instruction: 'Your final reflections will guide the spiritual growth, unity, and sacred mission of our parish.' },
    q1: { label: 'What is your age group?', options: { under18: 'Under 18 years', age18to28: '18–28 years', age29to38: '29–38 years', age39to48: '39–48 years', age49to60: '49–60 years', age61to75: '61–75 years', age76plus: '76 years or older' } },
    q2: { label: 'What is your gender?', options: { male: 'Male', female: 'Female' } },
    q3: { label: 'How long have you been a member or visitor of this parish?', options: { firstTimeGuest: 'First-time / Guest', lessThan6Months: 'Less than 6 months', sixMonthsTo2Years: '6 months – 2 years', threeTo5Years: '3–5 years', moreThan5Years: 'More than 5 years' } },
    q4: { label: 'What primarily inspired or guided you to join our parish?', options: { familyFriendInvitation: 'Family or friend invitation', movedToArea: 'Moved to the area', seekingSpiritualGuidance: 'Seeking spiritual guidance and peace in Christ', tigrayOrthodoxCommunity: 'Tigray Orthodox Tewahedo worship & community', holyDaySpecialProgram: 'A holy day or special program', childrenFamilyMinistry: 'Children or family ministry', other: 'Other' } },
    q5: { label: 'What is your primary motivation for attending church regularly?', options: { growCloserToGod: 'To grow closer to God', receiveHolyMysteries: 'To receive the Holy Mysteries / Sacraments', liturgyPrayerChanting: 'Liturgy, prayer and chanting (Kidase / Zema)', sermonSpiritualTeaching: 'Sermon and spiritual teaching (Sibket)', fellowshipCommunity: 'Fellowship and community', childrenYouthEducation: 'Children and youth education', orthodoxTraditionCulture: 'Orthodox tradition and cultural connection' } },
    q6: { label: 'When you come to church, do you feel welcomed, respected, and included in the church family?', options: { always: 'Always', often: 'Often', sometimes: 'Sometimes', rarely: 'Rarely', notYet: 'Not yet' } },
    q7: { label: 'What would help visitors and members feel more welcomed and spiritually connected?' },
    q8: { label: 'In which church services or programs do you participate most actively?', options: { divineLiturgyCommunion: 'Divine Liturgy (Kidase) & Holy Communion', mahletSeatatKidan: 'Mahlet, Seatat, and Kidan (Night/Morning Prayers)', sundaySibket: 'Sunday Sibket (Sermons & Spiritual Teachings)', sundaySchoolYouth: 'Sunday School & Youth Program', bibleStudyAdult: 'Bible Study & Adult Spiritual Classes', virtualOnlinePrograms: 'Virtual / Online Spiritual Programs' } },
    q9: { label: 'How easy is it for you to follow the prayers, Kidase, readings, and responses?', options: { veryEasy: 'Very easy', mostlyEasy: 'Mostly easy', sometimesDifficult: 'Sometimes difficult', veryDifficult: 'Very difficult' } },
    q10: { label: 'How do you evaluate the overall Sunday schedule and service timing?', options: { highlyAppropriate: 'Highly appropriate and spiritually fulfilling', acceptableNeedsAdjustment: 'Acceptable, but needs small timing adjustments', tooLongForFamily: 'Too long or challenging start/end time for family', preferAdjustedSchedule: 'Prefer adjusted schedule' } },
    q11: { label: 'How do you feel about the usual Sunday Sermons (Sibket) length of about 30–40 minutes?', options: { deeplyEnrichingIdeal: 'Deeply enriching, practical, and ideal length', goodButLittleLong: 'Good, but sermon is a little too long', moderatelyHelpfulNeedsFocus: 'Moderately helpful; needs more focus on daily life/youth', desiresDeeperLongerSermon: 'Desires deeper teaching / longer sermon' } },
    q12: { label: 'What is your assessment of the spiritual chanting, choir (Zema/Mezmur), and congregational participation?', options: { exceptionalUplifting: 'Exceptional, deeply moving, and uplifting', goodNeedsBroaderParticipation: 'Good, but needs broader congregational participation', fairNeedsOrganizationTraining: 'Fair; requires better organization & choir training', needsStructuralImprovement: 'Needs structural improvement' } },
    q13: { label: 'What primarily prevents members from attending weekly Sunday Kidase regularly outside of major Feasts?', options: { workSchedules: 'Work schedules & modern life obligations', distanceTransportation: 'Distance & transportation constraints', languageComprehension: 'Language or comprehension barriers', needClearerSchedule: 'Need for clearer schedule & reminders', lackYouthEngagement: 'Lack of youth/children engagement during service', needPastoralOutreach: 'Need for stronger pastoral outreach & personal connection' } },
    q14: { label: 'Please share one recommendation to strengthen worship, participation, or service timing:' },
    q15: { label: 'Which language do you understand best for spiritual teaching?', options: { tigrinya: 'Tigrinya', english: 'English', geez: "Ge'ez", bilingual: 'Bilingual (Tigrinya/English)', other: 'Other' } },
    q16: { label: 'Where would translation or language support help most?', options: { kidaseLiturgyTextScreens: 'Kidase / Liturgy text screens', sibketSermonTranslation: 'Sibket / Sermon translation', sundaySchoolYouth: 'Sunday School & Youth', sacramentPreparation: 'Sacrament Preparation', announcementsBulletins: 'Announcements & Bulletins', scriptureReadings: 'Scripture Readings' } },
    q17: { label: 'How do you feel about the current practice of using more English on one Sunday each month for children, youth, and English-speaking members (3:1 language ratio)?', options: { stronglySupport: 'Strongly support', support: 'Support', neutralNoPreference: 'Neutral / no preference', doNotSupport: 'Do not support', needMoreInfo: 'Need more information' } },
    q18: { label: 'What specific language support would help you or your children benefit more fully from church services, and why?' },
    q19: { label: 'Do you currently have an assigned Repentance Father (Confessor)?', options: { yesAtThisParish: 'Yes, dedicated Spiritual Father at this parish', yesAtAnotherParish: 'Yes, at another Orthodox Tewahedo parish', noSeekingGuidance: 'No, but seeking guidance to find one', noNotCurrently: 'No, I do not currently have one' } },
    q20: { label: 'How regularly do you meet with your Repentance Father or Clergy for spiritual counseling and confession?', options: { monthlyOrAsNeeded: 'Monthly or as needed', every2to3Months: 'Every 2–3 months', duringMajorFasts: 'During major Fasts/Feasts', rarelyOrNever: 'Rarely or Never' } },
    q21: { label: 'When you request a sacramental or pastoral service, how supported do you feel by the clergy and church?', options: { verySupported: 'Very supported', supported: 'Supported', somewhatSupported: 'Somewhat supported', notSupportedEnough: 'Not supported enough', haveNotRequested: 'Have not requested' } },
    q22: { label: "How often do clergy or designated church servants check on your family's spiritual and personal well-being?", options: { regularly: 'Regularly', sometimes: 'Sometimes', rarely: 'Rarely', never: 'Never', newToChurch: 'New to church' } },
    q23: { label: 'Which forms of pastoral care should be strengthened most?', options: { homeHospitalVisits: 'Home/hospital visits for sick & elderly', financialPersonalHardship: 'Support during financial or personal hardship', spiritualCounseling: 'Spiritual counseling & repentance guidance', newcomerWelcome: 'Newcomer welcome and follow-up outreach', bereavementGrief: 'Support during bereavement & grief', preMaritalFamilyCounseling: 'Pre-marital & family counseling' } },
    q24: { label: 'Please recommend one way our respected clergy/fathers and servants can strengthen pastoral care and relationships with the faithful:' },
    q25: { label: 'Do you have children, teenagers, or young adults in your household attending church?', options: { yesAges0to9: 'Yes – ages 0–9', yesAges10to17: 'Yes – ages 10–17', yesAges18to30: 'Yes – ages 18–30', noNotApplicable: 'No / Not applicable' } },
    q26: { label: 'How effective are church programs in nurturing the spiritual growth of youth and children?', options: { highlyEffective: 'Highly effective; robust Orthodox education', moderateNeedsModernBilingual: 'Moderate; needs modern & bilingual approaches', inadequateUrgentYouthMinistry: 'Inadequate; urgently needs dedicated Youth Ministry', unsureNotApplicable: 'Unsure / Not applicable' } },
    q27: { label: 'Which programs should be strengthened for children and youth?', options: { ageGradedSundaySchool: 'Age-graded Sunday School curriculum', clergyMentorship: 'Clergy, deacon & adult mentorship programs', englishBibleStudyApologetics: 'English Bible Study & Apologetics classes', youthFellowshipRetreats: 'Youth fellowship retreats, outings & service projects', sacredZemaLiturgicalTraining: 'Sacred Zema, Mezmur, & Liturgical response training', parentSupport: 'Parent support and family faith resources' } },
    q28: { label: 'What is the single most important action our parish must take to keep our youth strong in faith?' },
    q29: { label: 'How do you rate the overall cleanliness, atmosphere, and comfort of church facilities? (Upstairs, Dejeselam, Classrooms, Restrooms, etc.)', options: { exceptionalExcellent: 'Exceptional / Excellent', satisfactoryGood: 'Satisfactory / Good', fairMinorCareNeeded: 'Fair (Minor care needed)', needsMajorCleanup: 'Needs major cleanup' } },
    q30: { label: 'How do you rate the sound system and your ability to hear prayers, readings, mezmur, and sermons?', options: { excellent: 'Excellent', good: 'Good', fair: 'Fair', needsImprovement: 'Needs improvement' } },
    q31: { label: 'How helpful are the display screens for prayers, readings, announcements, and translations?', options: { fullyFunctional: 'Fully functional, clear audio and screen visibility', adequateNeedsTextEnhancement: 'Adequate, but display text/translations need enhancement', soundNeedsTuning: 'Sound system needs tuning/clarity improvement', needsImmediateTechUpgrade: 'Needs immediate technical upgrade' } },
    q32: { label: 'Which equipment or comfort item needs improvement first?', options: { soundSystem: 'Sound system', displayScreens: 'Display screens / visual', chairsSeating: 'Chairs or seating', airConditioning: 'Air conditioning / temp', elevator: 'Elevator', lighting: 'Lighting', other: 'Other' } },
    q33: { label: 'Which facility area requires the most immediate attention?', options: { worshipArea: 'Worship area', dejeselamCommonAreas: 'Dejeselam and common areas', sanctuarySurroundings: 'Sanctuary surroundings', sundaySchoolClassrooms: "Sunday school and Children's classrooms", parkingTrafficFlow: 'Parking and traffic flow', accessibilityElders: 'Accessibility for elders & people with disabilities', buildingSafetySigns: 'Building safety and signs' } },
    q34: { label: 'How do you rate church announcements and communication?', options: { excellent: 'Excellent', good: 'Good', fair: 'Fair', needsImprovement: 'Needs improvement' } },
    q35: { label: 'How do you prefer to receive church announcements and spiritual resources?', options: { inPersonAnnouncement: 'In-person announcement', textSms: 'Text / SMS', whatsappViber: 'WhatsApp / Viber', email: 'Email', printedNotice: 'Printed notice', facebookSocialMedia: 'Facebook / social media', churchWebsite: 'Church website' } },
    q36: { label: 'How well does the church support members during illness, bereavement, family crisis, or hardship?', options: { veryWell: 'Very well', well: 'Well', sometimes: 'Sometimes', needsImprovement: 'Needs improvement', iDoNotKnow: 'I do not know' } },
    q37: { label: 'Which community ministries should be strengthened?', options: { newcomerWelcomeFollowUp: 'Newcomer welcome and follow-up', careElders: 'Care for elders and homebound members', familyFellowship: 'Family fellowship', youngAdultFellowship: 'Young-adult fellowship', charityOutreach: 'Charity and outreach', supportFamiliesInCrisis: 'Support for families in crisis', communityEducationWorkshops: 'Community education and workshops', evangelismMission: 'Evangelism and mission' } },
    q38: { label: 'What is one practical way the church can strengthen Christian fellowship and care among members?' },
    q39: { label: 'In which ways would you be willing to serve?', options: { zemaChoirWorshipSupport: 'Zema / choir / worship support', cleaningSetupMaintenance: 'Cleaning, setup, maintenance, or gardening', sundaySchoolYouthTeaching: 'Sunday School or youth teaching', welcomingNewcomerSupport: 'Welcoming and newcomer support', mediaSoundScreensTech: 'Media, sound, screens, or tech', charityVisitationOutreach: 'Charity, visitation, or outreach', fundraisingEventOrganization: 'Fundraising or event organization', professionalSkills: 'Professional skills (finance, legal, health, etc.)', needMoreInfo: 'I need more information before volunteering' } },
    q40: { label: "How clear is the church's teaching and communication about Asrat, Bekurat, offerings, and other forms of stewardship?", options: { veryClear: 'Very clear', mostlyClear: 'Mostly clear', somewhatUnclear: 'Somewhat unclear', notClear: 'Not clear', newHaveNotReceivedInfo: 'I am new and have not received this information' } },
    q41: { label: 'What would make it easier for members to volunteer or serve?', options: { clearMinistryRoles: 'Clear ministry roles', volunteerSignUpForm: 'A volunteer sign-up form', trainingGuidance: 'Training and guidance', personalInvitationFollowUp: 'Personal invitation and follow-up', regularSchedule: 'A regular schedule', childcareDuringActivities: 'Childcare during service activities', recognitionEncouragement: 'Recognition and encouragement', other: 'Other' } },
    q42: { label: "Which type of support are you willing to offer for the church's mission?", options: { prayer: 'Prayer', regularGiving: 'Regular giving', specialProjectBuilding: 'Special project or building contribution', volunteerTime: 'Volunteer time', professionalTechnicalExpertise: 'Professional or technical expertise', invitingOthers: 'Inviting others', outreachCharity: 'Outreach & charity', needMoreInfo: 'Need more information' } },
    q43: { label: "How much confidence do you have in the church leadership's spiritual direction and service to the congregation?", options: { veryHighConfidence: 'Very high confidence', highConfidence: 'High confidence', someConfidence: 'Some confidence', lowConfidence: 'Low confidence', notEnoughInfo: 'Not enough information to answer' } },
    q44: { label: 'How clearly does the Sebeka Gubae communicate important decisions, plans, and responsibilities?', options: { veryClearly: 'Very clearly', clearly: 'Clearly', sometimesClearly: 'Sometimes clearly', notClearly: 'Not clearly', iDoNotKnow: 'I do not know' } },
    q45: { label: 'How confident are you that church money, Asrat, Bekurat, offerings, and property are managed responsibly and transparently?', options: { veryConfident: 'Very confident', confident: 'Confident', somewhatConfident: 'Somewhat confident', notConfident: 'Not confident', notEnoughInfo: 'Not enough info' } },
    q46: { label: 'Which administrative practices would most improve trust and participation?', options: { regularFinancialSummaries: 'Regular financial summaries', clearAnnualPlansGoals: 'Clear annual plans and goals', betterExplanationMajorDecisions: 'Better explanation of major decisions', moreOpportunitiesMemberQuestions: 'More opportunities for member questions', clearVolunteerMinistryResponsibilities: 'Clear volunteer and ministry responsibilities', fasterResponseToConcerns: 'Faster response to concerns', consistentPoliciesProcedures: 'Consistent policies and procedures' } },
    q47: { label: 'What is one constructive recommendation for the clergy, Sebeka Gubae, or church administration?' },
    q48: { label: 'Have you visited or seen the new church building project?', options: { yesVisitedInPerson: 'Yes – visited in person', seenPhotosUpdates: 'Seen photos or updates', awareButNotVisited: 'Aware, but not visited', notYetNotInformed: 'Not yet / not informed' } },
    q49: { label: "How informed do you feel about the new building's progress, needs, and next steps?", options: { veryInformed: 'Very informed', informed: 'Informed', somewhatInformed: 'Somewhat informed', notInformed: 'Not informed' } },
    q50: { label: 'How do you rate the progress of the building modification and preparation work?', options: { excellentProgress: 'Excellent progress', goodProgress: 'Good progress', satisfactory: 'Satisfactory', movingTooSlowly: 'Moving too slowly', notEnoughInfo: 'Not enough info' } },
    q51: { label: 'Which priorities are most important as the church grows?', options: { completeNewBuildingResponsibly: 'Complete the new building responsibly', expandChildrenYouthMinistry: 'Expand children and youth ministry', strengthenClergyPastoralCapacity: 'Strengthen clergy and pastoral-care capacity', developCharityOutreach: 'Develop charity and community outreach', improveWorshipTeachingLanguageAccess: 'Improve worship, teaching, and language access', buildFinancialSustainability: 'Build stronger financial sustainability', trainFutureServantsDeaconsLeaders: 'Train future servants, deacons, teachers, & leaders', strengthenEvangelismWelcomeFamilies: 'Strengthen evangelism and welcome new families' } },
    q52: { label: "What major recommendation do you have for expanding the church's evangelical mission and spiritual service?" },
    q53: { label: "Overall, how satisfied are you with the church's worship, spiritual care, teaching, fellowship, facilities, and administration?", options: { verySatisfied: 'Very satisfied', satisfied: 'Satisfied', neutral: 'Neutral', dissatisfied: 'Dissatisfied', veryDissatisfied: 'Very dissatisfied' } },
    q54: { label: 'What is one sacred practice or service that our church does especially well and should preserve?' },
    q55: { label: 'What is the single most important recommendation or vision you wish to share with our Clergy and Sebeka Gubae?' },
    q56: { label: 'Please share any other prayerful recommendation, concern, or idea that could strengthen the spiritual life, unity, and service of our church:' },
    wizard: {
      sectionProgress: 'Section {current} of {total}',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
      submitting: 'Submitting...',
      skipHint: 'Skip any question that does not apply to you.',
      otherPlaceholder: 'Please specify...',
      selectUpTo: 'Select up to {n}',
      submitError: 'Something went wrong submitting your response. Please try again.'
    },
    thankYou: {
      title: 'Thank You',
      body: 'May the God of peace, through the intercession of the Holy Mother Saint Mary and Saint Abune Aregawi, bless you and your family with abundant spiritual grace and peace. Amen.',
      gratitude: 'Thank you for your pious contribution to the spiritual growth and mission of Debre Tsehay Abune Aregawi Church!'
    },
    homeCard: {
      title: 'Church Services Survey',
      description: 'Share your anonymous feedback on worship, ministry, and parish life — takes about 10 minutes.'
    },
    report: {
      title: 'Church Services Survey — Report',
      totalResponses: 'Total Responses',
      freeTextAnswers: 'Free-text answers',
      noResponsesYet: 'No responses yet.',
      accessDenied: 'You do not have permission to view this page.',
      loading: 'Loading report...',
      loadError: 'Failed to load the survey report.'
    }
  },
```

- [ ] **Step 4: Add the `survey` block to the `ti` dictionary**

Insert as a new top-level property of the `ti` object, immediately before its closing `};` (currently around line 4481):

```ts
  survey: {
    memberStatus: {
      label: 'ኩነታት ኣባልነት',
      options: { firstTimeGuest: 'ንመጀመርታ ግዜ/ጋሻ', newMember: 'ሓድሽ ኣባል', existingMember: 'ነባር ኣባል' }
    },
    intro: {
      title: 'ናይ ቤተ ክርስቲያናዊ ኣገልግሎትን ማሕበረ ምእመናናዊ መንፈሳዊ ሂወትን መርመራ ዳህሳስ',
      blessing: '"በስመ ኣብ ወወልድ ወመንፈስ ቅዱስ ሓደ ኣምላክ። ኣሜን።"',
      welcome: 'ፍቁራት ምእመናን ክርስቶስ፣ ሰላም ይሃልኹም። ንልዑል እግዚኣብሔር ክብሪ ንምሃብን ቅዱስ ኣምልኾና፣ ምስጢራዊ ሂወትና፣ መንፈሳዊ ትምህርትና፣ ኣገልግሎት መንእሰያትና፣ ንብረት ደብርናን ኣገልግሎት ማሕበረሰብናን ንምሕያልን፣ በዘኽብር ናይ ግምት ሓሳብኩምን ስም ብዘይ ምጥቃስ ርእይቶኹምን ንዕድም።',
      verse: '"ኩሉ ብስርዓትን ብግቡእ ኣገባብን ይኹን።" — 1 ቆረንቶስ 14:40',
      confidentialityNotice: 'ስም ብዘይ ምጥቃስን ብምስጢርን ዝተታሕዘ። ስም ወይ ቁፅሪ ተሌፎን ኣይትፃሕፉ።'
    },
    section1: { title: 'ብዛዕባኹምን መንፈሳዊ ጉዕዞኹምን', instruction: 'እዞም ሕቶታት ኣብ ኩሉ ናይ ዕድመ ደረጃ ዘለዉ ምእመናንና ብዝበለፀ ክንፈልጥን ከነገልግልን ይሕግዙና።' },
    section2: { title: 'ቅዳሴ፣ ዜማን መንፈሳዊ ኣገልግሎታትን', instruction: 'ብዛዕባ ቅዳሴ፣ ኪዳን፣ ማኅሌት፣ ሰዓታት፣ ዜማ/መዝሙር፣ ስብከትን ካልኦት መንፈሳዊ መደባትን ኣስተንትኑ።' },
    section3: { title: 'ቋንቋ፣ ትርጉምን ምርዳእን', instruction: 'ቤተ ክርስቲያንና መንፈሳዊ ኣገልግሎት ብትግርኛ፣ እንግሊዝኛን ግእዝን ንምቕራብ ትፅዕር።' },
    section4: { title: 'ቅዱሳት ምሥጢራትን ኣገልግሎት መጓሰን', instruction: 'ቅዱሳት ምሥጢራት፦ ጥምቀት፣ ሜሮን፣ ቁርባን፣ ንስሓ፣ ተክሊል፣ ክህነትን ቀንዲል (ቅብኣተ ሕሙማን)ን።' },
    section5: { title: 'ኣገልግሎት ሕፃናትን መናእሰይን', instruction: 'ደቅናን መንእሰያትናን ክቡራት ኣባላት ቤተ ክርስቲያንን መጻኢ ኣገልገልትን እምነትን እዮም።' },
    section6: { title: 'ከባቢ፣ ህንፃን ንዋያት ቤተ ክርስቲያንን', instruction: 'ፅሬት፣ ምቹውነት፣ ድሕንነት፣ ተበጻሕነት፣ መኪና መዕረፊ፣ ክፍልታት፣ ሽቓቕ፣ ድምጺ፣ ስክሪን፣ ወንበር፣ ኤርኮንዲሽንን ሊፍትን ኣስተውዕሉ።' },
    section7: { title: 'ርክብ ቤተ ክርስቲያንን ምእመናንን', instruction: 'ፅኑዕ ርክብን ፍቕራዊ ሕብረትን ቤተ ክርስቲያን ኣብ ሓጎስን ፈተናን ኣባላታ ክተገልግል ይሕግዛ።' },
    section8: { title: 'ኣገልግሎት፣ ተሳትፎን መጋቢነትን', instruction: 'ነፍስወከፍ ኣባል ካብ እግዚኣብሔር እተዋህበ ውህበት ኣለዎ ንቤተ ክርስቲያን ዘህንፅ። መጋቢነት ጸሎት፣ ግዜ፣ ክእለትን እሙን ውፈያን የጠቓልል።' },
    section9: { title: 'መሪሕነት፣ ምምሕዳርን ገንዘባዊ ተሓታትነትን', instruction: 'እዚ ክፍሊ መሪሕነት ካህናት፣ ሰበካ ጉባኤ፣ ርክብ፣ ክንክን ንብረትን እሙን መጋቢነትን ይምልከት።' },
    section10: { title: 'ሓድሽ ህንጻ፣ ዕብየትን ወንጌላዊ ተልእኾን', instruction: 'ብዛዕባ መጻኢ ደብርና፣ ሓድሽ ህንጻ፣ ወፃኢ ኣገልግሎትን ንህልውን መጻእን ወለዶ ዝወሃብ ኣገልግሎትን ኣስተንትኑ።' },
    section11: { title: 'ጠቕላላ መንፈሳዊ ኣስተንትኖን ጸሎታዊ ምኽርን', instruction: 'ናይ መወዳእታ ሓሳባትኩም መንፈሳዊ ዕብየት፣ ሓድነትን ቅዱስ ተልእኾን ደብርና ክመርሕ እዩ።' },
    q1: { label: 'ዕድመኹም ኣብ ኣየናይ ምድብ ይርከብ?', options: { under18: 'ትሕቲ 18 ዓመት', age18to28: '18–28 ዓመት', age29to38: '29–38 ዓመት', age39to48: '39–48 ዓመት', age49to60: '49–60 ዓመት', age61to75: '61–75 ዓመት', age76plus: '76 ዓመት ወይ ልዕሊኡ' } },
    q2: { label: 'ጾታ?', options: { male: 'ተባዕታይ', female: 'ኣንስታይ' } },
    q3: { label: 'ኣባል ወይ ተሳታፊ ናይዚ ደብሪ ካብ እትኾኑ ክንደይ ግዜ ገይርኩም?', options: { firstTimeGuest: 'ንመጀመርታ ግዜ/ጋሻ', lessThan6Months: 'ትሕቲ 6 ወርሒ', sixMonthsTo2Years: '6 ወርሒ–2 ዓመት', threeTo5Years: '3–5 ዓመት', moreThan5Years: 'ልዕሊ 5 ዓመት' } },
    q4: { label: 'ናብዚ ደብሪ ክትፅንበሩ ብቐንዱ ዝሓገዘኩም እንታይ እዩ?', options: { familyFriendInvitation: 'ዕድመ ስድራ/መሓዛ', movedToArea: 'መንበሪአይ ናብዚ ከባቢ ስለዝቐየርኩ', seekingSpiritualGuidance: 'መንፈሳዊ መምርሒን ሰላም ክርስቶስን ብምድላይ', tigrayOrthodoxCommunity: 'ናይ ትግራይ ኦርቶዶክስ ተዋሕዶ ኣምልኾን ማሕበረሰብን', holyDaySpecialProgram: 'በዓል/ፍሉይ መርሓ ግብሪ', childrenFamilyMinistry: 'ኣገልግሎት ሕፃናት/ስድራ', other: 'ካልእ' } },
    q5: { label: 'ቀፃላይነት ብዘለዎ ናብ ቤተ ክርስቲያን ንምምፃእ ዋና ምኽንያትኩም እንታይ እዩ?', options: { growCloserToGod: 'ናብ እግዚኣብሔር ዝያዳ ንምቕራብ', receiveHolyMysteries: 'ቅዱሳት ምሥጢራት ንምቕባል', liturgyPrayerChanting: 'ቅዳሴ፣ ጸሎትን መዝሙርን', sermonSpiritualTeaching: 'ስብከትን መንፈሳዊ ትምህርትን', fellowshipCommunity: 'ምሕዝነትን ማሕበርን', childrenYouthEducation: 'ትምህርቲ ሕፃናት/መንእሰያት', orthodoxTraditionCulture: 'ኦርቶዶክሳዊ ትውፊትን ባህልን' } },
    q6: { label: 'ናብ ቤተ ክርስቲያን ክትመፁ ከለኹም፣ ተቐባልነት፣ ክብሪን ምሕዝነትን ይስምዓኩምዶ?', options: { always: 'ኩሉ ግዜ', often: 'ብዙሕ ግዜ', sometimes: 'ሓደ ሓደ ግዜ', rarely: 'ሳሕቲ', notYet: 'ገና ኣይተሰምዓንን' } },
    q7: { label: 'ጋሻታትን ኣባላትን ዝያዳ ተቐባልነትን መንፈሳዊ ምትእስሳርን ክስምዖም እንታይ ምግባር ክሕግዝ ይኽእል ትብሉ?' },
    q8: { label: 'ብቐጻሊ ኣብ ኣየኒኦም ኣገልግሎታት ትሳተፉ?', options: { divineLiturgyCommunion: 'ቅዳሴን ቁርባንን', mahletSeatatKidan: 'ማኅሌት፣ ሰዓታትን ኪዳንን', sundaySibket: 'ስብከተ ወንጌል', sundaySchoolYouth: 'ቤት ትምህርቲ ሰንበት/ንመንእሰያት', bibleStudyAdult: 'መጽናዕቲ መጽሓፍ ቅዱስ/ንዓበይቲ', virtualOnlinePrograms: 'ናይ Online መንፈሳዊ መደባት' } },
    q9: { label: 'ጸሎት፣ ቅዳሴ፣ ንባብን ተሰጥኦን ክትከታተሉ ክንደይ ዝኣክል ቀሊል እዩ?', options: { veryEasy: 'ኣዝዩ ቀሊል', mostlyEasy: 'ብዙሕ ግዜ ቀሊል', sometimesDifficult: 'ሓደ ሓደ ግዜ/ከቢድ', veryDifficult: 'ኣዝዩ ከቢድ' } },
    q10: { label: 'ናይ ሰንበት ጠቕላላ መርሓ ግብርታትን ናይ ኣገልግሎት ሰዓታትን ከመይ ትግምግምዎ?', options: { highlyAppropriate: 'ብጣዕሚ ግቡእን መንፈሳዊ ዕግበት ዝህብን', acceptableNeedsAdjustment: 'ብኣብዝሓ ፅቡቕ እዩ፣ ነገር ግን ንኡሽተይ ምስትኽኻል የድሊ', tooLongForFamily: 'ንስድራ ቤት ነዊሕ/ኣፀጋሚ', preferAdjustedSchedule: 'ብጠቕላላ እቲ ሰዓታቱ እንተዝቕየር እመርፅ' } },
    q11: { label: 'ናይ ሰንበት ካብ 30–40 ደቓይቕ ንዝኸውን ግዜ ዝወሃብ ስብከተ ወንጌል ብኸመይ ትርእይዎ?', options: { deeplyEnrichingIdeal: 'ኣዝዩ ዝሃንፅን ግቡእን', goodButLittleLong: 'ፅቡቕ እዩ፤ ግና ቁሩብ ንውሕ ኢሉ', moderatelyHelpfulNeedsFocus: 'መጠነኛ ጠቓሚ፤ ኣብ ዕለታዊ ሕይወት/መንእሰያት እንተዘተኩር', desiresDeeperLongerSermon: 'ዝበለፀ ዕምቈት እንተዝህልዎ/ነዊሕ ስብከት እደሊ' } },
    q12: { label: 'መንፈሳዊ መዝሙር፣ መዘምራንን ተሳትፎ ምእመናንን ከመይ ትግምግምዎ?', options: { exceptionalUplifting: 'ፍሉይ፣ ልቢ ዝትንክፍን ዘበራትዕን', goodNeedsBroaderParticipation: 'ጽቡቕ፤ ግና ሰፊሕ ተሳትፎ የድሊ', fairNeedsOrganizationTraining: 'መጠነኛ፤ ምውዳብን ስልጠናን የድሊ', needsStructuralImprovement: 'መዋቅራዊ ምምሕያሽ የድሊ' } },
    q13: { label: 'ኣባላት ሰሙናዊ ቅዳሴ ከይሳተፉ ብቐንዱ ዝዓግቶም እንታይ እዩ?', options: { workSchedules: 'ሰዓት ስራሕ/ግዴታታት', distanceTransportation: 'ርሕቐት/መጓዓዝያ', languageComprehension: 'ቋንቋ/ምርዳእ', needClearerSchedule: 'ሰዓቱ ንፁር ስለዘይኮነ/መዘኻኸሪ ምጉዳል', lackYouthEngagement: 'ሕፃናት/መንእሰያት ዘይምስታፍ', needPastoralOutreach: 'ቀስቃሲ ምድላይ/ውልቃዊ ርክብ ምድላይ' } },
    q14: { label: 'ስርዓተ ኣምልኾና፣ ተሳትፎ ምእመናን ወይ ናይ ኣገልግሎት ሰዓታት ንምሕያል ሓደ ምኽሪ ይሃቡ።' },
    q15: { label: 'ንመንፈሳዊ ትምህርቲ ብዝበለፀ እትርድኡሉ ቋንቋ ኣየናይ እዩ?', options: { tigrinya: 'ትግርኛ', english: 'እንግሊዝኛ', geez: 'ግእዝ', bilingual: 'ክልቲኡ (ትግርኛን እንግሊዝኛን)', other: 'ካልእ' } },
    q16: { label: 'ትርጉም ወይ ደገፍ ቋንቋ ኣብ ኣየናይ ክፍሊ ግልጋሎት ብዝበለፀ ይጠቅም?', options: { kidaseLiturgyTextScreens: 'ናይ ቅዳሴ ንባብ/ስክሪን', sibketSermonTranslation: 'ስብከት', sundaySchoolYouth: 'ቤት ትምህርቲ ሰንበት/መንእሰያት', sacramentPreparation: 'ምስጢራተ ቤተክርስቲያን እንትፍፀም', announcementsBulletins: 'ምልክታታት/ሓበሬታን መዘኻኸሪን', scriptureReadings: 'ንባብ ቅዱሳት መጻሕፍቲ' } },
    q17: { label: 'ኣብ ወርሒ ሓደ ሰንበት ብዋናነት እንግሊዝኛ ምጥቃም (3፥1 ቋንቋ ኣጠቓቕማ) ከመይ ትርእይዎ?', options: { stronglySupport: 'ብፅኑዕ እድግፍ', support: 'እድግፍ', neutralNoPreference: 'ገለ ሓሳብ የብለይን/ግድን ኣይኮነን', doNotSupport: 'ኣይድግፍን', needMoreInfo: 'ዝያዳ ሓበሬታ የድልየኒ' } },
    q18: { label: 'ንዓኻትኩም ወይ ንደቅኹም ዝያዳ ክትጥቀሙ እንታይ ዓይነት ደገፍ ቋንቋ የድሊ? ስለምንታይ?' },
    q19: { label: 'ኣብዚ እዋን ዝተመደበ ንስሃ ኣቦ ኣለኩም ዶ?', options: { yesAtThisParish: 'እወ፣ ኣብዚ ደብሪ', yesAtAnotherParish: 'እወ፣ ኣብ ካልእ ደብሪ', noSeekingGuidance: 'ኣይብለይን፤ ንምርካብ ትምህርቲ እደሊ', noNotCurrently: 'ናይ ምሓዝ ድልየት ኣይብለይን' } },
    q20: { label: 'ምስ ንስሃ ኣቦ ወይ ካህን ንመንፈሳዊ ምኽርን ንስሓን ክንደይ ግዜ ትራኸቡ?', options: { monthlyOrAsNeeded: 'ወርሓዊ/ከም ዘድሊ', every2to3Months: 'ኣብ 2–3 ወርሒ', duringMajorFasts: 'ኣብ ዓበይቲ ጾማት/በዓላት', rarelyOrNever: 'ኣይንራኸብን' } },
    q21: { label: 'ቅዱስ ምሥጢር ወይ ካልእ መንፈሳዊ ኣገልግሎት ክትሓቱ ከለኹም ክንደይናይ ደገፍ ትረኽቡ?', options: { verySupported: 'ኣዝዩ ፅቡቕ', supported: 'ደገፍ ይግበረለይ', somewhatSupported: 'መጠነኛ', notSupportedEnough: 'እኹል ደገፍ የለን', haveNotRequested: 'ኣይሓተትኩን' } },
    q22: { label: 'ካህናት ወይ ኣገልገልቲ መንፈሳዊን ውልቃዊን ኩነታት ስድራኹም ክንደይ ግዜ ይከታተሉኹም?', options: { regularly: 'ምቁርራፅ ብዘይብሉ ብተኸታታሊ', sometimes: 'ሓደ ሓደ ግዜ', rarely: 'ሳሕቲ', never: 'ኣይከታተሉናን', newToChurch: 'ሓድሽ እየ' } },
    q23: { label: 'ኣቦታትና ካህናት ኣብ ኣየኒኦም መጓሰያዊ ኣገልግሎታት ብዝበለፀ ከተኩሩ ይግባእ?', options: { homeHospitalVisits: 'ምብፃሕ ሕሙማን/ኣረጋውያን', financialPersonalHardship: 'ደገፍ ኣብ ገንዘባዊ/ውልቃዊ ፀገም', spiritualCounseling: 'መንፈሳዊ ምኽሪ/ንስሓ', newcomerWelcome: 'ኣቀባብላ/ክትትል ሓደሽቲ', bereavementGrief: 'ደገፍ ኣብ ሓዘን', preMaritalFamilyCounseling: 'ምኽሪ ቅድመ ተክሊል/ስድራ' } },
    q24: { label: 'ርክብ ካህናትን ምእመናንን፣ ከምኡ እውን መጓሰያዊ ኣገልግሎቶምን ንምሕያል ሓደ ምኽሪ ይሃቡ።' },
    q25: { label: 'ካብ ገዛኹም ኣብ ቤተ ክርስቲያን ዝሳተፉ ሕፃናትን መናእሰይን ኣለዉዶ?', options: { yesAges0to9: 'እወ፣ 0–9', yesAges10to17: 'እወ፣ 10–17', yesAges18to30: 'እወ፣ 18–30', noNotApplicable: 'ኣይምልከተንን' } },
    q26: { label: 'ናይ ቤተ ክርስቲያና መንፈሳዊ ግልጋሎታት ንመንፈሳዊ ዕብየት ሕፃናትን መናእሰይን ክንደየናይ ይሕግዙ?', options: { highlyEffective: 'ኣዝዩ ውጽኢታዊ', moderateNeedsModernBilingual: 'መጠነኛ፤ ዘመናዊ/ክልተ-ቋንቋ የድሊ', inadequateUrgentYouthMinistry: 'ዘይእኹል፤ ፍሉይ ኣገልግሎት መንእሰያት የድሊ', unsureNotApplicable: 'ኣይፈልጥን/ኣይምልከተንን' } },
    q27: { label: 'ኣየኒኦም መደባት ሕፃናትን መንእሰያትን ክበራትዑ ይግባእ?', options: { ageGradedSundaySchool: 'ብዕድመ ዝተመደበ ትምህርቲ ሰንበት', clergyMentorship: 'ምኽሪን ማዕዳን ካህን', englishBibleStudyApologetics: 'መጽሓፍ ቅዱስ ፅንዓት/ዕቅበተ እምነት', youthFellowshipRetreats: 'ናይ መንእሰያት ሕብረት ጉዕዞን ኣገልግሎት ፕሮጀክትታትን', sacredZemaLiturgicalTraining: 'ምሥጢራት፣ ዜማ/መዝሙር ስልጠና', parentSupport: 'ደገፍ ወለዲ' } },
    q28: { label: 'ሕፃናትን መናእሰያትናን ኣብ ሃይማኖቶም ፅኑዓት ክኾኑ ደብርና ክወስዶ ዘለዎ እቲ ኣዝዩ ኣገዳሲ ስጉምቲ እንታይ እዩ?' },
    q29: { label: 'ጠቕላላ ጽሬት፣ ኣየርን ምቹውነትን ህንጻ ቤተ ክርስቲያን ከመይ ትግምግምዎ?', options: { exceptionalExcellent: 'ፍሉይ/ብሉጽ', satisfactoryGood: 'ኣዕጋቢ/ጽቡቕ', fairMinorCareNeeded: 'መጠነኛ', needsMajorCleanup: 'ሰፊሕ ናይ ፅሬት የድሊ' } },
    q30: { label: 'ኣብ ቤተክርስቲያና ስርዓተ ጸሎት፣ ንባብ፣ መዝሙርን ስብከትን ብኣግባቡ ናይ ምድማፅ ኩነታት ከመይ ትግምግምዎ?', options: { excellent: 'ብሉፅ', good: 'ፅቡቕ', fair: 'መጠነኛ', needsImprovement: 'ምምሕያሽ የድሊ' } },
    q31: { label: 'ናይ ስክሪን ሓገዝ ንጸሎት፣ ንባብ፣ ምልክታን ትርጉምን ክንደይ ጠቓሚ እዩ?', options: { fullyFunctional: 'ሙሉእ ብሙሉእ ይሰርሕ', adequateNeedsTextEnhancement: 'እኹል፤ ጽሑፍ/ትርጉም ይመሓየሽ', soundNeedsTuning: 'ድምፂ/ግልፅነት ይማሓየሽ', needsImmediateTechUpgrade: 'ቅልጡፍ ቴክኒካዊ ምምሕያሽ የድሊ' } },
    q32: { label: 'ኣየናይ መሳርሒ ወይ ዘይምቹ ነገር ቀዳማይነት ተዋሂብዎ ክመሓየሽ ይግባእ?', options: { soundSystem: 'ስርዓት ድምጺ', displayScreens: 'ስክሪን/ምስሊ', chairsSeating: 'ወንበር', airConditioning: 'ኤር ኮንዲሽነር', elevator: 'ሊፍት', lighting: 'መብራህቲ', other: 'ካልእ' } },
    q33: { label: 'ኣየናይ ክፍሊ ህንጻ ብቕልጡፍ ትኹረት የድልዮ?', options: { worshipArea: 'ኣምልኾ ቦታ/ ዋና ቤተ መቅደስ', dejeselamCommonAreas: 'ደጀሰላም/ሓባራዊ ቦታ', sanctuarySurroundings: 'ከባቢ ቅድስተ ቅዱሳን', sundaySchoolClassrooms: 'ክፍልታት ሰንበት ተምሃሮ/ሕፃናት', parkingTrafficFlow: 'መኪና መዕረፊ/ትራፊክ', accessibilityElders: 'ተበፃሕነት ኣረጋውያን/ኣካል ጉድኣት ዘለዎም', buildingSafetySigns: 'ድሕንነትን ምልክታትን ህንጻ' } },
    q34: { label: 'ርክብን ምልክታታትን ቤተ ክርስቲያን ከመይ ትግምግምዎ?', options: { excellent: 'ብሉፅ', good: 'ፅቡቕ', fair: 'መጠነኛ', needsImprovement: 'ምምሕያሽ የድሊ' } },
    q35: { label: 'ቤተ ክርስቲያን ስለ እትህቦም ግልጋሎታትን እተመሓላልፎም መልእኽትታትን ብኸመይ ክበፅሐኩም ትመርፁ?', options: { inPersonAnnouncement: 'ብኣካል', textSms: 'SMS', whatsappViber: 'WhatsApp / Viber', email: 'ኢመይል', printedNotice: 'ብወረቐት ዝተሓትመ ሓበሬታ', facebookSocialMedia: 'Facebook/ማሕበራዊ ሜድያ', churchWebsite: 'መርበብ ቤተ ክርስቲያን' } },
    q36: { label: 'ቤተ ክርስቲያና ምእመናን ሕማም፣ ሓዘን፣ ወይ ካልእ ፀገም እንተጋጥሞም ክንደይናይ ትድግፍ?', options: { veryWell: 'ኣዝዩ ፅቡቕ', well: 'ፅቡቕ', sometimes: 'ሓደ ሓደ ግዜ', needsImprovement: 'ምምሕያሽ የድሊ', iDoNotKnow: 'ኣይፈልጥን' } },
    q37: { label: 'ኣየናይ መንፈሳዊ ግልጋሎታት ብፍሉይ ክበራትዑ ይግባእ?', options: { newcomerWelcomeFollowUp: 'ኣቀባብላ/ክትትል ሓደሽቲ', careElders: 'ክንክን ኣረጋውያን/ኣብ ገዛ', familyFellowship: 'ሕብረት ስድራቤት', youngAdultFellowship: 'ሕብረት መንእሰያት ዓበይቲ', charityOutreach: 'ግብረ ሠናይን ወፃኢ ኣገልግሎትን', supportFamiliesInCrisis: 'ደገፍ ንኣብ ፀገም ዘለዋ ስድራቤታት', communityEducationWorkshops: 'ትምህርቲ/ስልጠና', evangelismMission: 'ወንጌል/ተልእኾ' } },
    q38: { label: 'ኣብ መንጎ ምእመናንትና ክርስቲያናዊ ሕብረትን ሓልዮትን ንምሕያል ቤተ ክርስቲያን ክትገብሮ እትኽእል ሓደ ተግባራዊ ነገር እንታይ እዩ?' },
    q39: { label: 'ብኣየናይ መንገዲ ከተገልግሉ ፍቓደኛታት ኢኹም?', options: { zemaChoirWorshipSupport: 'ዜማ/መዘምራን', cleaningSetupMaintenance: 'ፅሬት/ጽገና', sundaySchoolYouthTeaching: 'ትምህርቲ ሰንበት/መንእሰያት', welcomingNewcomerSupport: 'ሓደሽቲ ኣባላት ምቕባል', mediaSoundScreensTech: 'ሚድያ', charityVisitationOutreach: 'ምጽዋት/ምብጻሕ/ምውፋር', fundraisingEventOrganization: 'ምትእኽኻብ ገንዘብ', professionalSkills: 'ሞያዊ ክእለት', needMoreInfo: 'ዝያዳ ሓበሬታ የድልየኒ' } },
    q40: { label: 'ብዛዕባ መባእ፣ ኣስራትን በኲራትን ዝወሃብ ትምህርቲ ክንደይናይ ግልፂ እዩ?', options: { veryClear: 'ኣዝዩ ግልፂ', mostlyClear: 'ብዙሕ ግዜ ግልፂ', somewhatUnclear: 'መጠነኛ', notClear: 'ግልጺ ኣይኮነን', newHaveNotReceivedInfo: 'ሓድሽ እየ/ሓበሬታ ኣይረኸብኩን' } },
    q41: { label: 'ኣባላት ብቐሊሉ መንፈሳዊ ኣገልግሎት ክህቡ እንታይ ይሕግዞም?', options: { clearMinistryRoles: 'በየ ጊዜኡ ግልፂ ሓላፍነታት ምሃብ', volunteerSignUpForm: 'ቅጥዒ ምዝገባ', trainingGuidance: 'ስልጠና/ትምህርቲ', personalInvitationFollowUp: 'ውልቃዊ ክትትል', regularSchedule: 'ቀዋሚ ምደባ', childcareDuringActivities: 'ክንክን ሕፃናት', recognitionEncouragement: 'ኣፍልጦ/ምትብባዕ', other: 'ካልእ' } },
    q42: { label: 'ንተልእኾ ቤተ ክርስቲያን እንታይ ዓይነት ደገፍ ክትህቡ ፍቓደኛታት ኢኹም?', options: { prayer: 'ጸሎት', regularGiving: 'ብቀዋሚነት ካብ ኣታዊና ኣስራትን በኹራትን ምኽፋል', specialProjectBuilding: 'ንህንፃ ቤተ ክርስቲያን መፈፀሚ ገንዘብ ምውፃእ', volunteerTime: 'ናይ በጎ ፍቓድ ግዜ', professionalTechnicalExpertise: 'ሞያዊ/ቴክኒካዊ ክእለት', invitingOthers: 'ካልኦት ምዕዳም', outreachCharity: 'ምጽዋት', needMoreInfo: 'ዝያዳ ሓበሬታ የድልየኒ' } },
    q43: { label: 'ቅድስት ቤተ ክርስቲያና ኣብ ምምራሕን ኣገልግሎት ኣብ ምሃብን ዘለዋ ኣፈፃፅማ ከመይ ትግምግምዎ?', options: { veryHighConfidence: 'ኣዝዩ ልዑል', highConfidence: 'ልዑል', someConfidence: 'ማእኸላይ', lowConfidence: 'ዝተሓተ', notEnoughInfo: 'እኹል ሓበሬታ ኣይብለይን' } },
    q44: { label: 'ሰበካ ጉባኤ ንዝውስኖም ውሳነታት፣ ዝእቅዶም ተግባራትን ሓላፍነታትን ክንደየናይ ብግልጺ የረድእ?', options: { veryClearly: 'ኣዝዩ ግልፂ', clearly: 'ግልፂ', sometimesClearly: 'ሓደ ሓደ ግዜ', notClearly: 'ግልፂ ኣይኮነን', iDoNotKnow: 'ኣይፈልጥን' } },
    q45: { label: 'ሰበካ ጉባኤ ገንዘባዊ ኣታዊታት ብሓላፍነትን ብግልጽነትን ኣብ ምምሕዳር ዝገብሮ ምንቅስቓስ ከመይ ትግምግምዎ?', options: { veryConfident: 'ኣዝዩ ርግፀኛ', confident: 'ርግፀኛ', somewhatConfident: 'መጠነኛ', notConfident: 'ርግፀኛ ኣይኮንኩን', notEnoughInfo: 'እኹል ሓበሬታ የለን' } },
    q46: { label: 'እምነትን ተሳትፎን ምእምናን ዘዕብዩ ኣየኒኦም ምምሕዳራዊ ተግባራት እዮም?', options: { regularFinancialSummaries: 'ገንዘባዊ ኣታዊናን ወፃኢናን ሓፂር ሪፖርት ብብወርሑ ምንጋር', clearAnnualPlansGoals: 'ዓመታዊ እቅድ/ሸቶ ግልፂ ምግባር', betterExplanationMajorDecisions: 'ንውሳነታት ሰበካ ጉባኤ በቢጊዜኡ መብርሂ ምሃብ', moreOpportunitiesMemberQuestions: 'ኣባላት ሕቶታት ንኽሓቱ ዕድላት ምምችቻው', clearVolunteerMinistryResponsibilities: 'ናይ ኣገልግሎት ሓላፍነት ግልፂ ምግባር', fasterResponseToConcerns: 'ንስክፍታ ምእምናን ቅልጡፍ መልሲ ምሃብ', consistentPoliciesProcedures: 'ተኸታታልነት ዘለዎ ፖሊስን ስርዓትን' } },
    q47: { label: 'ቤተ ክርስቲያንን ምእመናንን ምሕደራ ብዝምልከት ንማሕበረ ካህናት ወይ ንሰበካ ጉባኤ ሓደ ሃናጺ ምኽሪ ይሃቡ።' },
    q48: { label: 'ህንፀት እቲ ሓድሽ ቤተ ክርስቲያን ኣብ ምንታይ ደረጃ ከም ዘሎ ርኢኹምዎ ትፈልጡ ዶ?', options: { yesVisitedInPerson: 'እወ፣ ብኣካል', seenPhotosUpdates: 'ፎቶ/ሓበሬታ ርእየ', awareButNotVisited: 'ሰሚዐ ኣለኹ፣ ግን ኣይበፃሕኩን', notYetNotInformed: 'ገና ኣይፈለጥኩን' } },
    q49: { label: 'ብዛዕባ ምዕባለ፣ ድሌታትን ዝቕጽል ስጉምትን ሓድሽ ህንጻ ክንደይ ሓበሬታ ኣለኩም?', options: { veryInformed: 'ኣዝዩ ብዙሕ', informed: 'ሓበሬታ ኣለኒ', somewhatInformed: 'መጠነኛ', notInformed: 'ሓበሬታ የብለይን' } },
    q50: { label: 'ከይዲ ምምሕያሽን ምድላውን ህንፃ ሓዱሽ ቤተ ክርስቲያን ከመይ ትግምግምዎ?', options: { excellentProgress: 'ብሉፅ', goodProgress: 'ፅቡቕ', satisfactory: 'ኣዕጋቢ', movingTooSlowly: 'ደንጉዩ', notEnoughInfo: 'እኹል ሓበሬታ የለን' } },
    q51: { label: 'ቤተ ክርስቲያን እናዓበየት ክትከይድ ኣየናይ ተግባር ብቀዳሚነት ክትክውኖ ዝግባእ እዩ ትብሉ?', options: { completeNewBuildingResponsibly: 'ሓድሽ ህንጻ ብሓላፍነት ምዝዛም', expandChildrenYouthMinistry: 'ኣገልግሎት ሕፃናት/መናእሰይ ምብዛሕ', strengthenClergyPastoralCapacity: 'ዓቕሚ ካህናት/መጓሰ ምዕባይ', developCharityOutreach: 'ግብረ ሠናይን ወፃኢ ኣገልግሎትን ምዕባይ', improveWorshipTeachingLanguageAccess: 'ኣምልኾ፣ ትምህርትን ቋንቋዊ ተበፃሕነትን ምምሕያሽ', buildFinancialSustainability: 'ገንዘባዊ ዘላቕነት ምርግጋፅ', trainFutureServantsDeaconsLeaders: 'ተተካእቲ መገልገልቲ/ዲያቆናት ብበዝሒ ምምሃር', strengthenEvangelismWelcomeFamilies: 'ወንጌላዊ ተልእኾን ኣቀባብላ ሓደስቲ ስድራቤታትን ምሕያል' } },
    q52: { label: 'ወንጌላዊ ተልእኾን መንፈሳዊ ኣገልግሎትን ንምስፋሕ ዋና ምኽርኹም እንታይ እዩ?' },
    q53: { label: 'ብጠቕላላ፣ ብኣምልኾ፣ መጓሰ፣ ትምህርቲ፣ ሕብረት፣ ህንጻን ምምሕዳርን ክንደይ ዓጊብኩም?', options: { verySatisfied: 'ኣዝየ ዓጊበ', satisfied: 'ዓጊበ', neutral: 'ማእከላይ', dissatisfied: 'ኣይዓገብኩን', veryDissatisfied: 'ፈፂመ ኣይዓገብኩን' } },
    q54: { label: 'ቤተ ክርስቲያንና ብፍሉይ እትፍጽሞን ክትዕቅቦ ዘለዋን ሓደ ቅዱስ ልምዲ ወይ ኣገልግሎት እንታይ እዩ?' },
    q55: { label: 'ንካህናትን ሰበካ ጉባኤን ክተካፍሉ እትደልዩ እቲ ኣዝዩ ኣገዳሲ ምኽሪ ወይ ራእይ እንታይ እዩ?' },
    q56: { label: 'መንፈሳዊ ሕይወት፣ ሓድነትን ኣገልግሎትን ዘጠናኸር ካልእ ጸሎታዊ ምኽሪ፣ ስክፍታ ወይ ሓሳብ የካፈሉ።' },
    wizard: {
      sectionProgress: 'ክፍሊ {current} ካብ {total}',
      back: 'ንድሕሪት',
      next: 'ቀፃሊ',
      submit: 'ኣቕርብ',
      submitting: 'ይለኣኽ ኣሎ...',
      skipHint: 'ዘይምልከተኩም ሕቶ ሰግሩ።',
      otherPlaceholder: 'በጃኹም ግለጹ...',
      selectUpTo: 'ክሳብ {n} ምረፁ',
      submitError: 'ርእይቶኹም ኣብ ምልኣኽ ጌጋ ኣጋጢሙ። በጃኹም ደጊምኩም ፈትኑ።'
    },
    thankYou: {
      title: 'የቐንየለይ',
      body: 'ኣምላኽ ሰላም፣ ብምልጃ እታ ቅድስቲ ኣደ ማርያምን ቅዱስ ኣቡነ ኣረጋዊን፣ ንዓኻትኩምን ንስድራቤትኩምን ብብዝሒ መንፈሳዊ ፀጋን ሰላምን ይባርኽ። ኣሜን።',
      gratitude: 'ንመንፈሳዊ ዕብየትን ተልእኾን ደብረ ፅሐይ ኣቡነ ኣረጋዊ ቤተ ክርስቲያን ብምሃብኩም ናይ ፅቡቕ ኣበርክቶኹም ነመስግን!'
    },
    homeCard: {
      title: 'መርመራ ኣገልግሎት ቤተ ክርስቲያን',
      description: 'ብዛዕባ ኣምልኾ፣ ኣገልግሎትን ሂወት ደብርን ስም ብዘይ ምጥቃስ ርእይቶኹም ኣካፍሉ — ኣስታት 10 ደቓይቕ ይወስድ።'
    },
    report: {
      title: 'መርመራ ኣገልግሎት ቤተ ክርስቲያን — ሪፖርት',
      totalResponses: 'ጠቕላላ ምላሽ',
      freeTextAnswers: 'ናይ ፅሑፍ ምላሻት',
      noResponsesYet: 'ገና ምላሽ የለን።',
      accessDenied: 'ነዚ ገጽ ንምርኣይ ፍቓድ የብልኩምን።',
      loading: 'ሪፖርት ይጽዓን ኣሎ...',
      loadError: 'ሪፖርት ምጽዓን ኣይተኻእለን።'
    }
  },
```

- [ ] **Step 5: Log the freshly-translated strings in `tigrigna-translation-review.md`**

Add a new section (near the top, next to the other high-visibility entries, since this is a public-facing page) documenting which `survey.*` strings are fresh translations versus sourced from the client's own Tigrigna PDF:

```markdown
# Church Services Survey (Aug 2026)

Most of `survey.*` in `dictionaries.ts` was taken directly from the client-provided
Tigrigna PDF (`frontend/public/docs/Church Services Assesment Survey_Tigrigna.pdf`) and
needs no review. The rows below are the exceptions: strings with **no Tigrigna PDF
equivalent**, freshly translated here because the English PDF (treated as canonical —
see `docs/superpowers/specs/2026-08-15-church-services-survey-design.md`) had an option,
a numeric bracket, or a section instruction that the Tigrigna PDF lacked or stated
differently.

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| survey.q1.options.* | Under 18 / 18–28 / 29–38 / 39–48 / 49–60 / 61–75 / 76+ | ትሕቲ 18 / 18–28 / 29–38 / 39–48 / 49–60 / 61–75 / 76 ወይ ልዕሊኡ | ⚠️ numeric brackets renumbered to match the English PDF (the Tigrigna PDF used 18–30/31–40/41–50/61–70/71+) |
| survey.q4.options.tigrayOrthodoxCommunity | Tigray Orthodox Tewahedo worship & community | ናይ ትግራይ ኦርቶዶክስ ተዋሕዶ ኣምልኾን ማሕበረሰብን | ⚠️ option missing from the Tigrigna PDF |
| survey.q11.options.goodButLittleLong / moderatelyHelpfulNeedsFocus / desiresDeeperLongerSermon | Good but a little too long / Moderately helpful, needs more focus / Desires deeper teaching | ፅቡቕ እዩ፤ ግና ቁሩብ ንውሕ ኢሉ / መጠነኛ ጠቓሚ፤ ... / ዝበለፀ ዕምቈት እንተዝህልዎ... | ⚠️ paraphrased, please check register |
| survey.q15.options.bilingual | Bilingual (Tigrinya/English) | ክልቲኡ (ትግርኛን እንግሊዝኛን) | ⚠️ the Tigrigna PDF had "Amharic" here instead of a bilingual option; dropped per canonical-English resolution |
| survey.q17.options.neutralNoPreference | Neutral / no preference | ገለ ሓሳብ የብለይን/ግድን ኣይኮነን | ⚠️ option missing from the Tigrigna PDF |
| survey.q21.options.supported | Supported | ደገፍ ይግበረለይ | ⚠️ option missing from the Tigrigna PDF |
| survey.q27.options.youthFellowshipRetreats | Youth fellowship retreats, outings & service projects | ናይ መንእሰያት ሕብረት ጉዕዞን ኣገልግሎት ፕሮጀክትታትን | ⚠️ option missing from the Tigrigna PDF |
| survey.q33.options.sanctuarySurroundings / buildingSafetySigns | Sanctuary surroundings / Building safety and signs | ከባቢ ቅድስተ ቅዱሳን / ድሕንነትን ምልክታትን ህንጻ | ⚠️ both missing from the Tigrigna PDF |
| survey.q35.options.printedNotice / facebookSocialMedia | Printed notice / Facebook or social media | ብወረቐት ዝተሓትመ ሓበሬታ / Facebook/ማሕበራዊ ሜድያ | ⚠️ both missing from the Tigrigna PDF |
| survey.q37.options.familyFellowship / youngAdultFellowship / charityOutreach | Family fellowship / Young-adult fellowship / Charity and outreach | ሕብረት ስድራቤት / ሕብረት መንእሰያት ዓበይቲ / ግብረ ሠናይን ወፃኢ ኣገልግሎትን | ⚠️ all three missing from the Tigrigna PDF |
| survey.q40.options.mostlyClear | Mostly clear | ብዙሕ ግዜ ግልፂ | ⚠️ option missing from the Tigrigna PDF |
| survey.q42.options.volunteerTime / invitingOthers / needMoreInfo | Volunteer time / Inviting others / Need more information | ናይ በጎ ፍቓድ ግዜ / ካልኦት ምዕዳም / ዝያዳ ሓበሬታ የድልየኒ | ⚠️ all three missing from the Tigrigna PDF |
| survey.q46.options.consistentPoliciesProcedures | Consistent policies and procedures | ተኸታታልነት ዘለዎ ፖሊስን ስርዓትን | ⚠️ option missing from the Tigrigna PDF |
| survey.q48.options.awareButNotVisited | Aware, but not visited | ሰሚዐ ኣለኹ፣ ግን ኣይበፃሕኩን | ⚠️ option missing from the Tigrigna PDF |
| survey.q51.options.developCharityOutreach / improveWorshipTeachingLanguageAccess / strengthenEvangelismWelcomeFamilies | Develop charity & outreach / Improve worship, teaching & language access / Strengthen evangelism & welcome new families | ግብረ ሠናይን ወፃኢ ኣገልግሎትን ምዕባይ / ኣምልኾ፣ ትምህርትን ቋንቋዊ ተበፃሕነትን ምምሕያሽ / ወንጌላዊ ተልእኾን ኣቀባብላ ሓደስቲ ስድራቤታትን ምሕያል | ⚠️ all three missing from the Tigrigna PDF |
| survey.section5.instruction / survey.section10.instruction | "Our children and youth are precious members..." / "Please consider the parish's future..." | ደቅናን መንእሰያትናን ክቡራት ኣባላት... / ብዛዕባ መጻኢ ደብርና... | ⚠️ the Tigrigna PDF had no instruction line for these two sections |
```

- [ ] **Step 6: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false surveyDictionary.test.ts`
Expected: PASS (56 + 1 + 1 tests via `it.each`)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/i18n/dictionaries.ts frontend/src/i18n/__tests__/surveyDictionary.test.ts tigrigna-translation-review.md
git commit -m "feat: add bilingual survey question/option text to i18n dictionaries"
```

---

### Task 7: Frontend — `surveyDraft.ts` (localStorage) + `surveyApi.ts` (submit/report fetch)

**Files:**
- Create: `frontend/src/utils/surveyDraft.ts`
- Create: `frontend/src/utils/__tests__/surveyDraft.test.ts`
- Create: `frontend/src/utils/surveyApi.ts`
- Create: `frontend/src/utils/__tests__/surveyApi.test.ts`

**Interfaces:**
- Produces (`surveyDraft.ts`): `SurveyDraft { answers: Record<string, string | string[]>; otherTexts: Record<string, string>; sectionIndex: number }`, `loadDraft(): SurveyDraft | null`, `saveDraft(draft: SurveyDraft): void`, `clearDraft(): void`.
- Produces (`surveyApi.ts`): `SubmitSurveyPayload { surveySlug: string; locale: 'en' | 'ti'; memberStatus?: string; answers: Record<string, string | string[]> }`, `submitSurveyResponse(payload: SubmitSurveyPayload): Promise<void>` (throws on non-2xx), `SurveyReportData { totalResponses: number; questionTallies: Record<string, Record<string, number>>; freeTextAnswers: Record<string, string[]> }`, `fetchSurveyReport(idToken: string, surveySlug: string): Promise<SurveyReportData>`.
- Consumed by: Task 9 (`SurveyPage`/`SurveyWizard` use `surveyDraft` + `submitSurveyResponse`), Task 11 (`SurveyReportPage` uses `fetchSurveyReport`).

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/utils/__tests__/surveyDraft.test.ts
import { loadDraft, saveDraft, clearDraft } from '../surveyDraft';

describe('surveyDraft', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns null when nothing is saved', () => {
    expect(loadDraft()).toBeNull();
  });

  it('round-trips a saved draft', () => {
    saveDraft({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
    expect(loadDraft()).toEqual({ answers: { q1: 'age18to28', q4: ['other'] }, otherTexts: { q4Other: 'x' }, sectionIndex: 2 });
  });

  it('clearDraft removes the saved draft', () => {
    saveDraft({ answers: { q1: 'male' }, otherTexts: {}, sectionIndex: 0 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('returns null for corrupted JSON instead of throwing', () => {
    window.localStorage.setItem('survey.church-services-assessment-2026.draft', 'not json');
    expect(loadDraft()).toBeNull();
  });
});
```

```ts
// frontend/src/utils/__tests__/surveyApi.test.ts
import { submitSurveyResponse, fetchSurveyReport } from '../surveyApi';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

describe('submitSurveyResponse', () => {
  it('posts the payload and resolves on 201', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: { q1: 'age18to28' }
    })).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/survey/responses'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the server responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as any;
    await expect(submitSurveyResponse({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: {}
    })).rejects.toThrow();
  });
});

describe('fetchSurveyReport', () => {
  it('sends the bearer token and returns parsed report data', async () => {
    const data = { totalResponses: 3, questionTallies: { q1: { age18to28: 2 } }, freeTextAnswers: { q7: ['ok'] } };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data }) }) as any;

    const result = await fetchSurveyReport('token123', 'church-services-assessment-2026');
    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/survey/report?survey_slug=church-services-assessment-2026'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token123' }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false surveyDraft.test.ts surveyApi.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `surveyDraft.ts`**

```ts
// frontend/src/utils/surveyDraft.ts
import { SURVEY_SLUG } from '../components/survey/surveyDefinitions';

const DRAFT_KEY = `survey.${SURVEY_SLUG}.draft`;

export interface SurveyDraft {
  answers: Record<string, string | string[]>;
  otherTexts: Record<string, string>;
  sectionIndex: number;
}

export function loadDraft(): SurveyDraft | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SurveyDraft): void {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  window.localStorage.removeItem(DRAFT_KEY);
}
```

- [ ] **Step 4: Write `surveyApi.ts`**

```ts
// frontend/src/utils/surveyApi.ts
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export interface SubmitSurveyPayload {
  surveySlug: string;
  locale: 'en' | 'ti';
  memberStatus?: string;
  answers: Record<string, string | string[]>;
}

export async function submitSurveyResponse(payload: SubmitSurveyPayload): Promise<void> {
  const res = await fetch(`${API_URL}/api/survey/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      survey_slug: payload.surveySlug,
      locale: payload.locale,
      member_status: payload.memberStatus,
      answers: payload.answers
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to submit survey response (status ${res.status})`);
  }
}

export interface SurveyReportData {
  totalResponses: number;
  questionTallies: Record<string, Record<string, number>>;
  freeTextAnswers: Record<string, string[]>;
}

export async function fetchSurveyReport(idToken: string, surveySlug: string): Promise<SurveyReportData> {
  const res = await fetch(`${API_URL}/api/survey/report?survey_slug=${encodeURIComponent(surveySlug)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch survey report (status ${res.status})`);
  }

  const body = await res.json();
  return body.data as SurveyReportData;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false surveyDraft.test.ts surveyApi.test.ts`
Expected: PASS (4 + 3 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/surveyDraft.ts frontend/src/utils/__tests__/surveyDraft.test.ts frontend/src/utils/surveyApi.ts frontend/src/utils/__tests__/surveyApi.test.ts
git commit -m "feat: add survey localStorage draft persistence and API client"
```

---

### Task 8: Frontend — `SurveyQuestion.tsx`

**Files:**
- Create: `frontend/src/components/survey/SurveyQuestion.tsx`
- Create: `frontend/src/components/survey/__tests__/SurveyQuestion.test.tsx`

**Interfaces:**
- Consumes: `SurveyQuestionDef` (Task 5), `useLanguage()` (existing `contexts/LanguageContext.tsx`).
- Produces: `SurveyQuestion` component with props `{ question: SurveyQuestionDef; value: string | string[] | undefined; otherValue: string | undefined; onChange: (id: string, value: string | string[]) => void; onOtherChange: (id: string, text: string) => void }`. Consumed by Task 9's `SurveyWizard`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/survey/__tests__/SurveyQuestion.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyQuestion from '../SurveyQuestion';
import { SurveyQuestionDef } from '../surveyDefinitions';

const renderWithProviders = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

describe('SurveyQuestion', () => {
  it('renders a single-select question as radio buttons and reports selection', () => {
    const q: SurveyQuestionDef = { id: 'q2', section: 1, type: 'single', optionKeys: ['male', 'female'] };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={undefined} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Male'));
    expect(onChange).toHaveBeenCalledWith('q2', 'male');
  });

  it('renders a multi-select question as checkboxes and toggles values', () => {
    const q: SurveyQuestionDef = { id: 'q2', section: 1, type: 'multi', optionKeys: ['male', 'female'] };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={['male']} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Female'));
    expect(onChange).toHaveBeenCalledWith('q2', ['male', 'female']);

    fireEvent.click(screen.getByLabelText('Male'));
    expect(onChange).toHaveBeenCalledWith('q2', []);
  });

  it('disables unchecked options once maxSelect is reached', () => {
    const q: SurveyQuestionDef = { id: 'q32', section: 6, type: 'multi', optionKeys: ['soundSystem', 'displayScreens', 'chairsSeating'], maxSelect: 2 };
    renderWithProviders(
      <SurveyQuestion question={q} value={['soundSystem', 'displayScreens']} otherValue={undefined} onChange={jest.fn()} onOtherChange={jest.fn()} />
    );
    expect(screen.getByLabelText('Chairs or seating')).toBeDisabled();
    expect(screen.getByLabelText('Sound system')).not.toBeDisabled();
  });

  it('shows a companion text field only when the otherOptionKey is selected, single-select', () => {
    const q: SurveyQuestionDef = { id: 'q15', section: 3, type: 'single', optionKeys: ['tigrinya', 'other'], otherOptionKey: 'other' };
    const onOtherChange = jest.fn();
    const { rerender } = renderWithProviders(
      <SurveyQuestion question={q} value="tigrinya" otherValue={undefined} onChange={jest.fn()} onOtherChange={onOtherChange} />
    );
    expect(screen.queryByPlaceholderText('Please specify...')).not.toBeInTheDocument();

    rerender(
      <I18nProvider><LanguageProvider>
        <SurveyQuestion question={q} value="other" otherValue={undefined} onChange={jest.fn()} onOtherChange={onOtherChange} />
      </LanguageProvider></I18nProvider>
    );
    fireEvent.change(screen.getByPlaceholderText('Please specify...'), { target: { value: 'Amharic' } });
    expect(onOtherChange).toHaveBeenCalledWith('q15', 'Amharic');
  });

  it('renders a text question as a textarea', () => {
    const q: SurveyQuestionDef = { id: 'q7', section: 1, type: 'text' };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={undefined} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My answer' } });
    expect(onChange).toHaveBeenCalledWith('q7', 'My answer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false SurveyQuestion.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/components/survey/SurveyQuestion.tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SurveyQuestionDef } from './surveyDefinitions';

interface SurveyQuestionProps {
  question: SurveyQuestionDef;
  value: string | string[] | undefined;
  otherValue: string | undefined;
  onChange: (id: string, value: string | string[]) => void;
  onOtherChange: (id: string, text: string) => void;
}

const SurveyQuestion: React.FC<SurveyQuestionProps> = ({ question, value, otherValue, onChange, onOtherChange }) => {
  const { t } = useLanguage();
  const label = t(`survey.${question.id}.label`);
  const showOther = !!question.otherOptionKey && (
    question.type === 'single' ? value === question.otherOptionKey : Array.isArray(value) && value.includes(question.otherOptionKey)
  );

  return (
    <div className="mb-6">
      <p className="font-medium text-primary-700 mb-2">{label}</p>
      {question.maxSelect && (
        <p className="text-xs text-accent-500 mb-2">{t('survey.wizard.selectUpTo', { n: question.maxSelect })}</p>
      )}

      {question.type === 'text' && (
        <textarea
          className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          value={(value as string) || ''}
          onChange={e => onChange(question.id, e.target.value)}
        />
      )}

      {question.type === 'single' && question.optionKeys && (
        <div className="space-y-2">
          {question.optionKeys.map(key => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === key}
                onChange={() => onChange(question.id, key)}
              />
              {t(`survey.${question.id}.options.${key}`)}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multi' && question.optionKeys && (
        <div className="space-y-2">
          {question.optionKeys.map(key => {
            const selected = Array.isArray(value) ? value : [];
            const checked = selected.includes(key);
            const atMax = !!question.maxSelect && selected.length >= question.maxSelect;
            return (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && atMax}
                  onChange={() => {
                    const next = checked ? selected.filter(v => v !== key) : [...selected, key];
                    onChange(question.id, next);
                  }}
                />
                {t(`survey.${question.id}.options.${key}`)}
              </label>
            );
          })}
        </div>
      )}

      {showOther && (
        <input
          type="text"
          className="mt-2 w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder={t('survey.wizard.otherPlaceholder')}
          value={otherValue || ''}
          onChange={e => onOtherChange(question.id, e.target.value)}
        />
      )}
    </div>
  );
};

export default SurveyQuestion;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false SurveyQuestion.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/survey/SurveyQuestion.tsx frontend/src/components/survey/__tests__/SurveyQuestion.test.tsx
git commit -m "feat: add SurveyQuestion component for single/multi/text question types"
```

---

### Task 9: Frontend — `SurveyWizard.tsx` + `SurveyPage.tsx` + `SurveyThankYou.tsx`

**Files:**
- Create: `frontend/src/components/survey/SurveyWizard.tsx`
- Create: `frontend/src/components/survey/SurveyThankYou.tsx`
- Create: `frontend/src/components/survey/SurveyPage.tsx`
- Create: `frontend/src/components/survey/__tests__/SurveyPage.test.tsx`

**Interfaces:**
- Consumes: `SurveyQuestion` (Task 8), `SURVEY_QUESTIONS`/`SURVEY_SECTION_COUNT`/`SURVEY_SLUG`/`questionsForSection` (Task 5), `loadDraft`/`saveDraft`/`clearDraft` (Task 7), `submitSurveyResponse` (Task 7), `useLanguage()`.
- Produces: `SurveyPage` — default export, no props, mounted at the `/survey` route in Task 10.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/survey/__tests__/SurveyPage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyPage from '../SurveyPage';
import * as surveyApi from '../../../utils/surveyApi';
import * as surveyDraft from '../../../utils/surveyDraft';

jest.mock('../../../utils/surveyApi');
const mockedSubmit = surveyApi.submitSurveyResponse as jest.Mock;

const renderPage = () => render(<I18nProvider><LanguageProvider><SurveyPage /></LanguageProvider></I18nProvider>);

describe('SurveyPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedSubmit.mockReset();
    mockedSubmit.mockResolvedValue(undefined);
  });

  it('starts on section 1 of 11 and shows a Next but no Back button', () => {
    renderPage();
    expect(screen.getByText('Section 1 of 11')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('advances to section 2 on Next and can go Back to section 1', () => {
    renderPage();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Section 2 of 11')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Section 1 of 11')).toBeInTheDocument();
  });

  it('persists answers to localStorage as the user progresses', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Male'));
    const saved = JSON.parse(window.localStorage.getItem('survey.church-services-assessment-2026.draft') as string);
    expect(saved.answers.q2).toBe('male');
  });

  it('restores a saved draft on mount', () => {
    surveyDraft.saveDraft({ answers: { q2: 'female' }, otherTexts: {}, sectionIndex: 1 });
    renderPage();
    expect(screen.getByText('Section 2 of 11')).toBeInTheDocument();
  });

  it('shows Submit instead of Next on the last section, and shows the thank-you screen after a successful submit', async () => {
    surveyDraft.saveDraft({ answers: { q1: 'age18to28' }, otherTexts: {}, sectionIndex: 10 });
    renderPage();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => expect(screen.getByText('Thank You')).toBeInTheDocument());
    expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: expect.objectContaining({ q1: 'age18to28' })
    }));
    expect(window.localStorage.getItem('survey.church-services-assessment-2026.draft')).toBeNull();
  });

  it('shows an error message and stays on the wizard if submit fails', async () => {
    mockedSubmit.mockRejectedValue(new Error('network error'));
    surveyDraft.saveDraft({ answers: {}, otherTexts: {}, sectionIndex: 10 });
    renderPage();
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(screen.getByText('Something went wrong submitting your response. Please try again.')).toBeInTheDocument());
  });

  it("only includes a question's Other free text when its Other option is actually selected", () => {
    surveyDraft.saveDraft({ answers: { q4: ['other'] }, otherTexts: { q4Other: 'A friend from work' }, sectionIndex: 10 });
    renderPage();
    fireEvent.click(screen.getByText('Submit'));
    expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({
      answers: expect.objectContaining({ q4Other: 'A friend from work' })
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false SurveyPage.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `SurveyThankYou.tsx`**

```tsx
// frontend/src/components/survey/SurveyThankYou.tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const SurveyThankYou: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="text-center py-12 px-4">
      <h1 className="text-h2 font-serif text-primary-700 mb-4">{t('survey.thankYou.title')}</h1>
      <p className="text-accent-700 mb-2">{t('survey.thankYou.body')}</p>
      <p className="text-accent-700">{t('survey.thankYou.gratitude')}</p>
    </div>
  );
};

export default SurveyThankYou;
```

- [ ] **Step 4: Write `SurveyWizard.tsx`**

```tsx
// frontend/src/components/survey/SurveyWizard.tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import SurveyQuestion from './SurveyQuestion';
import { SURVEY_SECTION_COUNT, questionsForSection } from './surveyDefinitions';

interface SurveyWizardProps {
  sectionIndex: number;
  answers: Record<string, string | string[]>;
  otherTexts: Record<string, string>;
  memberStatus: string | undefined;
  onAnswerChange: (id: string, value: string | string[]) => void;
  onOtherChange: (id: string, text: string) => void;
  onMemberStatusChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}

const SurveyWizard: React.FC<SurveyWizardProps> = ({
  sectionIndex, answers, otherTexts, memberStatus,
  onAnswerChange, onOtherChange, onMemberStatusChange,
  onBack, onNext, onSubmit, submitting, submitError
}) => {
  const { t } = useLanguage();
  const section = sectionIndex + 1;
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === SURVEY_SECTION_COUNT - 1;
  const questions = questionsForSection(section);

  return (
    <div>
      <p className="text-sm text-accent-500 mb-4">
        {t('survey.wizard.sectionProgress', { current: section, total: SURVEY_SECTION_COUNT })}
      </p>

      {isFirst && (
        <div className="mb-6 pb-6 border-b border-accent-200">
          <h1 className="text-h2 font-serif text-primary-700 mb-2">{t('survey.intro.title')}</h1>
          <p className="text-accent-700 mb-2">{t('survey.intro.welcome')}</p>
          <p className="text-xs text-accent-500 mb-4">{t('survey.intro.confidentialityNotice')}</p>
          <p className="font-medium text-primary-700 mb-2">{t('survey.memberStatus.label')}</p>
          <div className="flex flex-wrap gap-4 mb-2">
            {['firstTimeGuest', 'newMember', 'existingMember'].map(key => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="memberStatus"
                  checked={memberStatus === key}
                  onChange={() => onMemberStatusChange(key)}
                />
                {t(`survey.memberStatus.options.${key}`)}
              </label>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-primary-700 mb-1">{t(`survey.section${section}.title`)}</h2>
      <p className="text-sm text-accent-500 mb-4">{t(`survey.section${section}.instruction`)}</p>
      <p className="text-xs text-accent-500 mb-4">{t('survey.wizard.skipHint')}</p>

      {questions.map(q => (
        <SurveyQuestion
          key={q.id}
          question={q}
          value={answers[q.id]}
          otherValue={otherTexts[`${q.id}Other`]}
          onChange={onAnswerChange}
          onOtherChange={onOtherChange}
        />
      ))}

      {submitError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">{submitError}</div>}

      <div className="flex justify-between mt-6">
        {!isFirst ? (
          <button type="button" className="btn btn-secondary" onClick={onBack}>{t('survey.wizard.back')}</button>
        ) : <span />}
        {isLast ? (
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? t('survey.wizard.submitting') : t('survey.wizard.submit')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNext}>{t('survey.wizard.next')}</button>
        )}
      </div>
    </div>
  );
};

export default SurveyWizard;
```

- [ ] **Step 5: Write `SurveyPage.tsx`**

```tsx
// frontend/src/components/survey/SurveyPage.tsx
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import SurveyWizard from './SurveyWizard';
import SurveyThankYou from './SurveyThankYou';
import { SURVEY_SLUG, SURVEY_SECTION_COUNT, SURVEY_QUESTIONS } from './surveyDefinitions';
import { loadDraft, saveDraft, clearDraft } from '../../utils/surveyDraft';
import { submitSurveyResponse } from '../../utils/surveyApi';

const SurveyPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [memberStatus, setMemberStatus] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setAnswers(draft.answers);
      setOtherTexts(draft.otherTexts);
      setSectionIndex(draft.sectionIndex);
    }
  }, []);

  useEffect(() => {
    if (!submitted) {
      saveDraft({ answers, otherTexts, sectionIndex });
    }
  }, [answers, otherTexts, sectionIndex, submitted]);

  const handleAnswerChange = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const handleOtherChange = (id: string, text: string) => {
    setOtherTexts(prev => ({ ...prev, [`${id}Other`]: text }));
  };

  const buildSubmissionAnswers = (): Record<string, string | string[]> => {
    const merged: Record<string, string | string[]> = { ...answers };
    SURVEY_QUESTIONS.forEach(q => {
      if (!q.otherOptionKey) return;
      const key = `${q.id}Other`;
      const text = otherTexts[key];
      if (!text) return;
      const currentValue = answers[q.id];
      const isOtherSelected = q.type === 'single'
        ? currentValue === q.otherOptionKey
        : Array.isArray(currentValue) && currentValue.includes(q.otherOptionKey);
      if (isOtherSelected) merged[key] = text;
    });
    return merged;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitSurveyResponse({
        surveySlug: SURVEY_SLUG,
        locale: language as 'en' | 'ti',
        memberStatus,
        answers: buildSubmissionAnswers()
      });
      clearDraft();
      setSubmitted(true);
    } catch {
      setSubmitError(t('survey.wizard.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <SurveyThankYou />;

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <SurveyWizard
          sectionIndex={sectionIndex}
          answers={answers}
          otherTexts={otherTexts}
          memberStatus={memberStatus}
          onAnswerChange={handleAnswerChange}
          onOtherChange={handleOtherChange}
          onMemberStatusChange={setMemberStatus}
          onBack={() => setSectionIndex(i => Math.max(0, i - 1))}
          onNext={() => setSectionIndex(i => Math.min(SURVEY_SECTION_COUNT - 1, i + 1))}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
};

export default SurveyPage;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false SurveyPage.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/survey/SurveyWizard.tsx frontend/src/components/survey/SurveyThankYou.tsx frontend/src/components/survey/SurveyPage.tsx frontend/src/components/survey/__tests__/SurveyPage.test.tsx
git commit -m "feat: add survey wizard shell with draft persistence and submit flow"
```

---

### Task 10: Frontend — wire `/survey` route + homepage entry point

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/QuickLinks.tsx`
- Create: `frontend/src/components/__tests__/QuickLinks.test.tsx`

**Interfaces:**
- Consumes: `SurveyPage` (Task 9).
- Produces: public route `/survey`; a new card in the homepage `QuickLinks` grid linking to it.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/__tests__/QuickLinks.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import QuickLinks from '../QuickLinks';

const renderWithProviders = () => render(
  <BrowserRouter><I18nProvider><LanguageProvider><QuickLinks /></LanguageProvider></I18nProvider></BrowserRouter>
);

describe('QuickLinks', () => {
  it('links to the survey page', () => {
    renderWithProviders();
    const link = screen.getByText('Church Services Survey').closest('a');
    expect(link).toHaveAttribute('href', '/survey');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `CI=true npx react-scripts test --watchAll=false QuickLinks.test.tsx`
Expected: FAIL — no element with text "Church Services Survey".

- [ ] **Step 3: Add the lazy import and route in `App.tsx`**

Add near the other lazy imports (alongside `ParishPulseSignUp`, around line 69):

```ts
const SurveyPage = lazy(() => import('./components/survey/SurveyPage'));
```

Add near the other public routes (alongside `/parish-pulse-sign-up`, around line 176):

```tsx
<Route path="/survey" element={<SurveyPage />} />
```

- [ ] **Step 4: Add the card to `QuickLinks.tsx`**

Add a new `<Card>` inside the `grid` alongside the existing three (no `lg:order` override needed — it takes the next grid slot):

```tsx
<Card
  icon="fas fa-clipboard-list"
  title={t('survey.homeCard.title')}
  desc={t('survey.homeCard.description')}
  to="/survey"
/>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false QuickLinks.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/QuickLinks.tsx frontend/src/components/__tests__/QuickLinks.test.tsx
git commit -m "feat: link the church services survey from the homepage"
```

---

### Task 11: Frontend — Admin `SurveyReportPage.tsx` + route wiring

**Files:**
- Create: `frontend/src/components/admin/SurveyReportPage.tsx`
- Create: `frontend/src/components/admin/__tests__/SurveyReportPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `fetchSurveyReport`, `SurveyReportData` (Task 7); `SURVEY_QUESTIONS`, `SURVEY_SLUG` (Task 5); `useAuth()` (`currentUser`, `getUserProfile`, `firebaseUser`); `useLanguage()`.
- Produces: `/admin/survey-report` route, bare `<ProtectedRoute>` (matches the `/admin/voicemails` convention — any authenticated user reaches the route, the component itself gates by role via `getMergedPermissions`/role array, exactly like `AdminDashboard.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/admin/__tests__/SurveyReportPage.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyReportPage from '../SurveyReportPage';
import * as surveyApi from '../../../utils/surveyApi';

jest.mock('../../../utils/surveyApi');
const mockedFetchReport = surveyApi.fetchSurveyReport as jest.Mock;

const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const renderPage = () => render(<I18nProvider><LanguageProvider><SurveyReportPage /></LanguageProvider></I18nProvider>);

describe('SurveyReportPage', () => {
  beforeEach(() => {
    mockedFetchReport.mockReset();
  });

  it('shows access denied for a member role', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['member'] } } })
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument());
    expect(mockedFetchReport).not.toHaveBeenCalled();
  });

  it('loads and displays tallies for an admin role', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['admin'] } } })
    });
    mockedFetchReport.mockResolvedValue({
      totalResponses: 2,
      questionTallies: { q2: { male: 1, female: 1 } },
      freeTextAnswers: { q7: ['Great parish'] }
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Responses')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Great parish')).toBeInTheDocument();
    expect(mockedFetchReport).toHaveBeenCalledWith('token', 'church-services-assessment-2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false SurveyReportPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/components/admin/SurveyReportPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchSurveyReport, SurveyReportData } from '../../utils/surveyApi';
import { SURVEY_QUESTIONS, SURVEY_SLUG } from '../survey/surveyDefinitions';

const ALLOWED_ROLES = ['admin', 'secretary', 'board'];

const SurveyReportPage: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [userRoles, setUserRoles] = useState<string[] | null>(null);
  const [report, setReport] = useState<SurveyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const uid = currentUser.uid || currentUser.id;
      const profile = await getUserProfile(uid, currentUser.email, currentUser.phoneNumber);
      const memberData = profile?.data?.member || profile;
      const roles: string[] = memberData?.roles || [memberData?.role || 'member'];
      setUserRoles(roles);
    };
    load();
  }, [currentUser, getUserProfile]);

  const canAccess = useMemo(
    () => !!userRoles && userRoles.some(r => ALLOWED_ROLES.includes(r)),
    [userRoles]
  );

  useEffect(() => {
    if (userRoles === null) return;
    if (!canAccess) { setLoading(false); return; }

    const load = async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const data = await fetchSurveyReport(token || '', SURVEY_SLUG);
        setReport(data);
      } catch {
        setError(t('survey.report.loadError'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userRoles, canAccess, firebaseUser, t]);

  if (userRoles === null || loading) {
    return <div className="p-8 text-center text-accent-500">{t('survey.report.loading')}</div>;
  }

  if (!canAccess) {
    return <div className="p-8 text-center text-red-600">{t('survey.report.accessDenied')}</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!report || report.totalResponses === 0) {
    return <div className="p-8 text-center text-accent-500">{t('survey.report.noResponsesYet')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-h2 font-serif text-primary-700 mb-4">{t('survey.report.title')}</h1>
      <p className="mb-6"><strong>{t('survey.report.totalResponses')}:</strong> {report.totalResponses}</p>

      {SURVEY_QUESTIONS.filter(q => q.type !== 'text').map(q => {
        const tallies = report.questionTallies[q.id] || {};
        return (
          <div key={q.id} className="mb-6">
            <p className="font-medium text-primary-700 mb-2">{t(`survey.${q.id}.label`)}</p>
            {(q.optionKeys || []).map(key => {
              const count = tallies[key] || 0;
              const pct = report.totalResponses ? Math.round((count / report.totalResponses) * 100) : 0;
              return (
                <div key={key} className="mb-1">
                  <div className="flex justify-between text-sm text-accent-700">
                    <span>{t(`survey.${q.id}.options.${key}`)}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-accent-100 rounded h-2">
                    <div className="bg-primary-600 h-2 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {SURVEY_QUESTIONS.filter(q => q.type === 'text').map(q => {
        const texts = report.freeTextAnswers[q.id] || [];
        if (texts.length === 0) return null;
        return (
          <div key={q.id} className="mb-6">
            <p className="font-medium text-primary-700 mb-2">{t(`survey.${q.id}.label`)}</p>
            <p className="text-xs text-accent-500 mb-2">{t('survey.report.freeTextAnswers')}</p>
            <ul className="list-disc list-inside space-y-1">
              {texts.map((text, i) => <li key={i} className="text-sm text-accent-700">{text}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default SurveyReportPage;
```

- [ ] **Step 4: Wire the route in `App.tsx`**

Add the lazy import near the other `admin/` imports:

```ts
const SurveyReportPage = lazy(() => import(/* webpackChunkName: "admin-survey-report" */ './components/admin/SurveyReportPage'));
```

Add the route near `/admin/voicemails`:

```tsx
<Route path="/admin/survey-report" element={<ProtectedRoute><SurveyReportPage /></ProtectedRoute>} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false SurveyReportPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/SurveyReportPage.tsx frontend/src/components/admin/__tests__/SurveyReportPage.test.tsx frontend/src/App.tsx
git commit -m "feat: add admin survey report page with per-question tallies"
```

---

## Post-implementation checklist

- [ ] Run the full backend suite: `cd backend && npm test` — confirm no regressions outside the new `survey*` files.
- [ ] Run the full frontend suite: `cd frontend && npm test -- --watchAll=false` — confirm no regressions outside the new `survey*`/`Survey*` files.
- [ ] Manually verify in a browser: submit the survey once in English, once in Tigrigna, confirm both appear in `/admin/survey-report` tallies with a real admin-role login (see `superpowers:verification-before-completion` before claiming this plan complete).
- [ ] Confirm `SURVEY_IP_SALT` is set in production env vars before this ships (see `backend/env.example` addition in Task 3) — without it, the fallback dev salt is used, which is fine functionally but not ideal for the audit trail's integrity.

