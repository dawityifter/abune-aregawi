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
      firebase_uid: firebaseUid,
      password,
      role,
      
      // Dependents
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
          phoneNumber,
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
      date_of_birth: dateOfBirth,
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
    if (isHeadOfHousehold && dependants && Array.isArray(dependants) && dependants.length > 0) {
      const dependantsData = dependants.map(dependent => {
        const { baptismDate, nameDay, ...cleanDependent } = dependent;
        return {
          ...cleanDependent,
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

    // Fetch member with dependents
    const memberWithDependants = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
        as: 'dependents'
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

    // Update dependents if provided
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependents
      await Dependant.destroy({ where: { memberId: member.id } });
      
      // Add new dependents
      if (req.body.dependants.length > 0) {
        const dependantsData = req.body.dependants.map(dependent => {
          // Remove baptismDate and nameDay fields if they're empty or invalid
          const { baptismDate, nameDay, ...cleanDependent } = dependent;
          return {
            ...cleanDependent,
            memberId: member.id
          };
        });
        await Dependant.bulkCreate(dependantsData);
      }
    }

    // Fetch updated member with dependents
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
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
        model: Dependant,
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
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const offset = (page - 1) * limit;

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

    const { count, rows: members } = await Member.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [{
        model: require('../models').Dependant,
        as: 'dependents',
        attributes: ['id'] // Only get the count, not full data
      }]
    });

    // Transform snake_case to camelCase for frontend compatibility
    const transformedMembers = members.map(member => ({
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
      dependants: member.dependents ? member.dependents.length : 0 // Include dependent count
    }));

    res.json({
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

    await member.update(req.body);

    // Update dependents if provided
    if (req.body.dependants && Array.isArray(req.body.dependants)) {
      // Remove existing dependents
      await Dependant.destroy({ where: { memberId: member.id } });
      
      // Add new dependents
      if (req.body.dependants.length > 0) {
        const dependantsData = req.body.dependants.map(dependent => ({
          ...dependent,
          memberId: member.id
        }));
        await Dependant.bulkCreate(dependantsData);
      }
    }

    // Fetch updated member with dependents
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Dependant,
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

    // First, let's check if there's a member with this Firebase UID
    console.log('🔍 Checking for member with Firebase UID:', uid);
    const memberByUid = await Member.findOne({
      where: { firebase_uid: uid },
      include: [{
        model: require('../models').Dependant,
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

    // Find member by email or phone number
    let member = null;
    if (userEmail) {
      console.log('🔍 Searching by email:', userEmail);
      member = await Member.findOne({
        where: { email: userEmail },
        include: [{
          model: require('../models').Dependant,
          as: 'dependents'
        }]
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
          [Op.or]: phoneFormats.map(format => ({ phone_number: format }))
        },
        include: [{
          model: require('../models').Dependant,
          as: 'dependents'
        }]
      });
      
      // If not found, let's see what phone numbers exist in the database
      if (!member) {
        console.log('🔍 No member found with phone number, checking database contents...');
        const allPhones = await Member.findAll({
          attributes: ['id', 'first_name', 'last_name', 'phone_number', 'firebase_uid'],
          where: {
            phone_number: { [Op.not]: null }
          },
          limit: 10
        });
        console.log('🔍 Sample phone numbers in database:', allPhones.map(m => ({ 
          id: m.id, 
          name: `${m.first_name} ${m.last_name}`, 
          phone: m.phone_number,
          firebaseUid: m.firebase_uid 
        })));
        
        // Also check for any members with similar phone numbers
        const similarPhones = await Member.findAll({
          attributes: ['id', 'first_name', 'last_name', 'phone_number', 'firebase_uid'],
          where: {
            phone_number: { [Op.like]: `%${last10Digits}%` }
          }
        });
        console.log('🔍 Members with similar phone numbers:', similarPhones.map(m => ({ 
          id: m.id, 
          name: `${m.first_name} ${m.last_name}`, 
          phone: m.phone_number,
          firebaseUid: m.firebase_uid 
        })));
      }
    }

    console.log('🔍 Member search result:', member ? 'FOUND' : 'NOT FOUND');
    if (member) {
      console.log('🔍 Found member:', { id: member.id, email: member.email, phoneNumber: member.phone_number, firebaseUid: member.firebase_uid });
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
      whereClause.phone_number = req.query.phone; // Fixed: use snake_case field name
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone parameter is required'
      });
    }

    console.log('🔍 Looking for member with whereClause:', whereClause);

    const member = await Member.findOne({ where: whereClause });

    if (!member) {
      console.log('❌ Member not found with whereClause:', whereClause);
      return res.status(404).json({
        success: false,
        message: 'Member not found. Please complete your registration first.',
        code: 'REGISTRATION_REQUIRED'
      });
    }

    console.log('✅ Found member:', member.id);

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { password, role, isActive, memberId, ...updateData } = req.body;

    console.log('🔍 Update data received:', updateData);

    // Map camelCase field names from frontend to snake_case field names for database
    const mappedUpdateData = {
      first_name: updateData.firstName,
      middle_name: updateData.middleName,
      last_name: updateData.lastName,
      email: updateData.email,
      phone_number: updateData.phoneNumber,
      date_of_birth: updateData.dateOfBirth,
      gender: updateData.gender,
      marital_status: updateData.maritalStatus,
      emergency_contact_name: updateData.emergencyContactName,
      emergency_contact_phone: updateData.emergencyContactPhone,
      ministries: updateData.ministries,
      language_preference: updateData.languagePreference,
      date_joined_parish: updateData.dateJoinedParish,
      baptism_name: updateData.baptismName,
      interested_in_serving: updateData.interestedInServing,
      street_line1: updateData.streetLine1,
      apartment_no: updateData.apartmentNo,
      city: updateData.city,
      state: updateData.state,
      postal_code: updateData.postalCode,
      country: updateData.country
    };

    // Remove undefined values to avoid overwriting with null
    Object.keys(mappedUpdateData).forEach(key => {
      if (mappedUpdateData[key] === undefined) {
        delete mappedUpdateData[key];
      }
    });

    console.log('🔍 Mapped update data:', mappedUpdateData);

    await member.update(mappedUpdateData);

    console.log('✅ Member updated successfully');

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

// Get all dependents for a member
exports.getMemberDependents = async (req, res) => {
  try {
    const { memberId } = req.params;

    const dependents = await Dependant.findAll({
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

// Add a dependant to a member
exports.addDependent = async (req, res) => {
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

    // Create dependent
    const dependent = await Dependant.create({
      ...cleanDependantData,
      memberId
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
    const updateData = req.body;

    const dependent = await Dependant.findByPk(dependentId);
    if (!dependent) {
      return res.status(404).json({
        success: false,
        message: 'Dependent not found'
      });
    }

    // Remove baptismDate and nameDay fields if they're empty or invalid
    const { baptismDate, nameDay, ...cleanUpdateData } = updateData;

    await dependent.update(cleanUpdateData);

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

    const dependent = await Dependant.findByPk(dependentId);
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