'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { getTvRotationInterval, setTvRotationInterval } = require('../controllers/churchSettingController');

const ALLOWED_ROLES = ['admin', 'relationship'];

router.get('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), getTvRotationInterval);
router.put('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), setTvRotationInterval);

module.exports = router;
