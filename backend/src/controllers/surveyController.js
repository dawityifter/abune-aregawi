'use strict';
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { SurveyResponse } = require('../models');
const { isValidAnswers } = require('../config/surveyDefinitions/churchServicesAssessment2026');

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

module.exports = { submitResponse };
