'use strict';
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { SurveyResponse } = require('../models');
const { isValidAnswers, SURVEY_DEFINITIONS } = require('../config/surveyDefinitions/churchServicesAssessment2026');

const MAX_ANSWERS_JSON_LENGTH = 20000;

// SURVEY_IP_SALT lets ops pin a stable salt across restarts, but nothing about
// ip_hash depends on that stability (it's an audit-trail breadcrumb only, never
// used for cross-session matching). So when the env var is unset, generate a
// random salt once per process instead of falling back to a fixed string —
// a source-controlled fallback would let anyone with the repo (or DB access)
// precompute sha256(ip + salt) for the whole IPv4 space and de-anonymize
// submitters, defeating the point of an anonymous survey.
const SURVEY_IP_SALT = process.env.SURVEY_IP_SALT || crypto.randomBytes(32).toString('hex');

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

    const ip_hash = crypto.createHash('sha256').update(`${req.ip}${SURVEY_IP_SALT}`).digest('hex');

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
    // No question in this survey is mandatory, so most respondents answer only a
    // minority of them. Percentages must be computed against the number of people
    // who answered THAT question, not totalResponses — otherwise a question 12 of
    // 100 respondents answered reads as if every option were out of 100.
    const answeredCounts = {};
    def.questions.forEach(q => {
      if (q.type === 'text') {
        freeTextAnswers[q.id] = [];
      } else {
        questionTallies[q.id] = {};
        answeredCounts[q.id] = 0;
      }
    });

    rows.forEach(row => {
      const answers = row.answers || {};
      def.questions.forEach(q => {
        const value = answers[q.id];
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value) && value.length === 0) return;

        if (q.type !== 'text') {
          answeredCounts[q.id] += 1;
        }

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
      data: { totalResponses: rows.length, answeredCounts, questionTallies, freeTextAnswers }
    });
  } catch (err) {
    console.error('getReport error:', err);
    return res.status(500).json({ success: false, message: 'Failed to build survey report' });
  }
};

module.exports = { submitResponse, getReport };
