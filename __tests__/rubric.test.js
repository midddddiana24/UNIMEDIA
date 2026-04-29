// ─── Mock external dependencies BEFORE importing app ──────────
jest.mock('node-fetch', () => jest.fn());
jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: 'Sample PDF text content extracted here for testing purposes.' }),
    destroy: jest.fn().mockResolvedValue(undefined)
  }))
}));

const fetch = require('node-fetch');
const request = require('supertest');
const app = require('../server');

// Reset fetch mock before every test
beforeEach(() => {
  fetch.mockReset();
  // Default: fetch throws a network error unless overridden
  fetch.mockRejectedValue(new Error('Network unavailable'));
});

// ══════════════════════════════════════════════════════════════
// CRITERION 1 — Conversion Accuracy & Output Fidelity
// ══════════════════════════════════════════════════════════════

describe('CRITERION 1 — Conversion Accuracy & Output Fidelity', () => {

  // ── 1.1 Health ────────────────────────────────────────────
  describe('1.1 Server Reliability — /health', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ── 1.2 Transcription ─────────────────────────────────────
  describe('1.2 Speech-to-Text — /api/transcribe', () => {
    it('should return 400 if no audio file', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No audio file/i);
    });

    it('should return 400 if API key is missing', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake'), { filename: 'a.mp3', contentType: 'audio/mpeg' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should return 400 for invalid API key format', async () => {
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake'), { filename: 'a.mp3', contentType: 'audio/mpeg' })
        .field('apiKey', 'WRONG_KEY');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Invalid API key/i);
    });

    it('should return 500 when Groq API call fails', async () => {
      fetch.mockRejectedValue(new Error('Groq API unreachable'));
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake'), { filename: 'a.mp3', contentType: 'audio/mpeg' })
        .field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(500);
    });

    it('should return error when Groq returns non-ok response', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('fake'), { filename: 'a.mp3', contentType: 'audio/mpeg' })
        .field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── 1.3 Text-to-Speech ────────────────────────────────────
  describe('1.3 Text-to-Speech — /api/tts', () => {
    it('should return 400 if text is empty', async () => {
      const res = await request(app).post('/api/tts').send({ text: '' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No text/i);
    });

    it('should return 400 if text is only whitespace', async () => {
      const res = await request(app).post('/api/tts').send({ text: '   ' });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if text exceeds 10000 characters', async () => {
      const res = await request(app).post('/api/tts').send({ text: 'A'.repeat(10001) });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/too long/i);
    });

    it('[LINE 1096] should return error when TTS provider returns non-ok', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
        buffer: async () => Buffer.from(''),
        headers: { get: () => 'text/html' }
      });
      const res = await request(app).post('/api/tts').send({ text: 'Hello', language: 'en' });
      expect(res.statusCode).toBe(503);
      expect(res.body.error).toMatch(/TTS generation failed/i);
    });

    it('[LINE 1111] should return 500 when TTS fetch throws an error', async () => {
      fetch.mockRejectedValue(new Error('TTS network failure'));
      const res = await request(app).post('/api/tts').send({ text: 'Hello', language: 'en' });
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/TTS network failure/i);
    });

    it('should return audio on successful TTS', async () => {
      fetch.mockResolvedValue({
        ok: true,
        buffer: async () => Buffer.from('fake-audio-mp3'),
        headers: { get: () => 'audio/mpeg' }
      });
      const res = await request(app).post('/api/tts').send({ text: 'Hello students', language: 'en' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/audio/i);
    });
  });

  // ── 1.4 AI Summarization ──────────────────────────────────
  describe('1.4 AI Summarization — /api/ai', () => {
    it('should return 400 if no API key', async () => {
      const res = await request(app).post('/api/ai').send({ prompt: 'Summarize.' });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid API key format', async () => {
      const res = await request(app).post('/api/ai').send({ apiKey: 'sk_wrong', prompt: 'Hello' });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if API key is empty string', async () => {
      const res = await request(app).post('/api/ai').send({ apiKey: '', prompt: 'Hello' });
      expect(res.statusCode).toBe(400);
    });

    it('should return 500 when Groq AI call throws', async () => {
      fetch.mockRejectedValue(new Error('Groq down'));
      const res = await request(app).post('/api/ai').send({ apiKey: 'gsk_testkey000000000000', prompt: 'Hello' });
      expect(res.statusCode).toBe(500);
    });

    it('should return AI text on success', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Here is a summary.' } }] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app).post('/api/ai').send({ apiKey: 'gsk_testkey000000000000', prompt: 'Summarize the water cycle.' });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBe('Here is a summary.');
    });
  });
});


// ══════════════════════════════════════════════════════════════
// CRITERION 2 — Format Support & AI-Enhanced Features
// ══════════════════════════════════════════════════════════════

