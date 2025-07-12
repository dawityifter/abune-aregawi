const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Member, Dependant } = require('../models');

// Register new member
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
      email,
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
      loginEmail,
      password,
      role,
      
      // Dependants
      dependants
    } = req.body;

    // Check if email already exists
    const existingMember = await Member.findOne({
      where: { email: email }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'A member with this email already exists'
      });
    }

    // Check if login email already exists
    const existingLoginEmail = await Member.findOne({
      where: { loginEmail: loginEmail }
    });

    if (existingLoginEmail) {
      return res.status(400).json({
        success: false,
        message: 'A member with this login email already exists'
      });
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
      loginEmail,
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
        email: member.loginEmail, 
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
    const { email, password } = req.body;

    // Find member by login email
    const member = await Member.findOne({
      where: { loginEmail: email },
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
        email: member.loginEmail, 
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

    // Find member by Firebase UID (we'll need to store this during registration)
    // For now, let's find by email since that's what we have in common
    const member = await Member.findOne({
      where: { 
        // We'll need to add a firebaseUid field to the Member model
        // For now, let's try to find by email from Firebase Auth
        email: req.query.email || '' // We'll pass email as query param
      },
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

    // Find member by email from Firebase Auth
    const member = await Member.findOne({
      where: { 
        email: req.query.email || '' // We'll pass email as query param
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found. Please complete your registration first.',
        code: 'REGISTRATION_REQUIRED'
      });
    }

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { password, role, isActive, memberId, loginEmail, ...updateData } = req.body;

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