'use strict';

const express = require('express');
const router = express.Router();

const { firebaseAuthMiddleware } = require('../middleware/auth');
const role = require('../middleware/role');
const groupController = require('../controllers/groupController');

const ALLOWED = ['secretary', 'church_leadership', 'admin'];

router.get('/active', firebaseAuthMiddleware, role(ALLOWED), groupController.listActive);

module.exports = router;
