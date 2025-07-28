const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Member, Dependant } = require('../models');

// Utility function to normalize phone numbers
const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }
  
  // Trim whitespace
  const trimmed = phoneNumber.trim();
  
  // If it starts with +, keep the + and remove all non-digits after it
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/[^\d]/g, '');
  }
  
  // Otherwise, remove all non-digits
  return trimmed.replace(/[^\d]/g, '');
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

    const {
      // Personal Information
      firstName,
      middleName,
      lastName,
      gender,
      dateOfBirth,
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
      
      // Account
      firebaseUid,
      password,
      role,
      
      // Dependants
      dependants
    } = req.body;

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

    // Check if phone number already exists in PostgreSQL
    const existingMemberByPhone = await Member.findOne({
      where: { phoneNumber }
    });
    if (existingMemberByPhone) {
      return res.status(400).json({
        success: false,
        message: 'A member with this phone number already exists'
      });
    }

    // Check if Firebase UID already exists in PostgreSQL
    if (firebaseUid) {
      const existingFirebaseUser = await Member.findOne({
        where: { firebaseUid }
      });
      if (existingFirebaseUser) {
        return res.status(400).json({
          success: false,
          message: 'A member with this Firebase UID already exists'
        });
      }
    }

    // --- FAMILY LOGIC ---
    let familyId = null;
    let finalSpouseEmail = spouseEmail || null;
    
    if (isHeadOfHousehold) {
      // Will set familyId to member.id after creation
    } else {
      // For non-head-of-household members, they must provide headOfHouseholdEmail
      const headOfHouseholdEmail = req.body.headOfHouseholdEmail;
      if (!headOfHouseholdEmail) {
        return res.status(400).json({
          success: false,
          message: 'Head of household email is required when you are not the head of household'
        });
      }
      
      // Look up head of household by email
      const headOfHousehold = await Member.findOne({ 
        where: { 
          email: headOfHouseholdEmail,
          isHeadOfHousehold: true,
          isActive: true
        } 
      });
      
      if (!headOfHousehold) {
        return res.status(400).json({
          success: false,
          message: 'No active head of household found with this email address. Please register as head of household or provide a valid head of household email.'
        });
      }
      
      // Use the head of household's family ID
      familyId = headOfHousehold.familyId || headOfHousehold.id;
    }

    // Create member
    const member = await Member.create({
      firstName,
      middleName,
      lastName,
      gender,
      dateOfBirth,
      maritalStatus,
      phoneNumber,
      email,
      streetLine1,
      apartmentNo,
      city,
      state,
      postalCode,
      country,
      isHeadOfHousehold: isHeadOfHousehold || false,
      spouseName,
      spouseEmail: finalSpouseEmail,
      emergencyContactName,
      emergencyContactPhone,
      dateJoinedParish,
      baptismName,
      interestedInServing,
      ministries: ministries && Array.isArray(ministries) ? JSON.stringify(ministries) : null,
      languagePreference,
      preferredGivingMethod,
      titheParticipation,
      firebaseUid,
      password: password || null, // Password is optional since Firebase handles auth
      role: role || 'member',
      familyId: familyId // may be null, will update if HoH
    });

    // If head of household, set familyId to own id
    if (isHeadOfHousehold) {
      member.familyId = member.id;
      await member.save();
    }

    // Add dependants if provided and HoH
    if (isHeadOfHousehold && dependants && Array.isArray(dependants) && dependants.length > 0) {
      const dependantsData = dependants.map(dependant => {
        const { baptismDate, nameDay, ...cleanDependant } = dependant;
        return {
          ...cleanDependant,
          memberId: member.id
        };
      });
      await Dependant.bulkCreate(dependantsData);
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

    // Fetch member with dependants
    const memberWithDependants = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        member: memberWithDependants,
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
        model: Dependant,
        as: 'dependants'
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
        model: Dependant,
        as: 'dependants'
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
    const { password, role, isActive, memberId, ...updateData } = req.body;

    await member.update(updateData);

    // Update dependants if provided
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependants
      await Dependant.destroy({ where: { memberId: member.id } });
      
      // Add new dependants
      if (req.body.dependants.length > 0) {
        const dependantsData = req.body.dependants.map(dependant => {
          // Remove baptismDate and nameDay fields if they're empty or invalid
          const { baptismDate, nameDay, ...cleanDependant } = dependant;
          return {
            ...cleanDependant,
            memberId: member.id
          };
        });
        await Dependant.bulkCreate(dependantsData);
      }
    }

    // Fetch updated member with dependants
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
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
        model: Dependant,
        as: 'dependants'
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
        model: Dependant,
        as: 'dependants'
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
    console.error('Get all members Firebase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get member by ID (admin only)
exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
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

    await member.update(req.body);

    // Update dependants if provided
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependants
      await Dependant.destroy({ where: { memberId: member.id } });
      
      // Add new dependants
      if (req.body.dependants.length > 0) {
        const dependantsData = req.body.dependants.map(dependant => ({
          ...dependant,
          memberId: member.id
        }));
        await Dependant.bulkCreate(dependantsData);
      }
    }

    // Fetch updated member with dependants
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
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
    await member.update({ isActive: false });

    res.json({
      success: true,
      message: 'Member deactivated successfully'
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

    if (!userEmail && !userPhone) {
      return res.status(400).json({
        success: false,
        message: 'User email or phone number is required'
      });
    }

    // Find member by email or phone number
    let member = null;
    if (userEmail) {
      console.log('🔍 Searching by email:', userEmail);
      member = await Member.findOne({
        where: { email: userEmail },
        include: [{ model: Dependant, as: 'dependants' }]
      });
    } else if (userPhone) {
      console.log('🔍 Searching by phone:', userPhone);
      // Handle different phone number formats
      const cleanPhone = userPhone.replace(/[^\d+]/g, '');
      console.log('🔍 Clean phone for search:', cleanPhone);
      
      // Create comprehensive phone format variations
      const digitsOnly = userPhone.replace(/[^\d]/g, '');
      const last10Digits = digitsOnly.slice(-10); // Get last 10 digits (remove country code)
      
      const phoneFormats = [
        userPhone,                                    // +14699078229
        cleanPhone,                                   // +14699078229
        digitsOnly,                                   // 14699078229
        last10Digits,                                 // 4699078229
        `+1${last10Digits}`,                         // +14699078229
        `(${last10Digits.slice(0,3)}) ${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`, // (469) 907-8229
        `${last10Digits.slice(0,3)}-${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`,   // 469-907-8229
        `${last10Digits.slice(0,3)}.${last10Digits.slice(3,6)}.${last10Digits.slice(6)}`,   // 469.907.8229
        `${last10Digits.slice(0,3)} ${last10Digits.slice(3,6)} ${last10Digits.slice(6)}`    // 469 907 8229
      ];
      console.log('🔍 Searching for phone in these formats:', phoneFormats);
      
      member = await Member.findOne({
        where: {
          [Op.or]: phoneFormats.map(format => ({ phoneNumber: format }))
        },
        include: [{ model: Dependant, as: 'dependants' }]
      });
      
      // If not found, let's see what phone numbers exist in the database
      if (!member) {
        const allPhones = await Member.findAll({
          attributes: ['id', 'firstName', 'lastName', 'phoneNumber'],
          where: {
            phoneNumber: { [Op.not]: null }
          },
          limit: 5
        });
        console.log('🔍 Sample phone numbers in database:', allPhones.map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, phone: m.phoneNumber })));
      }
    }

    console.log('🔍 Member search result:', member ? 'FOUND' : 'NOT FOUND');
    if (member) {
      console.log('🔍 Found member:', { id: member.id, email: member.email, phoneNumber: member.phoneNumber });
    }

    if (!member) {
      console.log('❌ Member not found, returning 404');
      const notFoundResponse = {
        success: false,
        message: 'Member not found. Please complete your registration first.',
        code: 'REGISTRATION_REQUIRED'
      };
      console.log('📤 Response status: 404, data:', notFoundResponse);
      return res.status(404).json(notFoundResponse);
    }

    // Update Firebase UID if not set
    console.log('🔍 Checking Firebase UID update:', { currentUid: member.firebaseUid, newUid: uid });
    if (!member.firebaseUid) {
      console.log('🔍 Updating Firebase UID...');
      await member.update({ firebaseUid: uid });
      console.log('✅ Firebase UID updated');
    }

    console.log('✅ Returning member profile');
    const responseData = {
      success: true,
      data: { member }
    };
    console.log('📤 Response status: 200, data:', { memberId: member.id, email: member.email, phone: member.phoneNumber });
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

    // Find member by email or phone from Firebase Auth
    const whereClause = {};
    if (req.query.email) {
      whereClause.email = req.query.email;
    } else if (req.query.phone) {
      whereClause.phoneNumber = req.query.phone;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone parameter is required'
      });
    }

    const member = await Member.findOne({ where: whereClause });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found. Please complete your registration first.',
        code: 'REGISTRATION_REQUIRED'
      });
    }

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { password, role, isActive, memberId, ...updateData } = req.body;

    await member.update(updateData);

    // Fetch updated member
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
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
          { firebaseUid: firebaseUid }
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
      firebaseUid: firebaseUid,
      role: memberData.role || 'member'
    });

    // Handle dependants if provided
    if (memberData.dependants && Array.isArray(memberData.dependants) && memberData.dependants.length > 0) {
      const dependantsData = memberData.dependants.map(dependant => ({
        ...dependant,
        memberId: member.id
      }));
      await Dependant.bulkCreate(dependantsData);
    }

    // Fetch complete member with dependants
    const completeMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependants'
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
        model: Dependant,
        as: 'dependants'
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

