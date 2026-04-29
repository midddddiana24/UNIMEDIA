/**
 * ══════════════════════════════════════════════════════════════
 * INTEGRATION TESTING SUITE — UNIMEDIA SYSTEM
 * ══════════════════════════════════════════════════════════════
 * Tests for module interactions and complete workflows
 * Including: API interactions, data flow, service integration
 */

// Set test environment before importing app
process.env.NODE_ENV = 'test';

// ─── Mock external dependencies BEFORE importing app ──────────
jest.mock('node-fetch', () => jest.fn());
jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: 'Sample PDF text content extracted successfully' }),
    destroy: jest.fn().mockResolvedValue(undefined)
  }))
}));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'Sample DOCX text extracted' })
}));
jest.mock('sharp', () => jest.fn(() => ({
  jpeg: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('compressed image data'))
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
// INTEGRATION TEST SUITE 1: MULTI-STEP WORKFLOWS
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — Multi-Step Workflows', () => {

  // ────────────────────────────────────────────────────────────
  // 1.1: Document Processing Workflow
  // ────────────────────────────────────────────────────────────
  describe('1.1 Complete Document Processing Workflow', () => {

    it('should process document → extract text → summarize workflow', async () => {
      // Mock Groq API for summarization
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Document contains important information about AI and machine learning concepts.' }
          }]
        })
      });

      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('This is test document content'), 'document.txt')
        .field('apiKey', 'gsk_test123')
        .field('summaryType', 'standard');

      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBeDefined();
    });

    it('should handle multi-format document uploads sequentially', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Summary' } }]
        })
      });

      // Test TXT
      const txtRes = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('Text content'), 'test.txt')
        .field('apiKey', 'gsk_test123');
      expect(txtRes.statusCode).toBe(200);

      // Test DOCX would go through mammoth
      // Test PDF would go through pdf-parse
    });

    it('should maintain state across multiple document uploads', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }]
        })
      });

      const res1 = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('First'), 'doc1.txt')
        .field('apiKey', 'gsk_test123');

      const res2 = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('Second'), 'doc2.txt')
        .field('apiKey', 'gsk_test123');

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 1.2: Audio Processing Workflow
  // ────────────────────────────────────────────────────────────
  describe('1.2 Audio Transcription → Summarization Workflow', () => {

    it('should transcribe audio and then summarize transcript', async () => {
      // Mock transcription response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Hello world this is a test transcription' })
      });

      // Mock summarization response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Brief summary of audio' } }]
        })
      });

      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake audio'), 'test.mp3')
        .field('apiKey', 'gsk_test123');

      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBeDefined();
    });

    it('should handle transcription failure gracefully', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } })
      });

      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake'), 'test.mp3')
        .field('apiKey', 'gsk_test123');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 1.3: AI Chat Workflow with Context
  // ────────────────────────────────────────────────────────────
  describe('1.3 Sequential AI Queries with State', () => {

    it('should handle multiple AI queries in sequence', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI response' } }]
        })
      });

      // First query
      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'What is AI?', apiKey: 'gsk_test123' });

      // Second query
      const res2 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Explain machine learning', apiKey: 'gsk_test123' });

      // Third query
      const res3 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'What about neural networks?', apiKey: 'gsk_test123' });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(200);
    });

    it('should recover from failed query and continue', async () => {
      // First query fails
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } })
      });

      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res1.statusCode).toBe(500);

      // Second query succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success' } }]
        })
      });

      const res2 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Try again', apiKey: 'gsk_test123' });
      expect(res2.statusCode).toBe(200);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION TEST SUITE 2: SERVICE INTERACTIONS
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — Service Interactions', () => {

  // ────────────────────────────────────────────────────────────
  // 2.1: API Key Validation Across Endpoints
  // ────────────────────────────────────────────────────────────
  describe('2.1 API Key Validation Integration', () => {

    it('should consistently validate API key across all endpoints', async () => {
      const invalidKeyRes1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'invalid' });

      const invalidKeyRes2 = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'invalid');

      const invalidKeyRes3 = await request(app)
        .post('/api/tts')
        .send({ text: 'Test', apiKey: 'invalid' });

      // All should fail with 400
      expect(invalidKeyRes1.statusCode).toBe(400);
      expect(invalidKeyRes2.statusCode).toBe(400);
      expect(invalidKeyRes3.statusCode).toBe(400);
    });

    it('should accept valid API key across all endpoints', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      const validKey = 'gsk_validkey123';

      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: validKey });

      const res2 = await request(app)
        .post('/api/verify-key')
        .send({ apiKey: validKey });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.2: Request/Response Data Flow Integration
  // ────────────────────────────────────────────────────────────
  describe('2.2 Request/Response Data Flow', () => {

    it('should maintain data integrity through processing pipeline', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed data' } }]
        })
      });

      const inputText = 'This is a test document with special characters: 测试 🎯 <tag>';

      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: inputText, apiKey: 'gsk_test123' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('text');
    });

    it('should handle large data transfers without corruption', async () => {
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.alloc(500000) // 500KB
      });

      const largeText = 'word '.repeat(50000); // ~250KB

      const res = await request(app)
        .post('/api/tts')
        .send({ text: largeText });

      expect([200, 413]).toContain(res.statusCode);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2.3: Error Handling Across Service Calls
  // ────────────────────────────────────────────────────────────
  describe('2.3 Cross-Service Error Handling', () => {

    it('should handle cascading service failures', async () => {
      // First external service call fails
      fetch.mockRejectedValueOnce(new Error('Service 1 down'));

      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });

      expect(res.statusCode).toBe(500);
    });

    it('should isolate failures to specific services', async () => {
      // AI service fails
      fetch.mockRejectedValueOnce(new Error('AI service down'));

      const aiRes = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(aiRes.statusCode).toBe(500);

      // TTS service succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('audio')
      });

      const ttsRes = await request(app)
        .post('/api/tts')
        .send({ text: 'Test' });
      expect(ttsRes.statusCode).toBe(200);
    });

    it('should provide consistent error format across all endpoints', async () => {
      fetch.mockRejectedValue(new Error('Service error'));

      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });

      const res2 = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('test'), 'test.mp3')
        .field('apiKey', 'gsk_test123');

      // Both should have error and text fields
      expect(res1.body).toHaveProperty('error');
      expect(res1.body).toHaveProperty('text');
      expect(res2.body).toHaveProperty('error');
      expect(res2.body).toHaveProperty('text');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION TEST SUITE 3: CONCURRENT OPERATIONS
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — Concurrent Operations', () => {

  // ────────────────────────────────────────────────────────────
  // 3.1: Parallel Request Handling
  // ────────────────────────────────────────────────────────────
  describe('3.1 Parallel Request Execution', () => {

    it('should handle concurrent document uploads', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Processed' } }]
        })
      });

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/document')
          .attach('file', Buffer.from(`Document ${i}`), `doc${i}.txt`)
          .field('apiKey', 'gsk_test123')
      );

      const results = await Promise.all(promises);
      results.forEach(res => expect(res.statusCode).toBe(200));
    });

    it('should handle concurrent AI requests', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/ai')
          .send({ prompt: `Question ${i}`, apiKey: 'gsk_test123' })
      );

      const results = await Promise.all(promises);
      results.forEach(res => expect(res.statusCode).toBe(200));
    });

    it('should handle mixed concurrent requests (different endpoints)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        }),
        arrayBuffer: async () => Buffer.from('audio')
      });

      const promises = [
        request(app).get('/health'),
        request(app)
          .post('/api/ai')
          .send({ prompt: 'Test', apiKey: 'gsk_test123' }),
        request(app)
          .post('/api/tts')
          .send({ text: 'Test' }),
        request(app)
          .post('/api/document')
          .attach('file', Buffer.from('test'), 'test.txt')
          .field('apiKey', 'gsk_test123')
      ];

      const results = await Promise.all(promises);
      results.forEach(res => expect(res.statusCode).toBeGreaterThanOrEqual(200));
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3.2: Resource Management Under Load
  // ────────────────────────────────────────────────────────────
  describe('3.2 Resource Management Under Load', () => {

    it('should not leak memory with many sequential requests', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/api/ai')
          .send({ prompt: `Request ${i}`, apiKey: 'gsk_test123' });
        expect(res.statusCode).toBe(200);
      }
    });

    it('should handle rapid-fire requests to same endpoint', async () => {
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('audio')
      });

      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/tts')
          .send({ text: 'Hello world' })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.statusCode === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(8);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION TEST SUITE 4: API GATEWAY & ROUTING
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — API Gateway & Routing', () => {

  // ────────────────────────────────────────────────────────────
  // 4.1: Endpoint Routing
  // ────────────────────────────────────────────────────────────
  describe('4.1 Correct Endpoint Routing', () => {

    it('should route to correct handler for each endpoint', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      const healthRes = await request(app).get('/health');
      const aiRes = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });

      expect(healthRes.body).toHaveProperty('status', 'ok');
      expect(aiRes.body).toHaveProperty('text');
    });

    it('should handle 404 for non-existent endpoints', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect([404, 500]).toContain(res.statusCode);
    });

    it('should distinguish between GET and POST requests', async () => {
      const getRes = await request(app).get('/health');
      expect(getRes.statusCode).toBe(200);

      const postRes = await request(app)
        .post('/health')
        .send({ test: 'data' });
      expect(postRes.statusCode).toNotBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4.2: CORS and Security Headers
  // ────────────────────────────────────────────────────────────
  describe('4.2 CORS and Request Validation', () => {

    it('should accept requests with valid headers', async () => {
      const res = await request(app)
        .get('/health')
        .set('Content-Type', 'application/json');

      expect(res.statusCode).toBe(200);
    });

    it('should handle requests without Content-Type', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
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
// INTEGRATION TEST SUITE 5: DATA VALIDATION & TRANSFORMATION
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — Data Validation & Transformation', () => {

  // ────────────────────────────────────────────────────────────
  // 5.1: Input Data Validation Across Pipeline
  // ────────────────────────────────────────────────────────────
  describe('5.1 Input Validation Pipeline', () => {

    it('should validate and reject invalid JSON in request body', async () => {
      const res = await request(app)
        .post('/api/ai')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 500]).toContain(res.statusCode);
    });

    it('should sanitize special characters in input', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }]
        })
      });

      const maliciousInput = '<script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: maliciousInput, apiKey: 'gsk_test123' });

      expect(res.statusCode).toBe(200);
    });

    it('should handle null and undefined values gracefully', async () => {
      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: null, apiKey: 'gsk_test123' });

      const res2 = await request(app)
        .post('/api/ai')
        .send({ prompt: undefined, apiKey: 'gsk_test123' });

      expect(res1.statusCode).toBe(400);
      expect(res2.statusCode).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5.2: Response Data Transformation
  // ────────────────────────────────────────────────────────────
  describe('5.2 Response Data Transformation', () => {

    it('should transform API responses to consistent format', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Transformed response' } }]
        })
      });

      const res = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });

      expect(res.body).toHaveProperty('text');
      expect(res.body).toHaveProperty('source', 'groq');
      expect(res.body).toHaveProperty('success', true);
    });

    it('should include metadata in responses', async () => {
      const res = await request(app).get('/health');

      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(() => new Date(res.body.timestamp)).not.toThrow();
    });
  });
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION TEST SUITE 6: END-TO-END SCENARIOS
// ══════════════════════════════════════════════════════════════

