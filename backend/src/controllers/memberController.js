const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Member, Dependent } = require('../models');
const { sanitizeInput } = require('../utils/sanitize');
const { newMemberRegistered } = require('../utils/notifications');

// Utility function to normalize phone numbers
const normalizePhoneNumber = (phoneNumber) => {
  // Return null for undefined/null/empty-like values
  if (phoneNumber === undefined || phoneNumber === null) return null;

  // Coerce to string to avoid calling string methods on numbers
  const asString = String(phoneNumber);

  // Trim whitespace
  const trimmed = asString.trim();
  if (trimmed.length === 0) return null;

  // If it starts with +, keep the + and remove all non-digits after it
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/[^\d]/g, '');
  }

  // Otherwise, remove all non-digits
  const digitsOnly = trimmed.replace(/[^\d]/g, '');

  // Special-case Firebase test numbers so they remain in exact expected form
  // +1234567890 and +15551234567 are common Firebase test numbers
  if (digitsOnly === '1234567890') return '+1234567890';
  if (digitsOnly === '15551234567') return '+15551234567';

  return digitsOnly;
};

// Search members by name or phone (include inactive). Minimum 3 chars. Limit 10.
exports.searchMembers = async (req, res) => {
  try {
    const { q } = req.query;
    const query = (q || '').trim();
    if (!query || query.length < 3) {
      return res.status(400).json({ success: false, message: 'Query must be at least 3 characters' });
    }

    // Prepare tokens from query for AND matching
    const lower = query.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean).slice(0, 5);

    // If looks like phone, also create normalized candidates
    let phoneCandidates = [];
    const digits = lower.replace(/[^0-9]/g, '');
    if (digits.length >= 10) {
      const e164 = digits.length === 11 ? `+${digits}` : `+1${digits.slice(-10)}`;
      phoneCandidates.push(e164);
    }

    const nameTokenClauses = tokens.map(t => ({
      [Op.or]: [
        { first_name: { [Op.iLike]: `%${t}%` } },
        { middle_name: { [Op.iLike]: `%${t}%` } },
        { last_name: { [Op.iLike]: `%${t}%` } },
      ]
    }));

    const where = nameTokenClauses.length > 0
      ? { [Op.and]: nameTokenClauses }
      : {};

    if (phoneCandidates.length > 0) {
      where[Op.or] = [
        ...(where[Op.or] || []),
        { phone_number: { [Op.in]: phoneCandidates } }
      ];
    }

    const members = await Member.findAll({
      where,
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'is_active'],
      order: [['last_name', 'ASC'], ['first_name', 'ASC']],
      limit: 10
    });

    const results = members.map(m => ({
      id: m.id,
      name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      phoneNumber: m.phone_number,
      isActive: m.is_active
    }));

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('searchMembers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// List members pending welcome (admin/relationship)
exports.getPendingWelcomes = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      is_welcomed: false,
      is_active: true,
    };

    const { count, rows } = await Member.findAndCountAll({
      where,
      attributes: [
        'id', 'first_name', 'last_name', 'email', 'phone_number', 'created_at', 'registration_status'
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const members = rows.map(m => ({
      id: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      phoneNumber: m.phone_number,
      createdAt: m.created_at,
      registrationStatus: m.registration_status,
    }));

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalMembers: count,
          hasNext: page * limit < count,
          hasPrev: page > 1,
        }
      }
    });
  } catch (error) {
    console.error('Get pending welcomes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ===== Dependent Self-Claim Flow =====
// Step 1: Start - list candidate dependents matching the authenticated member's phone/email
exports.selfClaimStart = async (req, res) => {
  try {
    const memberId = req.user.id;

    const member = await Member.findByPk(memberId, { attributes: ['id', 'email', 'phone_number', 'first_name', 'last_name'] });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Optional filters
    const { lastName, dateOfBirth } = req.body || {};

    const where = {
      linkedMemberId: { [Op.is]: null },
      [Op.or]: [
        member.phone_number ? { phone: member.phone_number } : null,
        member.email ? { email: member.email } : null
      ].filter(Boolean)
    };

    if (lastName) {
      where.lastName = { [Op.iLike]: lastName };
    }
    if (dateOfBirth) {
      where.dateOfBirth = dateOfBirth;
    }

    const candidates = await Dependent.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'dateOfBirth', 'relationship', 'phone', 'email']
    });

    return res.status(200).json({ success: true, data: { candidates } });
  } catch (error) {
    console.error('Self-claim start error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Step 2: Verify - confirm identity with lastName and/or DOB and issue a short-lived token
exports.selfClaimVerify = async (req, res) => {
  try {
    const memberId = req.user.id;
    const { dependentId, lastName, dateOfBirth } = req.body;

    const member = await Member.findByPk(memberId, { attributes: ['id', 'email', 'phone_number'] });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const dependent = await Dependent.findByPk(dependentId);
    if (!dependent) {
      return res.status(404).json({ success: false, message: 'Dependent not found' });
    }
    if (dependent.linkedMemberId) {
      return res.status(400).json({ success: false, message: 'Dependent already linked' });
    }

    // Ensure this dependent matches the member via phone/email
    const matchesContact = (
      (member.phone_number && dependent.phone && normalizePhoneNumber(dependent.phone) === normalizePhoneNumber(member.phone_number)) ||
      (member.email && dependent.email && dependent.email.toLowerCase() === member.email.toLowerCase())
    );
    if (!matchesContact) {
      return res.status(403).json({ success: false, message: 'Dependent does not match your contact information' });
    }

    // Verify last name and/or DOB
    if (lastName) {
      const depLast = (dependent.lastName || '').trim().toLowerCase();
      if (depLast !== lastName.trim().toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Last name does not match' });
      }
    }
    if (dateOfBirth) {
      const depDob = dependent.dateOfBirth ? String(dependent.dateOfBirth) : null;
      if (!depDob || depDob !== dateOfBirth) {
        return res.status(400).json({ success: false, message: 'Date of birth does not match' });
      }
    }

    // Issue a short-lived token authorizing the link
    const token = jwt.sign(
      { type: 'self-claim', dependentId, memberId },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({ success: true, data: { token } });
  } catch (error) {
    console.error('Self-claim verify error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Step 3: Link - consume token and set linkedMemberId
exports.selfClaimLink = async (req, res) => {
  try {
    const requesterMemberId = req.user.id;
    const { dependentId, token } = req.body;

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (payload.type !== 'self-claim' || payload.dependentId !== Number(dependentId) || payload.memberId !== requesterMemberId) {
      return res.status(401).json({ success: false, message: 'Token does not match request' });
    }

    const dependent = await Dependent.findByPk(dependentId);
    if (!dependent) {
      return res.status(404).json({ success: false, message: 'Dependent not found' });
    }
    if (dependent.linkedMemberId) {
      return res.status(400).json({ success: false, message: 'Dependent already linked' });
    }

    await dependent.update({ linkedMemberId: requesterMemberId });

    return res.status(200).json({ success: true, message: 'Dependent linked successfully', data: { dependent } });
  } catch (error) {
    console.error('Self-claim link error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Mark a member as welcomed (admin/relationship)
exports.markWelcomed = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.user.id;

    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (member.is_welcomed) {
      return res.status(200).json({
        success: true,
        message: 'Member already marked as welcomed',
        data: { id: member.id, isWelcomed: true, welcomedAt: member.welcomed_at, welcomedBy: member.welcomed_by }
      });
    }

    await member.update({
      is_welcomed: true,
      welcomed_at: new Date(),
      welcomed_by: actorId,
    });

    res.json({
      success: true,
      message: 'Member marked as welcomed',
      data: { id: member.id, isWelcomed: true, welcomedAt: member.welcomed_at, welcomedBy: member.welcomed_by }
    });
  } catch (error) {
    console.error('Mark welcomed error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Register new member with Firebase UID
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let {
      // Personal Information
      firstName,
      middleName,
      lastName,
      gender,
      maritalStatus,
      
      // Contact & Address
      phoneNumber,
      email: providedEmail,
      streetLine1,
      apartmentNo,
      city,
      state,
      postalCode,
      country,
      
      // Family Information
      isHeadOfHousehold,
      spouseName,
      spouseEmail,
      emergencyContactName,
      emergencyContactPhone,
      
      // Spiritual Information
      dateJoinedParish,
      baptismName,
      interestedInServing,
      ministries,
      languagePreference,
      
      // Contribution
      preferredGivingMethod,
      titheParticipation,
      yearlyPledge,
      
      // Account
      firebase_uid: firebaseUid,
      password,
      role,
      
      // Dependents (legacy field name 'dependants' from client)
      dependants
    } = req.body;

    // Normalize primary phone number to match DB format
    if (phoneNumber) {
      phoneNumber = normalizePhoneNumber(phoneNumber);
    }

    // Accept both camelCase and snake_case for firebase UID
    firebaseUid = firebaseUid || req.body.firebaseUid;

    // Defensive normalization for enums/values (frontend already does this)
    if (typeof gender === 'string') gender = gender.toLowerCase();
    if (typeof maritalStatus === 'string') maritalStatus = maritalStatus.toLowerCase();
    if (typeof req.body.preferredGivingMethod === 'string') {
      req.body.preferredGivingMethod = req.body.preferredGivingMethod.toLowerCase();
    }
    if (typeof req.body.interestedInServing === 'string') {
      req.body.interestedInServing = req.body.interestedInServing.toLowerCase();
    }
    if (typeof req.body.languagePreference === 'string') {
      const lp = req.body.languagePreference;
      // Map common labels to codes
      if (lp === 'English' || lp === 'en') req.body.languagePreference = 'en';
      else req.body.languagePreference = 'ti';
    }

    // Normalize incoming dependents array: prefer 'dependents', fallback to legacy 'dependants'
    const dependents = Array.isArray(req.body.dependents)
      ? req.body.dependents
      : dependants;

    // Handle phone sign-in users: generate placeholder email if none provided
    // This avoids database constraint issues while preserving existing data
    const email = providedEmail || `phone_${phoneNumber.replace(/[^0-9]/g, '')}@phone-signin.local`;

    // Check if email already exists in PostgreSQL (skip check for generated placeholder emails)
    let existingMemberByEmail = null;
    if (providedEmail) {
      existingMemberByEmail = await Member.findOne({
        where: { email: providedEmail }
      });
    }
    if (existingMemberByEmail) {
      return res.status(400).json({
        success: false,
        message: 'A member with this email already exists'
      });
    }

    // Handle Firebase-authenticated users completing their profile
    if (firebaseUid) {
      // Check if this Firebase UID already has a complete member profile
      const existingFirebaseUser = await Member.findOne({
        where: { firebase_uid: firebaseUid }
      });
      if (existingFirebaseUser) {
        return res.status(400).json({
          success: false,
          message: 'A member with this Firebase UID already exists'
        });
      }
      
      // For Firebase-authenticated users, allow phone number "duplicates" 
      // since they're completing their profile after authentication
      // We'll check if the phone number belongs to a different Firebase user
      const existingMemberByPhone = await Member.findOne({
        where: { 
          phone_number: phoneNumber,
          firebase_uid: { [require('sequelize').Op.ne]: firebaseUid } // Different Firebase UID
        }
      });
      if (existingMemberByPhone) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already registered to a different user'
        });
      }
    } else {
      // For non-Firebase users (traditional registration), check phone number duplicates
      const existingMemberByPhone = await Member.findOne({
        where: { phone_number: phoneNumber }
      });
      if (existingMemberByPhone) {
        return res.status(400).json({
          success: false,
          message: 'A member with this phone number already exists'
        });
      }
    }

    // --- FAMILY LOGIC ---
    let familyId = null;
    let finalSpouseEmail = spouseEmail || null;
    
    if (isHeadOfHousehold) {
      // Will set familyId to member.id after creation
    } else {
      // For non-head-of-household members, they must provide headOfHouseholdPhone
      const headOfHouseholdPhone = req.body.headOfHouseholdPhone;
      if (!headOfHouseholdPhone) {
        return res.status(400).json({
          success: false,
          message: 'Head of household phone number is required when you are not the head of household'
        });
      }
      
      // Normalize the phone number
      const normalizedPhone = normalizePhoneNumber(headOfHouseholdPhone);
      
      // Look up head of household by phone number
      const headOfHousehold = await Member.findOne({ 
        where: { 
          phone_number: normalizedPhone,
          is_active: true
        } 
      });
      
      if (!headOfHousehold) {
        return res.status(400).json({
          success: false,
          message: 'No active head of household found with this phone number. Please register as head of household or provide a valid head of household phone number.'
        });
      }
      
      // Check if this member is a head of household (has family_id = their own id or is null)
      const isHeadOfHousehold = !headOfHousehold.family_id || headOfHousehold.family_id === headOfHousehold.id;
      
      if (!isHeadOfHousehold) {
        return res.status(400).json({
          success: false,
          message: 'This phone number belongs to a member who is not a head of household. Please provide a valid head of household phone number.'
        });
      }
      
      // Use the head of household's family ID
      familyId = headOfHousehold.family_id || headOfHousehold.id;
    }

    // Create member
    const member = await Member.create({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      gender,
      marital_status: maritalStatus,
      phone_number: phoneNumber,
      email,
      street_line1: streetLine1,
      apartment_no: apartmentNo,
      city,
      state,
      postal_code: postalCode,
      country,
      // Note: is_head_of_household field is not defined in the model, removing this field
      spouse_name: spouseName,
      spouse_email: finalSpouseEmail,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      date_joined_parish: dateJoinedParish,
      baptism_name: baptismName,
      interested_in_serving: interestedInServing,
      ministries: ministries && Array.isArray(ministries) ? JSON.stringify(ministries) : null,
      language_preference: languagePreference,
      preferred_giving_method: preferredGivingMethod,
      tithe_participation: titheParticipation,
      yearly_pledge: yearlyPledge != null ? Number(yearlyPledge) : null,
      firebase_uid: firebaseUid,
      password: password || null, // Password is optional since Firebase handles auth
      role: role || 'member',
      family_id: familyId // may be null, will update if HoH
    });

    // If head of household, set family_id to own id
    if (isHeadOfHousehold) {
      member.family_id = member.id;
      await member.save();
    }

    // Add dependents if provided and HoH
    if (isHeadOfHousehold && dependents && Array.isArray(dependents) && dependents.length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const cleanDate = (v) => {
        if (!v || typeof v !== 'string') return null;
        const s = v.trim();
        if (!s) return null;
        return dateRegex.test(s) ? s : null;
      };

      const dependentsData = dependents.map((dependent) => {
        const rel = dependent.relationship;
        const isChild = rel === 'Son' || rel === 'Daughter';

        // Normalize phone
        const phone = dependent.phone ? normalizePhoneNumber(dependent.phone) : null;

        // Sanitize dates
        const dateOfBirth = isChild ? cleanDate(dependent.dateOfBirth) : null;
        const baptismDate = cleanDate(dependent.baptismDate);

        // Start with allowed/known fields, drop empty strings
        const base = {
          firstName: dependent.firstName,
          middleName: dependent.middleName || null,
          lastName: dependent.lastName,
          dateOfBirth,
          gender: dependent.gender || null,
          relationship: rel || null,
          phone,
          email: dependent.email || null,
          baptismName: dependent.baptismName || null,
          isBaptized: !!dependent.isBaptized,
          baptismDate,
          medicalConditions: dependent.medicalConditions || null,
          allergies: dependent.allergies || null,
          medications: dependent.medications || null,
          dietaryRestrictions: dependent.dietaryRestrictions || null,
          notes: dependent.notes || null,
          memberId: member.id,
          linkedMemberId: member.id
        };

        Object.keys(base).forEach((k) => {
          if (base[k] === '') base[k] = null;
        });

        return base;
      });

      await Dependent.bulkCreate(dependentsData);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: member.id, 
        email: member.email, 
        role: member.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Fetch member with dependents
    const memberWithDependents = await Member.findByPk(member.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    // Notify outreach/relationship team of new registration (env-driven)
    try {
      newMemberRegistered({
        id: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        phoneNumber: member.phone_number,
        email: member.email,
      });
    } catch (e) {
      console.warn('New member notification failed (non-blocking):', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        member: memberWithDependents,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if a phone number already exists in members
exports.checkPhoneExists = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    const member = await Member.findOne({
      where: { phone_number: normalized },
      attributes: ['id', 'first_name', 'last_name', 'is_active']
    });

    return res.status(200).json({
      success: true,
      data: member
        ? { exists: true, memberId: member.id, firstName: member.first_name, lastName: member.last_name, isActive: member.is_active }
        : { exists: false }
    });
  } catch (error) {
    console.error('Error checking phone existence:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Login member
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find member by login email
    const member = await Member.findOne({
      where: { email },
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if member is active
    if (!member.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact the church administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await member.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await member.update({ lastLogin: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: member.id, 
        email: member.email, 
        role: member.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        member,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get member profile
exports.getProfile = async (req, res) => {
  try {
    const member = await Member.findByPk(req.user.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: { member }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member profile
exports.updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const member = await Member.findByPk(req.user.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { password, role, isActive, memberId, ...updateData } = sanitizeInput(req.body);

    await member.update(updateData);

    // Update dependents if provided (legacy field name 'dependants')
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependents
      await Dependent.destroy({ where: { memberId: member.id } });
      
      // Add new dependents
      if (req.body.dependants.length > 0) {
        const dependentsData = req.body.dependants.map(dependent => {
          // Remove baptismDate field if it's empty or invalid
          const { baptismDate, ...cleanDependent } = dependent;
          return {
            ...cleanDependent,
            memberId: member.id,
            linkedMemberId: member.id
          };
        });
        await Dependent.bulkCreate(dependentsData);
      }
    }

    // Fetch updated member with dependents
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { member: updatedMember }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all members (admin only)
exports.getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { memberId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      include: [{
        model: Dependent,
        as: 'dependents'
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalMembers: count,
          hasNext: page * limit < count,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all members (Firebase auth - admin only)
exports.getAllMembersFirebase = async (req, res) => {
  try {
    console.log('🔍 getAllMembersFirebase called');
    console.log('🔍 Request user:', req.user);
    console.log('🔍 Request firebaseUid:', req.firebaseUid);
    console.log('🔍 Request query:', req.query);
    
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 Parsed params:', { page, limit, search, role, isActive });

    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.is_active = isActive === 'true';
    }

    console.log('🔍 Where clause:', whereClause);
    console.log('🔍 Limit:', parseInt(limit), 'Offset:', parseInt(offset));

    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [{
        model: Dependent,
        as: 'dependents',
        attributes: ['id'] // Only get the count, not full data
      }]
    });

    console.log('🔍 Query result - count:', count, 'members found:', members.length);
    
    // Debug: Check if dependents are being loaded
    if (members.length > 0) {
      console.log('🔍 First member dependents check:', {
        hasDependents: !!members[0].dependents,
        dependentsArray: members[0].dependents,
        dependentsLength: members[0].dependents ? members[0].dependents.length : 0
      });
    }

    // Transform snake_case to camelCase for frontend compatibility
    // Optimized: Only return fields actually used by frontend components
    const transformedMembers = members.map(member => {
      const depCount = member.dependents ? member.dependents.length : 0;
      console.log(`🔍 Member ${member.first_name} ${member.last_name}: dependents array =`, member.dependents, 'count =', depCount);
      return {
        id: member.id,
        firstName: member.first_name,
        middleName: member.middle_name,
        lastName: member.last_name,
        email: member.email,
        phoneNumber: member.phone_number,
        role: member.role,
        isActive: member.is_active,
        // Expose member number for frontend table
        memberId: member.member_id,
        member_id: member.member_id,
        // Dependent count for display
        dependentsCount: depCount
      };
    });

    console.log('🔍 Transformed members count:', transformedMembers.length);

    const response = {
      success: true,
      data: {
        members: transformedMembers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalMembers: count,
          hasNext: page * limit < count,
          hasPrev: page > 1
        }
      }
    };

    console.log('🔍 Final response:', JSON.stringify(response, null, 2));
    
    res.json(response);

  } catch (error) {
    console.error('❌ Get all members Firebase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member by ID (admin only)
exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: { member }
    });

  } catch (error) {
    console.error('Get member by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member (admin only)
exports.updateMember = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    await member.update(sanitizeInput(req.body));

    // Update dependents if provided
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependents
      await Dependent.destroy({ where: { memberId: member.id } });
      
      // Add new dependents
      if (req.body.dependants.length > 0) {
        const dependentsData = req.body.dependants.map(dependent => ({
          ...dependent,
          memberId: member.id,
          linkedMemberId: member.id
        }));
        await Dependent.bulkCreate(dependentsData);
      }
    }

    // Fetch updated member with dependents
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: { member: updatedMember }
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete member (admin only)
exports.deleteMember = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Soft delete - just deactivate the account
    await member.update({ is_active: false });
    const updated = await Member.findByPk(req.params.id, { attributes: ['id', 'is_active'] });

    res.json({
      success: true,
      message: 'Member deactivated successfully',
      data: { member: updated }
    });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member contributions (treasurer/admin only)
exports.getMemberContributions = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // For now, return empty contributions array
    // This will be implemented when Contribution model is created
    res.json({
      success: true,
      data: {
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          memberId: member.memberId
        },
        contributions: []
      }
    });

  } catch (error) {
    console.error('Get member contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member profile by Firebase UID
exports.getProfileByFirebaseUid = async (req, res) => {
  try {
    const { uid } = req.params;
    const userEmail = req.query.email;
    const userPhone = req.query.phone;
    console.log('🔍 getProfileByFirebaseUid called:', { uid, userEmail, userPhone });
    console.log('🔍 Request headers:', req.headers);
    
    // Set cache control headers to prevent 304 responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // First, let's check if there's a member with this Firebase UID
    console.log('🔍 Checking for member with Firebase UID:', uid);
    const memberByUid = await Member.findOne({
      where: { firebase_uid: uid },
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });
    
    if (memberByUid) {
      console.log('✅ Found member by Firebase UID:', { 
        id: memberByUid.id, 
        email: memberByUid.email, 
        phoneNumber: memberByUid.phone_number,
        firebaseUid: memberByUid.firebase_uid 
      });
      
      console.log('✅ Returning member profile by Firebase UID');
      
      // Transform snake_case to camelCase for frontend compatibility
      const transformedMember = {
        id: memberByUid.id,
        firstName: memberByUid.first_name,
        middleName: memberByUid.middle_name,
        lastName: memberByUid.last_name,
        email: memberByUid.email,
        phoneNumber: memberByUid.phone_number,
        role: memberByUid.role,
        isActive: memberByUid.is_active,
        dateJoinedParish: memberByUid.date_joined_parish,
        createdAt: memberByUid.created_at,
        updatedAt: memberByUid.updated_at,
        baptismName: memberByUid.baptism_name,
        dateOfBirth: memberByUid.date_of_birth,
        gender: memberByUid.gender,
        maritalStatus: memberByUid.marital_status,
        interestedInServing: memberByUid.interested_in_serving,
        streetLine1: memberByUid.street_line1,
        city: memberByUid.city,
        state: memberByUid.state,
        postalCode: memberByUid.postal_code,
        country: memberByUid.country,
        spouseName: memberByUid.spouse_name,
        householdSize: memberByUid.household_size,
        repentanceFather: memberByUid.repentance_father,
        registrationStatus: memberByUid.registration_status,
        firebaseUid: memberByUid.firebase_uid,
        familyId: memberByUid.family_id,
        apartmentNo: memberByUid.apartment_no,
        emergencyContactName: memberByUid.emergency_contact_name,
        emergencyContactPhone: memberByUid.emergency_contact_phone,
        dependents: memberByUid.dependents || []
      };
      
      const responseData = {
        success: true,
        data: { member: transformedMember }
      };
      console.log('📤 Response status: 200, data:', { memberId: memberByUid.id, email: memberByUid.email, phone: memberByUid.phone_number });
      return res.status(200).json(responseData);
    }

    // If no UID match, require at least email or phone
    if (!userEmail && !userPhone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone query parameter required'
      });
    }

    // Normalize phone to E.164 when provided
    let normalizedPhone = null;
    if (userPhone) {
      let p = normalizePhoneNumber(userPhone);
      const digits = (p || '').replace(/[^\d]/g, '');
      if (digits.length === 10) {
        normalizedPhone = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        normalizedPhone = `+${digits}`;
      } else if (p && p.startsWith('+') && digits.length > 0) {
        // Already in +COUNTRY format with digits
        normalizedPhone = `+${digits}`;
      } else {
        normalizedPhone = digits.length > 0 ? digits : null;
      }
    }

    // Find member by email and/or normalized phone
    let member = null;
    {
      const orConds = [];
      if (userEmail) orConds.push({ email: userEmail });
      if (normalizedPhone) orConds.push({ phone_number: normalizedPhone });
      if (orConds.length > 0) {
        member = await Member.findOne({
          where: { [Op.or]: orConds },
          include: [{ model: Dependent, as: 'dependents' }]
        });
      }
    }

    console.log('🔍 Member search result:', member ? 'FOUND' : 'NOT FOUND');
    if (member) {
      console.log('🔍 Found member:', { id: member.id, email: member.email, phoneNumber: member.phone_number, firebaseUid: member.firebase_uid });
    }

    // If no member found, attempt to resolve as a dependent login (by email or normalized phone)
    if (!member) {
      console.log('❌ Member not found. Checking dependents for dependent login...');
      let dependent = null;
      const depOrConds = [];
      if (userEmail) depOrConds.push({ email: userEmail });
      if (normalizedPhone) depOrConds.push({ phone: normalizedPhone });
      if (depOrConds.length > 0) {
        dependent = await Dependent.findOne({ where: { [Op.or]: depOrConds } });
      }

      if (dependent) {
        console.log('🔍 Dependent match found:', { id: dependent.id, linkedMemberId: dependent.linkedMemberId });
        if (!dependent.linkedMemberId) {
          const resp = {
            success: false,
            message: 'Dependent account is not yet linked to a member. Please complete self-claim linking first.',
            code: 'DEPENDENT_NOT_LINKED'
          };
          console.log('📤 Response status: 404, data:', resp);
          return res.status(404).json(resp);
        }

        // Load linked member summary (include address fields for household address)
        const linkedMember = await Member.findByPk(dependent.linkedMemberId, {
          attributes: [
            'id',
            'first_name',
            'last_name',
            'email',
            'phone_number',
            'role',
            'is_active',
            // Address fields for household address display
            'street_line1',
            'apartment_no',
            'city',
            'state',
            'postal_code',
            'country'
          ]
        });

        // Build a dependent-auth profile. Keep response shape with data.member
        // Include gender and dateOfBirth so frontend reflects updates correctly
        const dependentProfile = {
          id: dependent.id,
          firstName: dependent.firstName,
          middleName: dependent.middleName,
          lastName: dependent.lastName,
          email: dependent.email,
          phoneNumber: dependent.phone,
          dateOfBirth: dependent.dateOfBirth || null,
          gender: dependent.gender || null,
          relationship: dependent.relationship || null,
          languagePreference: dependent.languagePreference || null,
          interestedInServing: dependent.interestedInServing || null,
          role: 'dependent',
          isActive: linkedMember ? linkedMember.is_active : true,
          linkedMember: linkedMember
            ? {
                id: linkedMember.id,
                firstName: linkedMember.first_name,
                lastName: linkedMember.last_name,
                email: linkedMember.email,
                phoneNumber: linkedMember.phone_number,
                role: linkedMember.role,
                // Map address fields to camelCase for frontend
                streetLine1: linkedMember.street_line1,
                apartmentNo: linkedMember.apartment_no,
                city: linkedMember.city,
                state: linkedMember.state,
                postalCode: linkedMember.postal_code,
                country: linkedMember.country
              }
            : { id: dependent.linkedMemberId },
          // Provide minimal fields expected by frontend; dependents array not applicable
          dependents: []
        };

        const responseData = { success: true, data: { member: dependentProfile } };
        console.log('📤 Dependent login resolved. Response status: 200, dependentId:', dependent.id);
        return res.status(200).json(responseData);
      }

      // Neither member nor dependent matched
      const notFoundResponse = {
        success: false,
        message: 'Member not found. Please complete your registration first.',
        code: 'REGISTRATION_REQUIRED'
      };
      console.log('📤 Response status: 404, data:', notFoundResponse);
      return res.status(404).json(notFoundResponse);
    }

    // Update Firebase UID if not set
    console.log('🔍 Checking Firebase UID update:', { currentUid: member.firebase_uid, newUid: uid });
    if (!member.firebase_uid) {
      console.log('🔍 Updating Firebase UID...');
      await member.update({ firebase_uid: uid });
      console.log('✅ Firebase UID updated');
    }

    console.log('✅ Returning member profile');
    
    // Transform snake_case to camelCase for frontend compatibility
    const transformedMember = {
      id: member.id,
      firstName: member.first_name,
      middleName: member.middle_name,
      lastName: member.last_name,
      email: member.email,
      phoneNumber: member.phone_number,
      role: member.role,
      isActive: member.is_active,
      dateJoinedParish: member.date_joined_parish,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
      baptismName: member.baptism_name,
      dateOfBirth: member.date_of_birth,
      gender: member.gender,
      maritalStatus: member.marital_status,
      interestedInServing: member.interested_in_serving,
      streetLine1: member.street_line1,
      city: member.city,
      state: member.state,
      postalCode: member.postal_code,
      country: member.country,
      spouseName: member.spouse_name,
      householdSize: member.household_size,
      repentanceFather: member.repentance_father,
      registrationStatus: member.registration_status,
      firebaseUid: member.firebase_uid,
      familyId: member.family_id,
      apartmentNo: member.apartment_no,
      emergencyContactName: member.emergency_contact_name,
      emergencyContactPhone: member.emergency_contact_phone,
      dependents: member.dependents || []
    };
    
    const responseData = {
      success: true,
      data: { member: transformedMember }
    };
    console.log('📤 Response status: 200, data:', { memberId: member.id, email: member.email, phone: member.phone_number });
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Get profile by Firebase UID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update member profile by Firebase UID
exports.updateProfileByFirebaseUid = async (req, res) => {
  try {
    const { uid } = req.params;

    console.log('🔍 Profile update request:', {
      uid,
      query: req.query,
      body: req.body
    });

    // Find member by email or phone from Firebase Auth
    const whereClause = {};
    if (req.query.email) {
      whereClause.email = req.query.email;
    } else if (req.query.phone) {
      // Normalize phone in query to E.164 for consistent lookup
      let p = normalizePhoneNumber(req.query.phone);
      const digits = p.replace(/[^\d]/g, '');
      if (digits.length === 10) {
        p = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        p = `+${digits}`;
      }
      whereClause.phone_number = p; // Fixed: use snake_case field name
    } else {
      return res.status(400).json({
        success: false,
        message: 'Email or phone query parameter required'
      });
    }

    let member = await Member.findOne({ where: whereClause });

    // If no member is found, try to resolve as a dependent update
    if (!member) {
      const depWhere = {};
      if (whereClause.email) depWhere.email = whereClause.email;
      if (whereClause.phone_number) depWhere.phone = whereClause.phone_number;

      const dependent = await Dependent.findOne({ where: depWhere });

      if (!dependent) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // Update dependent fields from request body
      const depRaw = {
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phoneNumber,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        relationship: req.body.relationship,
        languagePreference: req.body.languagePreference,
        interestedInServing: req.body.interestedInServing,
      };
      // Sanitize (trims strings, converts empty strings to null)
      const depSanitized = sanitizeInput(depRaw);

      // Normalize gender to a safe set if provided
      if (typeof depSanitized.gender === 'string') {
        const g = depSanitized.gender.toLowerCase();
        const allowed = ['male', 'female', 'other'];
        depSanitized.gender = allowed.includes(g) ? g : undefined;
      }

      // Normalize interestedInServing to lowercase and allowed values if provided
      if (typeof depSanitized.interestedInServing === 'string') {
        const s = depSanitized.interestedInServing.toLowerCase();
        const allowedServing = ['yes', 'no', 'maybe'];
        depSanitized.interestedInServing = allowedServing.includes(s) ? s : undefined;
      }

      // Normalize phone to digits, prefer E.164 +1 for 10-digit US numbers
      if (depSanitized.phone) {
        let p = normalizePhoneNumber(depSanitized.phone);
        const digits = p.replace(/[^\d]/g, '');
        if (digits.length === 10) {
          p = `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
          p = `+${digits}`;
        }
        depSanitized.phone = p;
      }

      // Drop keys that are null/undefined to avoid overwriting existing data with nulls
      const depClean = {};
      Object.keys(depSanitized).forEach((k) => {
        const v = depSanitized[k];
        if (v !== null && v !== undefined) depClean[k] = v;
      });

      await dependent.update(depClean);

      // Load linked head of household (if any) to include a summary in the response
      let linkedMemberSummary = null;
      if (dependent.linkedMemberId) {
        const hoh = await Member.findByPk(dependent.linkedMemberId, {
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        });
        if (hoh) {
          linkedMemberSummary = {
            id: hoh.id,
            firstName: hoh.first_name,
            lastName: hoh.last_name,
            email: hoh.email,
            phoneNumber: hoh.phone_number
          };
        }
      }

      // Construct a member-like response object for dependents (consistent with GET handler shape)
      const responseMember = {
        role: 'dependent',
        id: dependent.id,
        firstName: dependent.firstName,
        middleName: dependent.middleName || null,
        lastName: dependent.lastName,
        email: dependent.email,
        phoneNumber: dependent.phone,
        dateOfBirth: dependent.dateOfBirth,
        gender: dependent.gender || null,
        relationship: dependent.relationship || null,
        languagePreference: dependent.languagePreference || null,
        interestedInServing: dependent.interestedInServing || null,
        linkedMember: linkedMemberSummary
      };

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { member: responseMember }
      });
    }

    // Normalize phone in payload if present, then map update fields from request body to DB fields
    let normalizedPayloadPhone = undefined;
    if (req.body.phoneNumber) {
      let p = normalizePhoneNumber(req.body.phoneNumber);
      const digits = p.replace(/[^\d]/g, '');
      if (digits.length === 10) {
        p = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        p = `+${digits}`;
      }
      normalizedPayloadPhone = p;
    }

    // Map update fields from request body to DB fields
    const mappedUpdateData = {
      first_name: req.body.firstName,
      middle_name: req.body.middleName,
      last_name: req.body.lastName,
      email: req.body.email,
      phone_number: normalizedPayloadPhone,
      date_of_birth: req.body.dateOfBirth,
      gender: req.body.gender,
      marital_status: req.body.maritalStatus,
      emergency_contact_name: req.body.emergencyContactName,
      emergency_contact_phone: req.body.emergencyContactPhone,
      ministries: req.body.ministries,
      language_preference: req.body.languagePreference,
      date_joined_parish: req.body.dateJoinedParish,
      baptism_name: req.body.baptismName,
      interested_in_serving: req.body.interestedInServing,
      street_line1: req.body.streetLine1,
      apartment_no: req.body.apartmentNo,
      city: req.body.city,
      state: req.body.state,
      postal_code: req.body.postalCode
    };

    // Remove undefined values first
    Object.keys(mappedUpdateData).forEach(key => {
      if (mappedUpdateData[key] === undefined) delete mappedUpdateData[key];
    });

    // Normalize gender if present
    if (typeof mappedUpdateData.gender === 'string') {
      const g = mappedUpdateData.gender.toLowerCase();
      const allowed = ['male', 'female', 'other'];
      mappedUpdateData.gender = allowed.includes(g) ? g : undefined;
      if (mappedUpdateData.gender === undefined) delete mappedUpdateData.gender;
    }

    // Sanitize then drop nulls to avoid overwriting existing columns with null
    const mappedSanitized = sanitizeInput(mappedUpdateData);
    Object.keys(mappedSanitized).forEach((k) => {
      if (mappedSanitized[k] === null || mappedSanitized[k] === undefined) {
        delete mappedSanitized[k];
      }
    });

    console.log('🔍 Cleaned update data:', mappedSanitized);

    await member.update(mappedSanitized);

    console.log('✅ Member updated successfully');

    // Fetch updated member
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { member: updatedMember }
    });

  } catch (error) {
    console.error('Update profile by Firebase UID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Complete registration after Firebase Auth (prevents partial saves)
exports.completeRegistration = async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const memberData = req.body;

    // Validate required fields
    if (!memberData.email || !memberData.firstName || !memberData.lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, firstName, and lastName are required'
      });
    }

    // Check if member already exists in PostgreSQL
    const existingMember = await Member.findOne({
      where: {
        [Op.or]: [
          { email: memberData.email },
          { firebase_uid: firebaseUid }
        ]
      }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Member already exists in database',
        data: { member: existingMember }
      });
    }

    // Create member in PostgreSQL with Firebase UID
    const member = await Member.create({
      ...memberData,
      firebase_uid: firebaseUid,
      role: memberData.role || 'member'
    });

    // Handle dependents if provided (prefer 'dependents', fallback to legacy 'dependants')
    const incomingDependents = Array.isArray(memberData.dependents)
      ? memberData.dependents
      : memberData.dependants;
    if (incomingDependents && Array.isArray(incomingDependents) && incomingDependents.length > 0) {
      const dependentsData = incomingDependents.map(dependent => ({
        ...dependent,
        memberId: member.id
      }));
      await Dependent.bulkCreate(dependentsData);
    }

    // Fetch complete member with dependents
    const completeMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: { member: completeMember }
    });

  } catch (error) {
    console.error('Complete registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update member role (admin only)
exports.updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['admin', 'church_leadership', 'treasurer', 'secretary', 'member', 'guest'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: ' + validRoles.join(', ')
      });
    }

    // Find and update member
    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Update role in PostgreSQL
    await member.update({ role });

    // Fetch updated member
    const updatedMember = await Member.findByPk(id, {
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: { member: updatedMember }
    });

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Dependents Management Endpoints

// Get all dependents for a member
exports.getMemberDependents = async (req, res) => {
  try {
    const { memberId } = req.params;

    const dependents = await Dependent.findAll({
      where: { memberId },
      order: [['dateOfBirth', 'ASC']]
    });

    res.json({
      success: true,
      data: { dependents }
    });

  } catch (error) {
    console.error('Get member dependents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get total count of all dependents (admin only)
exports.getTotalDependentsCount = async (req, res) => {
  try {
    const count = await Dependent.count();

    res.json({
      success: true,
      data: { count }
    });

  } catch (error) {
    console.error('Get total dependents count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add a dependant to a member
exports.addDependent = async (req, res) => {
  try {
    const { memberId } = req.params;
    const dependantData = sanitizeInput(req.body);

    // Verify member exists
    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Normalize phone if provided
    if (dependantData.phone) {
      dependantData.phone = normalizePhoneNumber(dependantData.phone);
    }

    const dependent = await Dependent.create({
      ...dependantData,
      memberId,
      linkedMemberId: Number(memberId)
    });

    res.status(201).json({
      success: true,
      message: 'Dependent added successfully',
      data: { dependent }
    });

  } catch (error) {
    console.error('Add dependent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update a dependent
exports.updateDependent = async (req, res) => {
  try {
    const { dependentId } = req.params;
    const updates = sanitizeInput(req.body);

    // Normalize phone if provided
    if (updates.phone) {
      updates.phone = normalizePhoneNumber(updates.phone);
    }

    const dependent = await Dependent.findByPk(dependentId);
    if (!dependent) {
      return res.status(404).json({
        success: false,
        message: 'Dependent not found'
      });
    }

    await dependent.update(updates);

    res.json({
      success: true,
      message: 'Dependent updated successfully',
      data: { dependent }
    });

  } catch (error) {
    console.error('Update dependent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

  // Delete a dependent
  exports.deleteDependent = async (req, res) => {
    try {
      const { dependentId } = req.params;

    const dependent = await Dependent.findByPk(dependentId);
    if (!dependent) {
      return res.status(404).json({
        success: false,
        message: 'Dependent not found'
      });
    }

    await dependent.destroy();

    res.json({
      success: true,
      message: 'Dependent deleted successfully'
    });

  } catch (error) {
    console.error('Delete dependent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 

// Cleanup orphaned Firebase users (admin only)
exports.cleanupOrphanedUsers = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }

    // Check if user exists in PostgreSQL
    const member = await Member.findOne({
      where: {
        email: email
      }
    });

    if (member) {
      return res.status(200).json({
        success: true,
        message: 'User exists in PostgreSQL',
        data: { member }
      });
    }

    // If user doesn't exist in PostgreSQL, we can't clean up Firebase Auth
    // This would require Firebase Admin SDK which we're not using
    return res.status(404).json({
      success: false,
      message: 'User not found in PostgreSQL. Cannot clean up Firebase Auth without Admin SDK.',
      suggestion: 'User may need to complete registration or contact administrator.'
    });

  } catch (error) {
    console.error('Cleanup orphaned users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check registration status
exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { email, firebaseUid } = req.query;

    if (!email && !firebaseUid) {
      return res.status(400).json({
        success: false,
        message: 'Either email or firebaseUid is required'
      });
    }

    const whereClause = {};
    if (email) {
      whereClause.email = email;
    }
    if (firebaseUid) {
      whereClause.firebase_uid = firebaseUid;
    }

    const member = await Member.findOne({
      where: whereClause,
      include: [{
        model: Dependent,
        as: 'dependents'
      }]
    });

    if (member) {
      return res.status(200).json({
        success: true,
        message: 'Registration complete',
        data: { 
          member,
          status: 'complete',
          hasFirebaseUid: !!member.firebase_uid
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Registration incomplete',
        data: { 
          status: 'incomplete',
          suggestion: 'User needs to complete registration in PostgreSQL'
        }
      });
    }

  } catch (error) {
    console.error('Check registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 

// Validate head of household phone number
exports.validateHeadOfHouseholdPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Find member by phone number
    const member = await Member.findOne({
      where: { 
        phone_number: normalizedPhone,
        is_active: true
      },
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'family_id']
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'No member found with this phone number'
      });
    }

    // Check if this member is a head of household (has family_id = their own id or is null)
    const isHeadOfHousehold = !member.family_id || member.family_id === member.id;
    
    if (!isHeadOfHousehold) {
      return res.status(400).json({
        success: false,
        message: 'This phone number belongs to a member who is not a head of household'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Valid head of household phone number',
      data: {
        memberId: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        phoneNumber: member.phone_number
      }
    });

  } catch (error) {
    console.error('Error validating head of household phone:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 