// Dependants Management Endpoints

// Get all dependants for a member
exports.getMemberDependants = async (req, res) => {
  try {
    const { memberId } = req.params;

    const dependants = await Dependant.findAll({
      where: { memberId },
      order: [['dateOfBirth', 'ASC']]
    });

    res.json({
      success: true,
      data: { dependants }
    });

  } catch (error) {
    console.error('Get member dependants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add a dependant to a member
exports.addDependant = async (req, res) => {
  try {
    const { memberId } = req.params;
    const dependantData = req.body;

    // Verify member exists
    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Remove baptismDate and nameDay fields if they're empty or invalid
    const { baptismDate, nameDay, ...cleanDependantData } = dependantData;

    // Create dependant
    const dependant = await Dependant.create({
      ...cleanDependantData,
      memberId
    });

    res.status(201).json({
      success: true,
      message: 'Dependant added successfully',
      data: { dependant }
    });

  } catch (error) {
    console.error('Add dependant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update a dependant
exports.updateDependant = async (req, res) => {
  try {
    const { dependantId } = req.params;
    const updateData = req.body;

    const dependant = await Dependant.findByPk(dependantId);
    if (!dependant) {
      return res.status(404).json({
        success: false,
        message: 'Dependant not found'
      });
    }

    // Remove baptismDate and nameDay fields if they're empty or invalid
    const { baptismDate, nameDay, ...cleanUpdateData } = updateData;

    await dependant.update(cleanUpdateData);

    res.json({
      success: true,
      message: 'Dependant updated successfully',
      data: { dependant }
    });

  } catch (error) {
    console.error('Update dependant error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete a dependant
exports.deleteDependant = async (req, res) => {
  try {
    const { dependantId } = req.params;

    const dependant = await Dependant.findByPk(dependantId);
    if (!dependant) {
      return res.status(404).json({
        success: false,
        message: 'Dependant not found'
      });
    }

    await dependant.destroy();

    res.json({
      success: true,
      message: 'Dependant deleted successfully'
    });

  } catch (error) {
    console.error('Delete dependant error:', error);
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
      whereClause.firebaseUid = firebaseUid;
    }

    const member = await Member.findOne({
      where: whereClause,
      include: [{
        model: Dependant,
        as: 'dependants'
      }]
    });

    if (member) {
      return res.status(200).json({
        success: true,
        message: 'Registration complete',
        data: { 
          member,
          status: 'complete',
          hasFirebaseUid: !!member.firebaseUid
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