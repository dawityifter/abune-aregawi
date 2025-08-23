const request = require('supertest');
const app = require('../../src/server');

describe('Health Check Endpoint', () => {
  it('should return 200 and server status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('stripe');
    expect(response.body).toHaveProperty('firebase');
  });

  it('should return correct content type', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/);
  });

  it('should handle multiple concurrent requests', async () => {
    const requests = Array(5).fill().map(() => 
      request(app).get('/health')
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
    });
  });
}); 