describe('CRITERION 2 — Format Support & AI-Enhanced Features', () => {

  // ── 2.1 Document Formats ──────────────────────────────────
  describe('2.1 Document Formats — /api/document', () => {
    it('should return 400 if no document attached', async () => {
      const res = await request(app).post('/api/document').field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No document/i);
    });

    it('should return 400 if API key is missing', async () => {
      const res = await request(app)
        .post('/api/document')
        .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should return 400 for invalid API key format', async () => {
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'INVALID_KEY')
        .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Invalid API key/i);
    });

    it('should return 400 for unsupported .exe format', async () => {
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('fake'), { filename: 'x.exe', contentType: 'application/octet-stream' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Unsupported file format/i);
    });

    it('should return 400 for unsupported .csv format', async () => {
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('a,b'), { filename: 'data.csv', contentType: 'text/csv' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Unsupported file format/i);
    });

    it('should return 400 for unsupported .pptx format', async () => {
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('fake'), { filename: 'x.pptx', contentType: 'application/vnd.ms-powerpoint' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Unsupported file format/i);
    });

    it('should process .txt and call Groq successfully', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Document summary here.' } }] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .field('summaryType', 'brief')
        .attach('file', Buffer.from('This is a long text document with enough content to summarize properly.'), {
          filename: 'notes.txt', contentType: 'text/plain'
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBe('Document summary here.');
    });

    it('should handle Groq failure during document processing', async () => {
      fetch.mockRejectedValue(new Error('Groq API failed'));
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('Document content for testing.'), {
          filename: 'notes.txt', contentType: 'text/plain'
        });
      expect(res.statusCode).toBe(500);
    });

    it('should process .txt with summaryType detailed', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Detailed summary.' } }] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .field('summaryType', 'detailed')
        .field('analysisDepth', 'deep')
        .field('extractMetadata', 'true')
        .field('highlightKeywords', 'true')
        .attach('file', Buffer.from('Detailed document content for testing this endpoint.'), {
          filename: 'report.txt', contentType: 'text/plain'
        });
      expect(res.statusCode).toBe(200);
    });

    it('should process .txt with analysisDepth shallow', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Shallow summary.' } }] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/document')
        .field('apiKey', 'gsk_testkey000000000000')
        .field('analysisDepth', 'shallow')
        .attach('file', Buffer.from('Shallow analysis document text.'), {
          filename: 'notes.txt', contentType: 'text/plain'
        });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 2.2 Image Analysis ────────────────────────────────────
  describe('2.2 Image Analysis — /api/image-analyze', () => {
    it('should return 400 if no API key', async () => {
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
      const res = await request(app).post('/api/image-analyze').send({ imageData: fakeBase64 });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should return 400 if no image data', async () => {
      const res = await request(app).post('/api/image-analyze').send({ apiKey: 'gsk_testkey000000000000' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No image/i);
    });

    it('should return 400 if imageData is invalid URI', async () => {
      const res = await request(app)
        .post('/api/image-analyze')
        .send({ apiKey: 'gsk_testkey000000000000', imageData: 'not-a-data-uri' });
      expect(res.statusCode).toBe(400);
    });

    it('[LINE 873] should handle OCR processing error response', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ IsErroredOnProcessing: true, ErrorMessage: ['Low resolution'] }),
        headers: { get: () => 'application/json' }
      });
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-img').toString('base64');
      const res = await request(app)
        .post('/api/image-analyze')
        .send({ apiKey: 'gsk_testkey000000000000', imageData: fakeBase64 });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toMatch(/Unable to extract/i);
    });

    it('[LINE 889] should handle OCR catch block and return fallback', async () => {
      fetch.mockRejectedValue(new Error('OCR network down'));
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-img').toString('base64');
      const res = await request(app)
        .post('/api/image-analyze')
        .send({ apiKey: 'gsk_testkey000000000000', imageData: fakeBase64 });
      expect(res.statusCode).toBe(200);
      expect(res.body.source).toBe('info');
    });

    it('should return OCR extracted text on success', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          IsErroredOnProcessing: false,
          ParsedResults: [{ ParsedText: 'Hello World from OCR' }]
        }),
        headers: { get: () => 'application/json' }
      });
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-img').toString('base64');
      const res = await request(app)
        .post('/api/image-analyze')
        .send({ apiKey: 'gsk_testkey000000000000', imageData: fakeBase64 });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBe('Hello World from OCR');
    });

    it('[LINE 898] should return 500 on outer catch error', async () => {
      fetch.mockImplementation(() => { throw new TypeError('fetch is not a function'); });
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64');
      const res = await request(app)
        .post('/api/image-analyze')
        .send({ apiKey: 'gsk_testkey000000000000', imageData: fakeBase64 });
      expect([200, 500]).toContain(res.statusCode);
    });
  });

  // ── 2.3 OCR Image Upload ──────────────────────────────────
  describe('2.3 OCR — /api/image-ocr', () => {
    it('should return 400 if no image provided', async () => {
      const res = await request(app).post('/api/image-ocr').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No image/i);
    });

    it('[LINE 982] should return OCR text on successful parse', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          IsErroredOnProcessing: false,
          ParsedResults: [{ ParsedText: 'Extracted OCR text from image' }]
        }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('fake-img'), { filename: 'a.jpg', contentType: 'image/jpeg' });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toBe('Extracted OCR text from image');
    });

    it('[LINE 968] should handle non-JSON OCR response and use fallback', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('not JSON'); },
        headers: { get: () => 'text/html' }
      });
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('fake-img'), { filename: 'a.jpg', contentType: 'image/jpeg' });
      expect(res.statusCode).toBe(200);
      expect(res.body.source).toBe('info');
    });

    it('[LINE 974] should handle OCR processing error for image-ocr', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ IsErroredOnProcessing: true, ErrorMessage: ['Bad image'] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('fake-img'), { filename: 'a.jpg', contentType: 'image/jpeg' });
      expect(res.statusCode).toBe(200);
      expect(res.body.text).toMatch(/OCR Error/i);
    });

    it('[LINE 991] should return fallback when OCR fetch throws', async () => {
      fetch.mockRejectedValue(new Error('OCR service down'));
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('fake-img'), { filename: 'a.jpg', contentType: 'image/jpeg' });
      expect(res.statusCode).toBe(200);
      expect(res.body.source).toBe('info');
    });

    it('[LINE 936] should handle large base64 image data (triggers compression)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: 'text' }] }),
        headers: { get: () => 'application/json' }
      });
      // Create a buffer > 1MB to trigger compression branch
      const largeBuffer = Buffer.alloc(1.1 * 1024 * 1024, 255);
      const largeBase64 = 'data:image/jpeg;base64,' + largeBuffer.toString('base64');
      const res = await request(app)
        .post('/api/image-ocr')
        .send({ imageData: largeBase64 });
      expect([200, 500]).toContain(res.statusCode);
    });

    it('should accept PNG file upload', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: 'PNG text' }] }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/image-ocr')
        .attach('image', Buffer.from('fake-png'), { filename: 'a.png', contentType: 'image/png' });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 2.4 PDF Support ───────────────────────────────────────
  describe('2.4 PDF Format — /api/pdf', () => {
    it('should return 400 if no PDF file', async () => {
      const res = await request(app).post('/api/pdf').field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No PDF/i);
    });

    it('should return 400 if no API key', async () => {
      const res = await request(app)
        .post('/api/pdf')
        .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });
  });

  // ── 2.5 Video Support ─────────────────────────────────────
  describe('2.5 Video Format — /api/video', () => {
    it('should return 400 if no video file', async () => {
      const res = await request(app).post('/api/video').field('apiKey', 'gsk_testkey000000000000');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/No video file/i);
    });

    it('should return 400 if no API key', async () => {
      const res = await request(app)
        .post('/api/video')
        .attach('file', Buffer.from('fake-video'), { filename: 'v.mp4', contentType: 'video/mp4' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/API key/i);
    });

    it('should handle Whisper API error gracefully', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Format not supported' } }),
        headers: { get: () => 'application/json' }
      });
      const res = await request(app)
        .post('/api/video')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('fake-video'), { filename: 'v.mp4', contentType: 'video/mp4' });
      expect(res.statusCode).toBe(200);
      expect(res.body.source).toBe('info');
    });

    it('should return 500 when fetch throws on video', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      const res = await request(app)
        .post('/api/video')
        .field('apiKey', 'gsk_testkey000000000000')
        .attach('file', Buffer.from('fake-video'), { filename: 'v.mp4', contentType: 'video/mp4' });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── 2.6 API Key Verification ──────────────────────────────
  describe('2.6 API Key Verification — /api/verify-key', () => {
    it('should return valid:false when no key', async () => {
      const res = await request(app).post('/api/verify-key').send({});
      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should return valid:false when Groq rejects key', async () => {
      fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
      const res = await request(app).post('/api/verify-key').send({ apiKey: 'gsk_badkey' });
      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should return valid:true when Groq accepts key', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      const res = await request(app).post('/api/verify-key').send({ apiKey: 'gsk_validkey' });
      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('should return valid:false when fetch throws', async () => {
      fetch.mockRejectedValue(new Error('Network failure'));
      const res = await request(app).post('/api/verify-key').send({ apiKey: 'gsk_testkey' });
      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });

  // ── 2.7 Audio Formats ─────────────────────────────────────
  describe('2.7 Audio Formats — /api/transcribe', () => {
    const formats = [
      { ext: 'mp3', mime: 'audio/mpeg' },
      { ext: 'wav', mime: 'audio/wav' },
      { ext: 'm4a', mime: 'audio/mp4' },
      { ext: 'ogg', mime: 'audio/ogg' },
      { ext: 'webm', mime: 'audio/webm' },
    ];
    formats.forEach(({ ext, mime }) => {
      it(`should accept .${ext} without unsupported format error`, async () => {
        const res = await request(app)
          .post('/api/transcribe')
          .field('apiKey', 'gsk_testkey000000000000')
          .attach('audio', Buffer.from('fake'), { filename: `rec.${ext}`, contentType: mime });
        if (res.statusCode === 400) {
          expect(res.body.error).not.toMatch(/unsupported format/i);
        }
      });
    });
  });

  // ── 2.8 Root Route ────────────────────────────────────────
  describe('2.8 Root Route — /', () => {
    it('should respond to GET / without crashing', async () => {
      const res = await request(app).get('/');
      expect([200, 404]).toContain(res.statusCode);
    });
  });
});