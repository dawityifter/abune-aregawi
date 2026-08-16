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
