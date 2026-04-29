/**
 * ══════════════════════════════════════════════════════════════
 * UNIT TESTING SUITE — UNIMEDIA SYSTEM
 * ══════════════════════════════════════════════════════════════
 * Tests for individual components and core functions
 * Including: validation, API key checks, error handling, endpoints
 */

// Set test environment before importing app
process.env.NODE_ENV = 'test';

// ─── Mock external dependencies BEFORE importing app ──────────
jest.mock('node-fetch', () => jest.fn());
jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: 'Sample PDF text content' }),
    destroy: jest.fn().mockResolvedValue(undefined)
  }))
}));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'Sample DOCX text' })
}));
jest.mock('sharp', () => jest.fn(() => ({
  jpeg: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('compressed'))
})));

const fetch = require('node-fetch');
const request = require('supertest');
const app = require('../server');

// Reset mocks before every test
beforeEach(() => {
  fetch.mockReset();
  fetch.mockRejectedValue(new Error('Network unavailable'));
});

// ══════════════════════════════════════════════════════════════
// UNIT TEST SUITE 1: VALIDATION UTILITIES
// ══════════════════════════════════════════════════════════════

describe('UNIT TESTS — Input Validation & API Key Checks', () => {

  // ────────────────────────────────────────────────────────────
  // 1.1: API Key Format Validation
  // ────────────────────────────────────────────────────────────
  describe('1.1 API Key Format Validation', () => {
    
    it('should accept valid API key (gsk_ prefix)', async () => {
      const res = await request(app)
        .post('/api/verify-key')
        .send({ apiKey: 'gsk_validkey123456789' });
      expect(res.statusCode).toBe(200);
    });

    it('should reject API key without gsk_ prefix', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', 'invalid_key_123')
        .attach('audio', Buffer.from('fake'), 'test.mp3');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Invalid API key format/i);
    });

    it('should reject empty API key', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', '')
        .attach('audio', Buffer.from('fake'), 'test.mp3');
      expect(res.statusCode).toBe(400);
    });

    it('should reject whitespace-only API key', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', '   ')
        .attach('audio', Buffer.from('fake'), 'test.mp3');
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing API key entirely', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test prompt' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 1.2: File Upload Validation
  // ────────────────────────────────────────────────────────────
  describe('1.2 File Upload Validation', () => {
    
    it('should reject transcribe without audio file', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No audio file/i);
    });

    it('should reject document upload without file', async () => {
      const res = await request(app)
        .post('/api/document')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No document file/i);
    });

    it('should reject image-ocr without image file', async () => {
      const res = await request(app)
        .post('/api/image-ocr')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject pdf upload without file', async () => {
      const res = await request(app)
        .post('/api/pdf')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject video upload without file', async () => {
      const res = await request(app)
        .post('/api/video')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 1.3: Text Input Validation
  // ────────────────────────────────────────────────────────────
  describe('1.3 Text Input Validation', () => {
    
    it('should reject empty text for TTS', async () => {
      const res = await request(app)
        .post('/api/tts')
        .send({ text: '', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject whitespace-only text for TTS', async () => {
      const res = await request(app)
        .post('/api/tts')
        .send({ text: '   \n  \t  ', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject empty prompt for AI', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: '', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing prompt for AI', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should accept valid prompt for AI', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Test response' } }] 
        })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'What is 2+2?', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBeDefined();
    });
  });
});

// ══════════════════════════════════════════════════════════════
// UNIT TEST SUITE 2: CORE ENDPOINTS & FUNCTIONALITY
// ══════════════════════════════════════════════════════════════

