const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Member, Child } = require('../models');

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
      
      // Children
      children
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
      role: role || 'member'
    });

    // Add children if provided
    if (children && Array.isArray(children) && children.length > 0) {
      const childrenData = children.map(child => ({
        ...child,
        memberId: member.id
      }));
      await Child.bulkCreate(childrenData);
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

    // Fetch member with children
    const memberWithChildren = await Member.findByPk(member.id, {
      include: [{
        model: Child,
        as: 'children'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      data: {
        member: memberWithChildren,
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
        model: Child,
        as: 'children'
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
        model: Child,
        as: 'children'
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

    // Update children if provided
    if (req.body.children && Array.isArray(req.body.children)) {
      // Remove existing children
      await Child.destroy({ where: { memberId: member.id } });
      
      // Add new children
      if (req.body.children.length > 0) {
        const childrenData = req.body.children.map(child => ({
          ...child,
          memberId: member.id
        }));
        await Child.bulkCreate(childrenData);
      }
    }

    // Fetch updated member with children
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Child,
        as: 'children'
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
        model: Child,
        as: 'children'
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

// Get member by ID (admin only)
exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id, {
      include: [{
        model: Child,
        as: 'children'
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

    // Update children if provided
    if (req.body.children && Array.isArray(req.body.children)) {
      // Remove existing children
      await Child.destroy({ where: { memberId: member.id } });
      
      // Add new children
      if (req.body.children.length > 0) {
        const childrenData = req.body.children.map(child => ({
          ...child,
          memberId: member.id
        }));
        await Child.bulkCreate(childrenData);
      }
    }

    // Fetch updated member with children
    const updatedMember = await Member.findByPk(member.id, {
      include: [{
        model: Child,
        as: 'children'
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
        model: Child,
        as: 'children'
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
        model: Child,
        as: 'children'
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

// Children Management Endpoints

// Get all children for a member
exports.getMemberChildren = async (req, res) => {
  try {
    const { memberId } = req.params;

    const children = await Child.findAll({
      where: { memberId },
      order: [['dateOfBirth', 'ASC']]
    });

    res.json({
      success: true,
      data: { children }
    });

  } catch (error) {
    console.error('Get member children error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add a child to a member
exports.addChild = async (req, res) => {
  try {
    const { memberId } = req.params;
    const childData = req.body;

    // Verify member exists
    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Create child
    const child = await Child.create({
      ...childData,
      memberId
    });

    res.status(201).json({
      success: true,
      message: 'Child added successfully',
      data: { child }
    });

  } catch (error) {
    console.error('Add child error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update a child
exports.updateChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const updateData = req.body;

    const child = await Child.findByPk(childId);
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found'
      });
    }

    await child.update(updateData);

    res.json({
      success: true,
      message: 'Child updated successfully',
      data: { child }
    });

  } catch (error) {
    console.error('Update child error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete a child
exports.deleteChild = async (req, res) => {
  try {
    const { childId } = req.params;

    const child = await Child.findByPk(childId);
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found'
      });
    }

    await child.destroy();

    res.json({
      success: true,
      message: 'Child deleted successfully'
    });

  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 