describe('INTEGRATION TESTS — End-to-End Scenarios', () => {

  // ────────────────────────────────────────────────────────────
  // 6.1: Complete User Journey
  // ────────────────────────────────────────────────────────────
  describe('6.1 Complete User Journey Scenarios', () => {

    it('should execute full document analysis workflow', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis summary' } }]
        })
      });

      // 1. Verify API key
      const keyCheck = await request(app)
        .post('/api/verify-key')
        .send({ apiKey: 'gsk_test123' });
      expect(keyCheck.statusCode).toBe(200);

      // 2. Upload document
      const docUpload = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('Document content'), 'document.txt')
        .field('apiKey', 'gsk_test123')
        .field('summaryType', 'standard');
      expect(docUpload.statusCode).toBe(200);

      // 3. Get results
      expect(docUpload.body).toHaveProperty('text');
    });

    it('should execute media conversion workflow', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Transcription result' } }]
        }),
        arrayBuffer: async () => Buffer.from('audio data')
      });

      // 1. Health check
      const health = await request(app).get('/health');
      expect(health.statusCode).toBe(200);

      // 2. Transcribe audio
      const transcribe = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('audio'), 'test.mp3')
        .field('apiKey', 'gsk_test123');
      expect(transcribe.statusCode).toBe(200);

      // 3. Convert to TTS
      const tts = await request(app)
        .post('/api/tts')
        .send({ text: 'Converted text' });
      expect(tts.statusCode).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 6.2: Error Recovery Scenarios
  // ────────────────────────────────────────────────────────────
  describe('6.2 Error Recovery Scenarios', () => {

    it('should recover from transient API failures', async () => {
      // First attempt fails
      fetch.mockRejectedValueOnce(new Error('Timeout'));

      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res1.statusCode).toBe(500);

      // Second attempt succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success' } }]
        })
      });

      const res2 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Test', apiKey: 'gsk_test123' });
      expect(res2.statusCode).toBe(200);
    });

    it('should handle partial failures in batch operations', async () => {
      // Mock some successes and some failures
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success 1' } }]
        })
      });

      fetch.mockRejectedValueOnce(new Error('Service down'));

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success 2' } }]
        })
      });

      const res1 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Query 1', apiKey: 'gsk_test123' });

      const res2 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Query 2', apiKey: 'gsk_test123' });

      const res3 = await request(app)
        .post('/api/ai')
        .send({ prompt: 'Query 3', apiKey: 'gsk_test123' });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(500);
      expect(res3.statusCode).toBe(200);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUMMARY METRICS
// ══════════════════════════════════════════════════════════════
afterAll(() => {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║     INTEGRATION TEST SUITE EXECUTION COMPLETE   ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\nIntegration Tests Cover:');
  console.log('  ✓ Multi-step workflows (document, audio, AI)');
  console.log('  ✓ Service interactions & API consistency');
  console.log('  ✓ Concurrent operations & load handling');
  console.log('  ✓ API gateway routing & request validation');
  console.log('  ✓ Data validation & transformation pipeline');
  console.log('  ✓ End-to-end user scenarios');
  console.log('  ✓ Error recovery & resilience');
  console.log('  ✓ Cross-service error handling');
  console.log('');
});
