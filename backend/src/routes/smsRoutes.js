'use strict';

const express = require('express');
const router = express.Router();

const { firebaseAuthMiddleware } = require('../middleware/auth');
const role = require('../middleware/role');
const smsController = require('../controllers/smsController');

const ALLOWED = ['secretary', 'church_leadership', 'admin'];

// Send SMS endpoints
router.post('/sendIndividual/:memberId', firebaseAuthMiddleware, role(ALLOWED), smsController.sendIndividual);
router.post('/sendGroup/:groupId', firebaseAuthMiddleware, role(ALLOWED), smsController.sendGroup);
router.post('/sendDepartment/:departmentId', firebaseAuthMiddleware, role(ALLOWED), smsController.sendDepartment);
router.post('/sendAll', firebaseAuthMiddleware, role(ALLOWED), smsController.sendAll);
router.post('/sendPendingPledges', firebaseAuthMiddleware, role(ALLOWED), smsController.sendPendingPledges);
router.post('/sendFulfilledPledges', firebaseAuthMiddleware, role(ALLOWED), smsController.sendFulfilledPledges);

// Preview/Get recipients endpoints
router.get('/pendingPledgesRecipients', firebaseAuthMiddleware, role(ALLOWED), smsController.getPendingPledgesRecipients);
router.get('/fulfilledPledgesRecipients', firebaseAuthMiddleware, role(ALLOWED), smsController.getFulfilledPledgesRecipients);
router.get('/departmentRecipients/:departmentId', firebaseAuthMiddleware, role(ALLOWED), smsController.getDepartmentRecipients);
router.get('/allRecipients', firebaseAuthMiddleware, role(ALLOWED), smsController.getAllRecipients);
router.get('/pricing', firebaseAuthMiddleware, role(ALLOWED), smsController.getPricing);

module.exports = router;
