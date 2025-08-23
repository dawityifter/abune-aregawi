const request = require('supertest');
const app = require('../../src/server');
const { Member } = require('../../src/models');

// Updated to align with phone-only auth policy. Email/password login tests removed.
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
      gender: 'male',
      maritalStatus: 'single',
      streetLine1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      languagePreference: 'en',
      preferredGivingMethod: 'online',
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
      authToken = response.body.data.token;
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
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.some(error => error.msg.toLowerCase().includes('email'))).toBe(true);
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

  describe('GET /api/members/profile/jwt', () => {
    it('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/members/profile/jwt')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('member');
      expect(response.body.data.member.email).toBe('john.doe@example.com');
    });

    it('should reject profile access without token', async () => {
      const response = await request(app)
        .get('/api/members/profile/jwt')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject profile access with invalid token', async () => {
      const response = await request(app)
        .get('/api/members/profile/jwt')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/members/profile/jwt', () => {
    it('should update profile with valid data', async () => {
      const updateData = {
        first_name: 'John Updated',
        last_name: 'Doe Updated',
        phone_number: '+1987654321'
      };

      const response = await request(app)
        .put('/api/members/profile/jwt')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.data.member.first_name).toBe(updateData.first_name);
      expect(response.body.data.member.last_name).toBe(updateData.last_name);
      expect(response.body.data.member.phone_number).toBe(updateData.phone_number);
    });

    it('should reject profile update with invalid data', async () => {
      const invalidData = { email: 'invalid-email' };

      const response = await request(app)
        .put('/api/members/profile/jwt')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.some(error => error.msg.toLowerCase().includes('email'))).toBe(true);
    });
  });
}); 