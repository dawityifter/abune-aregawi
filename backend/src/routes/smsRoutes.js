'use strict';

const express = require('express');
const router = express.Router();

const { firebaseAuthMiddleware } = require('../middleware/auth');
const role = require('../middleware/role');
const smsController = require('../controllers/smsController');

const ALLOWED = ['secretary', 'church_leadership', 'admin', 'relationship'];

router.post('/sendIndividual/:memberId', firebaseAuthMiddleware, role(ALLOWED), smsController.sendIndividual);
router.post('/sendGroup/:groupId', firebaseAuthMiddleware, role(ALLOWED), smsController.sendGroup);
router.post('/sendAll', firebaseAuthMiddleware, role(ALLOWED), smsController.sendAll);

module.exports = router;