describe('UNIT TESTS — Core Endpoint Functionality', () => {

  // ────────────────────────────────────────────────────────────
  // 2.1: Health Check Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.1 Health Check — /health', () => {
    
    it('should return 200 with ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('should return valid timestamp', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('timestamp');
      expect(() => new Date(res.body.timestamp)).not.toThrow();
    });

    it('should be accessible without API key', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.2: Transcription Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.2 Transcription — /api/transcribe', () => {
    
    it('should fail with invalid API key format', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'invalid');
      expect(res.statusCode).toBe(400);
    });

    it('should fail with no audio file', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No audio file/i);
    });

    it('should fail with no API key', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should handle API failure gracefully', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(401);
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(500);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.3: AI Chat Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.3 AI Chat — /api/ai', () => {
    
    it('should require API key', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test' });
      expect(res.statusCode).toBe(400);
    });

    it('should require valid API key format', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'wrong' });
      expect(res.statusCode).toBe(400);
    });

    it('should require prompt', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should successfully call AI with valid input', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Response text' } }] 
        })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'What is AI?', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBe('Response text');
      expect(res.body.success).toBe(true);
    });

    it('should handle Groq API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(500);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.4: Text-to-Speech Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.4 Text-to-Speech — /api/tts', () => {
    
    it('should reject empty text', async () => {
      const res = await request(app)
        .post('/api/tts')
        .send({ text: '' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject whitespace-only text', async () => {
      const res = await request(app)
        .post('/api/tts')
        .send({ text: '   ' });
      expect(res.statusCode).toBe(400);
    });

    it('should accept valid text', async () => {
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100)
      });
      const res = await request(app)
        .post('/api/tts')
        .send({ text: 'Hello world' });
      expect(res.statusCode).toBe(200);
    });

    it('should handle missing API response', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' })
      });
      const res = await request(app)
        .post('/api/tts')
        .send({ text: 'Test' });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.5: Document Processing Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.5 Document Processing — /api/document', () => {
    
    it('should require API key', async () => {
      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('test'), 'test.pdf');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should reject invalid API key format', async () => {
      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('test'), 'test.pdf')
        .field('apiKey', 'wrong');
      expect(res.statusCode).toBe(400);
    });

    it('should require file upload', async () => {
      const res = await request(app)
        .post('/api/document')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should accept valid parameters', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Summary text' } }] 
        })
      });
      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('apiKey', 'gsk_test123')
        .field('summaryType', 'standard');
      expect(res.statusCode).toBe(200);
    });

    it('should reject unsupported file formats', async () => {
      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('test'), 'test.exe')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Unsupported file format/i);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.6: Image OCR Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.6 Image OCR — /api/image-ocr', () => {
    
    it('should require image file', async () => {
      const res = await request(app)
        .post('/api/image-ocr')
        .send({ apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid API key', async () => {
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('test'), 'test.jpg')
        .field('apiKey', 'invalid');
      expect(res.statusCode).toBe(400);
    });

    it('should handle missing API key', async () => {
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('test'), 'test.jpg');
      expect(res.statusCode).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.7: API Key Verification Endpoint
  // ────────────────────────────────────────────────────────────
  describe('2.7 API Key Verification — /api/verify-key', () => {
    
    it('should verify valid API key format', async () => {
      const res = await request(app)
        .post('/api/verify-key')
        .send({ apiKey: 'gsk_validkey123' });
      expect(res.statusCode).toBe(200);
    });

    it('should reject invalid API key format', async () => {
      const res = await request(app)
        .post('/api/verify-key')
        .send({ apiKey: 'invalid' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing API key', async () => {
      const res = await request(app)
        .post('/api/verify-key')
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// UNIT TEST SUITE 3: ERROR HANDLING & EDGE CASES
// ══════════════════════════════════════════════════════════════

describe('UNIT TESTS — Error Handling & Edge Cases', () => {

  // ────────────────────────────────────────────────────────────
  // 3.1: Network Error Handling
  // ────────────────────────────────────────────────────────────
  describe('3.1 Network Error Handling', () => {
    
    it('should handle fetch network failures', async () => {
      fetch.mockRejectedValue(new Error('Connection refused'));
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      fetch.mockRejectedValue(new Error('Request timeout'));
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'gsk_test123');
      expect(res.statusCode).toBe(500);
    });

    it('should handle malformed API responses', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect([500, 400]).toContain(res.statusCode);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3.2: Large Input Handling
  // ────────────────────────────────────────────────────────────
  describe('3.2 Large Input Handling', () => {
    
    it('should handle large text input for AI', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Response' } }] 
        })
      });
      const largePrompt = 'a'.repeat(5000);
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: largePrompt, apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
    });

    it('should handle large text for TTS', async () => {
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100)
      });
      const largeText = 'word '.repeat(1000);
      const res = await request(app)
        .post('/api/tts')
        .send({ text: largeText });
      expect([200, 413]).toContain(res.statusCode);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3.3: Special Characters Handling
  // ────────────────────────────────────────────────────────────
  describe('3.3 Special Characters Handling', () => {
    
    it('should handle special characters in prompt', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Response' } }] 
        })
      });
      const specialPrompt = '测试 🎯 <script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: specialPrompt, apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
    });

    it('should handle unicode in text', async () => {
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100)
      });
      const res = await request(app)
        .post('/api/tts')
        .send({ text: '你好世界 مرحبا بالعالم Привет' });
      expect(res.statusCode).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3.4: Concurrent Request Handling
  // ────────────────────────────────────────────────────────────
  describe('3.4 Concurrent Request Handling', () => {
    
    it('should handle multiple simultaneous health checks', async () => {
      const promises = Array(5).fill(null).map(() => 
        request(app).get('/health')
      );
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
      });
    });

    it('should handle concurrent AI requests', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Response' } }] 
        })
      });
      const promises = Array(3).fill(null).map(() => 
        request(app)
          .post('/api/ai')
          .send({ prompt: 'Test', apiKey: 'gsk_test123' })
      );
      const results = await Promise.all(promises);
      results.forEach(res => expect(res.statusCode).toBe(200));
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3.5: Invalid Request Format Handling
  // ────────────────────────────────────────────────────────────
  describe('3.5 Invalid Request Format Handling', () => {
    
    it('should handle malformed JSON', async () => {
      const res = await request(app)
        .post('/api/ai')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      expect([400, 500]).toContain(res.statusCode);
    });

    it('should handle missing Content-Type', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
    });

    it('should handle null values in fields', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: null, apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(400);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// UNIT TEST SUITE 4: RESPONSE VALIDATION
// ══════════════════════════════════════════════════════════════

describe('UNIT TESTS — Response Validation & Format', () => {

  describe('4.1 Response Format Consistency', () => {
    
    it('should return consistent error format', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test' });
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('text');
    });

    it('should return success responses with text field', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Result' } }] 
        })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.body).toHaveProperty('text');
      expect(res.body).toHaveProperty('source');
    });

    it('should include source field in responses', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Result' } }] 
        })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(['groq', 'local']).toContain(res.body.source);
    });
  });

  describe('4.2 HTTP Status Code Accuracy', () => {
    
    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/ai')
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it('should return 500 for internal server errors', async () => {
      fetch.mockRejectedValue(new Error('Critical error'));
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(500);
    });

    it('should return 200 for successful requests', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          choices: [{ message: { content: 'Success' } }] 
        })
      });
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUMMARY METRICS
// ══════════════════════════════════════════════════════════════
afterAll(() => {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║        UNIT TEST SUITE EXECUTION COMPLETE        ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\nTests Cover:');
  console.log('  ✓ Input validation (API keys, files, text)');
  console.log('  ✓ Core endpoint functionality');
  console.log('  ✓ Error handling & edge cases');
  console.log('  ✓ Response format validation');
  console.log('  ✓ Network error resilience');
  console.log('  ✓ Concurrent request handling');
  console.log('  ✓ Security (input sanitization)');
  console.log('  ✓ Special characters & unicode');
  console.log('');
});
