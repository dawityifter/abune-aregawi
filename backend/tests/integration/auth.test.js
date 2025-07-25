const request = require('supertest');
const app = require('../../src/server');
const { Member } = require('../../src/models');
const bcrypt = require('bcryptjs');

describe('Authentication Endpoints', () => {
  let testMember;
  let authToken;

  beforeAll(async () => {
    // Clean up test data
    await Member.destroy({ where: {} });
  });

  afterAll(async () => {
    // Clean up test data
    await Member.destroy({ where: {} });
  });

  describe('POST /api/members/register', () => {
    const validMemberData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      maritalStatus: 'Single',
      streetLine1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      languagePreference: 'English',
      preferredGivingMethod: 'Online',
      titheParticipation: true,
      loginEmail: 'john.doe@example.com',
      password: 'password123',
      isHeadOfHousehold: true,
      role: 'member'
    };

    it('should register a new member successfully', async () => {
      const response = await request(app)
        .post('/api/members/register')
        .send(validMemberData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Member registered successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('member');
      expect(response.body.data.member).toHaveProperty('id');
      expect(response.body.data.member.email).toBe(validMemberData.email);
      expect(response.body.data.member).not.toHaveProperty('password');

      testMember = response.body.data.member;
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/members/register')
        .send(validMemberData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('email');
    });

    it('should reject registration with invalid email format', async () => {
      const invalidData = { ...validMemberData, email: 'invalid-email' };
      
      const response = await request(app)
        .post('/api/members/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const weakPasswordData = { ...validMemberData, email: 'test2@example.com', password: '123' };
      
      const response = await request(app)
        .post('/api/members/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('password');
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteData = { firstName: 'John' };
      
      const response = await request(app)
        .post('/api/members/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/members/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/members/login')
        .send({
          email: 'john.doe@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('john.doe@example.com');

      authToken = response.body.token;
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/members/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/members/login')
        .send({
          email: 'john.doe@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/members/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/members/profile', () => {
    it('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/members/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('member');
      expect(response.body.data.member.email).toBe('john.doe@example.com');
    });

    it('should reject profile access without token', async () => {
      const response = await request(app)
        .get('/api/members/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject profile access with invalid token', async () => {
      const response = await request(app)
        .get('/api/members/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/members/profile', () => {
    it('should update profile with valid data', async () => {
      const updateData = {
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        phoneNumber: '+1987654321'
      };

      const response = await request(app)
        .put('/api/members/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.data.member.firstName).toBe(updateData.firstName);
      expect(response.body.data.member.lastName).toBe(updateData.lastName);
      expect(response.body.data.member.phoneNumber).toBe(updateData.phoneNumber);
    });

    it('should reject profile update with invalid data', async () => {
      const invalidData = { email: 'invalid-email' };

      const response = await request(app)
        .put('/api/members/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
}); 