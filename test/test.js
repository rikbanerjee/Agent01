const request = require('supertest');
const app = require('../server');
const AIHelper = require('../utils/aiHelper');

// Mock environment variables for testing
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.GEMINI_API_KEY = 'test_gemini_key';

describe('AI SMS Agent Tests', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Use random port for testing
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Health Endpoints', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('activeConversations');
    });

    test('GET /status should return detailed status', async () => {
      const response = await request(app).get('/status');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('port');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('activeConversations');
      expect(response.body).toHaveProperty('twilioConfigured');
      expect(response.body).toHaveProperty('geminiConfigured');
    });
  });

  describe('Webhook Endpoint', () => {
    test('POST /webhook/sms should require valid Twilio signature', async () => {
      const response = await request(app)
        .post('/webhook/sms')
        .send({
          Body: 'Hello',
          From: '+1234567890',
          To: '+0987654321'
        });
      
      // Should fail without proper Twilio signature
      expect(response.status).toBe(403);
    });
  });

  describe('AI Helper Tests', () => {
    let aiHelper;

    beforeEach(() => {
      aiHelper = new AIHelper('test_api_key');
    });

    test('should filter inappropriate content', () => {
      const response = "This is a bad response with inappropriate words";
      const filtered = aiHelper.filterResponse(response);
      expect(filtered).toContain('***');
    });

    test('should truncate long responses', () => {
      const longResponse = "A".repeat(200);
      const filtered = aiHelper.filterResponse(longResponse);
      expect(filtered.length).toBeLessThanOrEqual(160);
      expect(filtered).toContain('...');
    });

    test('should analyze sentiment correctly', () => {
      expect(aiHelper.analyzeSentiment('I love this service')).toBe('positive');
      expect(aiHelper.analyzeSentiment('This is terrible')).toBe('negative');
      expect(aiHelper.analyzeSentiment('What time is it')).toBe('neutral');
    });

    test('should detect escalation keywords', () => {
      expect(aiHelper.shouldEscalateToHuman('I want to speak to a human')).toBe(true);
      expect(aiHelper.shouldEscalateToHuman('I have a complaint')).toBe(true);
      expect(aiHelper.shouldEscalateToHuman('Hello, how are you')).toBe(false);
    });

    test('should escalate after long conversations', () => {
      const longHistory = Array(10).fill({ role: 'customer', content: 'test' });
      expect(aiHelper.shouldEscalateToHuman('test', longHistory)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables gracefully', () => {
      // Test that the app doesn't crash when env vars are missing
      expect(() => {
        require('../server');
      }).not.toThrow();
    });
  });
});

// Integration test helpers
function createMockTwilioSignature(body, url, authToken) {
  // This is a simplified mock - in real tests you'd use Twilio's actual signature validation
  return 'mock_signature';
}

function createMockTwilioRequest(body) {
  return {
    headers: {
      'x-twilio-signature': createMockTwilioSignature(body, 'http://localhost/webhook/sms', 'test_auth_token')
    },
    body: body
  };
} 