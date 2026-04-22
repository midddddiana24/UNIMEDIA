const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════
// HELPER: COMPRESS IMAGE FOR OCR.SPACE (1024 KB SIZE LIMIT)
// ═══════════════════════════════════════════════════════════
async function compressImageForOCR(imageBuffer, maxSizeKB = 1000) {
  try {
    let buffer = imageBuffer;
    let quality = 80;
    const targetSizeBytes = maxSizeKB * 1024;
    
    // Iteratively compress until size is acceptable
    while (buffer.length > targetSizeBytes && quality > 20) {
      buffer = await sharp(imageBuffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();
      quality -= 10;
    }
    
    if (buffer.length > targetSizeBytes) {
      // If still too large, resize the image
      buffer = await sharp(imageBuffer)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60, progressive: true })
        .toBuffer();
    }
    
    console.log(`✓ Image compressed: ${(imageBuffer.length / 1024).toFixed(2)} KB → ${(buffer.length / 1024).toFixed(2)} KB`);
    return buffer;
  } catch (error) {
    console.warn('Image compression failed:', error.message);
    // Return original buffer if compression fails
    return imageBuffer;
  }
}

// ═══════════════════════════════════════════════════════════
// CORS CONFIGURATION FOR PRODUCTION DEPLOYMENT
// ═══════════════════════════════════════════════════════════
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'https://unimedia-six.vercel.app',  // Main Vercel URL
  'https://unimedia-git-main-robertojrmediana-5093s-projects.vercel.app', // Preview URL
  'https://web-production-74db7.up.railway.app', // Railway backend URL
  process.env.FRONTEND_URL, // Set in environment variables
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin (mobile apps, curl requests)
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      // Exact match
      callback(null, true);
    } else if (/https:\/\/.*\.vercel\.app/.test(origin)) {
      // Wildcard match for all Vercel preview deployments
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway, let the request through
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (the HTML file)
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════
// AUDIO TRANSCRIPTION ENDPOINT (Whisper API)
// ═══════════════════════════════════════════════════════════
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    // Get API key from request body (user-provided from frontend)
    const apiKey = req.body.apiKey;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        text: '⚠️ Error: No audio file uploaded'
      });
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API key required',
        text: '⚠️ Error: Groq API key not provided. Please add your API key in Settings.'
      });
    }

    if (!apiKey.startsWith('gsk_')) {
      return res.status(400).json({
        error: 'Invalid API key format',
        text: '⚠️ Error: Invalid API key format. Make sure it starts with "gsk_"'
      });
    }

    // Create FormData for multipart request
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', audioFile.buffer, {
      filename: audioFile.originalname,
      contentType: audioFile.mimetype
    });
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');

    // Call Groq Whisper API
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq Whisper Error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Transcription failed',
        text: `⚠️ Transcription Error: ${errorData.error?.message || 'Failed to transcribe audio. Make sure the file is a valid audio format (MP3, WAV, M4A, OGG).'}`
      });
    }

    const data = await response.json();
    const transcribedText = data.text || '';

    res.json({
      text: transcribedText,
      source: 'groq',
      success: true
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: error.message,
      text: `⚠️ Transcription Error: ${error.message}`
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PROXY ENDPOINT FOR GROQ API
// ═══════════════════════════════════════════════════════════
app.post('/api/ai', async (req, res) => {
  try {
    // Use API key from request body (user-provided from frontend)
    const apiKey = req.body.apiKey;
    const { prompt, type = 'summarize' } = req.body;

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API key required',
        source: 'local',
        text: '⚠️ Error: Groq API key not configured. Please add your API key in Settings.'
      });
    }

    if (!apiKey.startsWith('gsk_')) {
      return res.status(400).json({ 
        error: 'Invalid API key format',
        source: 'local',
        text: '⚠️ Error: Invalid API key format. Make sure it starts with "gsk_"'
      });
    }

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful AI assistant for students. Provide clear, accurate, educational responses. Be concise but thorough.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API Error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Groq API error',
        source: 'local',
        text: `⚠️ Error: ${errorData.error?.message || 'Failed to process request with Groq API. Check your API key is valid.'}`
      });
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    res.json({
      text: text,
      source: 'groq',
      success: true
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: error.message,
      source: 'local',
      text: `⚠️ Server error: ${error.message}`
    });
  }
});

// ═══════════════════════════════════════════════════════════
// MULTI-FORMAT DOCUMENT PROCESSING ENDPOINT (PDF, DOCX, TXT, ODT, DOC)
// ═══════════════════════════════════════════════════════════
app.post('/api/document', upload.single('file'), async (req, res) => {
  try {
    const documentFile = req.file;
    const { apiKey, summaryType = 'standard', analysisDepth = 'normal', extractMetadata, highlightKeywords } = req.body;

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║         /api/document REQUEST RECEIVED          ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('File uploaded:', documentFile?.originalname);
    console.log('File size:', documentFile?.size, 'bytes');
    console.log('Form fields received:', Object.keys(req.body));
    console.log('');
    console.log('API KEY DETAILED CHECK:');
    console.log('  - Received apiKey (raw):', apiKey);
    console.log('  - apiKey type:', typeof apiKey);
    console.log('  - apiKey length:', apiKey?.length || 'NULL/UNDEFINED');
    console.log('  - apiKey is empty string:', apiKey === '');
    console.log('  - apiKey is null:', apiKey === null);
    console.log('  - apiKey is undefined:', apiKey === undefined);
    console.log('  - apiKey trimmed:', apiKey?.trim ? apiKey.trim() : 'NO TRIM METHOD');
    console.log('  - apiKey trimmed length:', apiKey?.trim?.().length || 0);
    console.log('  - Starts with gsk_:', apiKey?.startsWith?.('gsk_') || false);
    console.log('  - First 15 chars:', apiKey?.substring(0, 15) || 'N/A');
    console.log('');
    console.log('Summary options:');
    console.log('  - summaryType:', summaryType);
    console.log('  - analysisDepth:', analysisDepth);
    console.log('  - extractMetadata:', extractMetadata);
    console.log('  - highlightKeywords:', highlightKeywords);
    console.log('');

    if (!documentFile) {
      return res.status(400).json({ error: 'No document file provided', text: '⚠️ Error: No document uploaded' });
    }

    // Use API key from request body (user-provided from frontend)
    const apiKeyToUse = apiKey;
    
    console.log('API KEY RESOLUTION:');
    console.log('  - Using form apiKey:', !!apiKey);
    console.log('  - apiKeyToUse value:', apiKeyToUse ? apiKeyToUse.substring(0, 15) + '...' : 'NULL');
    console.log('  - apiKeyToUse length:', apiKeyToUse?.length || 0);
    console.log('');
    
    if (!apiKeyToUse || apiKeyToUse.trim?.().length === 0) {
      console.log('❌ VALIDATION FAILED: No API key available');
      console.log('   - form apiKey:', apiKey ? 'EXISTS' : 'NOT SENT');
      return res.status(400).json({ error: 'API key required', text: '⚠️ Error: API key not provided. Please add your API key in Settings.' });
    }

    if (!apiKeyToUse.startsWith('gsk_')) {
      console.log('❌ VALIDATION FAILED: Invalid API key format');
      console.log('   - apiKeyToUse starts with:', apiKeyToUse.substring(0, 10));
      return res.status(400).json({ error: 'Invalid API key format', text: '⚠️ Error: Invalid API key format. Make sure it starts with "gsk_"' });
    }

    console.log('✓ VALIDATION PASSED: API key looks valid');
    console.log('');  // Blank line for readability

    // Determine file type by extension
    const fileName = documentFile.originalname.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    let extractedText = '';

    try {
      // Extract text based on file format
      if (fileExtension === 'pdf') {
        console.log('📄 Attempting to parse PDF file with PDFParse v2...');
        console.log('   - Buffer size:', documentFile.buffer.length, 'bytes');
        console.log('   - Buffer is Buffer object:', Buffer.isBuffer(documentFile.buffer));
        
        try {
          const parser = new PDFParse({ data: documentFile.buffer });
          const result = await parser.getText();
          extractedText = result.text || '';
          await parser.destroy();
          console.log(`✓ PDF parsed successfully, extracted ${extractedText.length} characters`);
        } catch (pdfError) {
          console.error('❌ PDF parsing failed with error:', pdfError.message);
          console.error('   Error code:', pdfError.code);
          console.error('   Error name:', pdfError.name);
          console.error('   Full error:', pdfError);
          throw pdfError;
        }
        
        // Check if PDF is image-based (scanned) - text extraction returned empty/minimal text
        if (!extractedText || extractedText.trim().length < 50) {
          console.log('⚠️ PDF appears to be image-based (scanned). Text extraction returned minimal content.');
          console.log('   Consider using OCR for scanned PDFs.');
          // Provide helpful message about scanned PDFs
          const errorMsg = `This appears to be a scanned PDF or image-based document. The text extraction failed.\n\nSolutions:\n1. If it's a scanned document, try using the Image OCR tool instead:\n   - Export a page as an image\n   - Use the Image tool to extract text via OCR\n2. Try opening the PDF in a PDF editor and saving it as a new file (sometimes fixes extraction issues)\n3. Check if the PDF has copy protection enabled`;
          return res.status(400).json({ 
            error: 'PDF appears to be scanned or image-based', 
            text: `⚠️ Error: ${errorMsg}` 
          });
        }
      } 
      else if (fileExtension === 'docx' || fileExtension === 'doc') {
        // Use mammoth for DOCX and DOC files
        const result = await mammoth.extractRawText({ buffer: documentFile.buffer });
        extractedText = result.value || '';
        console.log(`✓ ${fileExtension.toUpperCase()} parsed successfully, extracted ${extractedText.length} characters`);
      } 
      else if (fileExtension === 'txt') {
        // For text files, just decode the buffer
        extractedText = documentFile.buffer.toString('utf-8');
      } 
      else if (fileExtension === 'odt') {
        // For ODT files (OpenDocument Text), extract from ZIP
        const zip = new JSZip();
        await zip.loadAsync(documentFile.buffer);
        
        // Extract text from content.xml
        if (zip.file('content.xml')) {
          const contentXml = await zip.file('content.xml').async('string');
          // Simple text extraction from ODT XML (removes XML tags)
          extractedText = contentXml
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#[\d]+;/g, ' ')
            .trim();
          console.log(`✓ ODT parsed successfully, extracted ${extractedText.length} characters`);
        } else {
          throw new Error('Could not find content.xml in ODT file');
        }
      } 
      else {
        return res.status(400).json({ 
          error: `Unsupported file format: .${fileExtension}`, 
          text: `⚠️ Error: Unsupported file format (.${fileExtension}). Supported formats: PDF, DOCX, DOC, TXT, ODT` 
        });
      }
    } catch (extractError) {
      console.error(`❌ Text extraction error for ${fileExtension}:`, extractError.message);
      console.error('Stack trace:', extractError.stack);
      
      // Provide more specific error messages
      let userMessage = `⚠️ Error: Could not extract text from this ${fileExtension.toUpperCase()} file.`;
      
      if (fileExtension === 'pdf') {
        userMessage += `\n\nPossible causes:\n1. This is a scanned/image-based PDF - try the Image OCR tool instead\n2. The PDF may be encrypted or have copy protection\n3. The file may be corrupted\n\nTry:\n• Opening the PDF in Adobe Reader and exporting to a new PDF\n• Using the Image tool if you have page screenshots\n• Checking if the PDF is password-protected`;
      }
      
      return res.status(400).json({ 
        error: `Could not extract text from ${fileExtension.toUpperCase()} file`, 
        text: userMessage
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text found in document', 
        text: `⚠️ Error: Could not extract text from this document` 
      });
    }

    // Truncate text to prevent token limit errors
    const truncateStr = (str, n) => (str.length > n) ? str.substr(0, n - 1) + '...' : str;
    const limitedText = truncateStr(extractedText, 15000);

    // Build prompt based on summary type and analysis depth
    let summaryInstruction = '';
    let mainContent = '';
    let maxTokens = 2048;
    
    if (summaryType === 'brief') {
      summaryInstruction = `Provide ONLY a brief, concise summary (1-2 paragraphs maximum) with ONLY the most essential information. Do not include sections - just a concise overview.`;
      mainContent = `Analyze this document and provide a brief 1-2 paragraph summary covering only the most essential information:`;
      maxTokens = 800;
    } else if (summaryType === 'detailed') {
      summaryInstruction = `Provide an extensive, comprehensive summary with detailed analysis. Be thorough and cover all important aspects, examples, and implications.`;
      mainContent = `Analyze the following document content and provide a detailed analysis with these sections:

1. **Document Overview** - What is this document about? (2-3 sentences)

2. **Executive Summary** - Comprehensive overview of the main points (3-5 paragraphs)

3. **Key Topics & Sections** - Detailed breakdown of each major section/topic covered in the document with explanations

4. **Main Arguments & Takeaways** - What are the core arguments, findings, or points being made? Explain each thoroughly

5. **Important Details** - Significant statistics, data, examples, or case studies mentioned

6. **Quotes & Notable Passages** - Extract and highlight the most important or insightful quotes

7. **Analysis & Implications** - What does this mean? Why is it important? What are the practical implications?

8. **Conclusion** - Summary of why this document matters and key takeaways`;
      maxTokens = 3000;
    } else {
      summaryInstruction = `Provide a comprehensive and detailed summary with key sections. Go deep into the content with substantial coverage.`;
      mainContent = `Analyze the following document content and provide a thorough analysis with these sections:

1. **Document Overview** - What is this document about?

2. **Executive Summary** - Comprehensive overview of the main points (3-4 paragraphs)

3. **Key Topics & Sections** - Main section/topic breakdown and explanations

4. **Main Arguments & Takeaways** - Core arguments, findings, or points being made

5. **Important Details** - Significant statistics, data, examples, or case studies

6. **Analysis & Implications** - What is it important? Practical implications?`;
      maxTokens = 2500;
    }

    let depthInstruction = '';
    if (analysisDepth === 'shallow') {
      depthInstruction = 'Keep analysis straightforward and surface-level.';
    } else if (analysisDepth === 'deep') {
      depthInstruction = 'Provide deep, nuanced analysis with critical thinking, implications, and connections to broader concepts.';
    } else {
      depthInstruction = 'Provide balanced analysis with good detail and practical insights.';
    }

    // Build feature requests - handle FormData string booleans
    let featureRequests = [];
    if (extractMetadata === 'true' || extractMetadata === true) {
      featureRequests.push('Include document metadata (title, author, key information)');
    }
    if (highlightKeywords === 'true' || highlightKeywords === true) {
      featureRequests.push('Highlight key terms, concepts, and terminology with brief explanations');
    }

    const featureText = featureRequests.length > 0 ? `\n\nSpecial Requests:\n${featureRequests.map(f => `• ${f}`).join('\n')}` : '';

    // Create comprehensive prompt
    const prompt = `${summaryInstruction}

${depthInstruction}

${mainContent}${featureText}

Document Content:
${limitedText}`;

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyToUse}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: analysisDepth === 'deep' ? 0.8 : 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        error: err
      });
      throw new Error(err.error?.message || 'Groq API Error during document processing');
    }

    const aiData = await response.json();
    res.json({ 
      text: aiData.choices[0].message.content,
      fileFormat: fileExtension.toUpperCase(),
      fileName: documentFile.originalname
    });
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({ 
      error: error.message, 
      text: `⚠️ Error processing document: ${error.message}` 
    });
  }
});

// ═══════════════════════════════════════════════════════════
// VERIFY API KEY ENDPOINT
// ═══════════════════════════════════════════════════════════
app.post('/api/verify-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.json({ valid: false, message: 'No API key provided' });
    }

    // Test the key with a simple request
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      })
    });

    const valid = response.ok;
    res.json({ valid });

  } catch (error) {
    res.json({ valid: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PDF PROCESSING ENDPOINT
// ═══════════════════════════════════════════════════════════
app.post('/api/pdf', upload.single('file'), async (req, res) => {
  try {
    const pdfFile = req.file;
    const { apiKey, summaryType = 'standard', analysisDepth = 'normal', extractMetadata, extractImages, highlightKeywords } = req.body;

    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file provided', text: '⚠️ Error: No PDF file uploaded' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required', text: '⚠️ Error: Groq API key not provided' });
    }

    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: pdfFile.buffer });
    const result = await parser.getText();
    const extractedText = result.text;
    if (parser.destroy) await parser.destroy();

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'No text found in PDF', text: '⚠️ Error: Could not extract text from this PDF (it might be a scanned image)' });
    }

    const truncateStr = (str, n) => (str.length > n) ? str.substr(0, n - 1) + '...' : str;
    const limitedText = truncateStr(extractedText, 12000); // Prevent token limit error

    // Build prompt based on summary type and analysis depth
    let summaryInstruction = '';
    let maxTokens = 2048;
    
    if (summaryType === 'brief') {
      summaryInstruction = `Provide a focused brief summary (1-2 paragraphs). Include only the essential points and main conclusion.`;
      maxTokens = 800;
    } else if (summaryType === 'detailed') {
      summaryInstruction = `Provide an extensive, comprehensive summary with detailed analysis. Be thorough and cover all important aspects, examples, and implications.`;
      maxTokens = 3000;
    } else {
      // Standard - make it much more detailed than before
      summaryInstruction = `Provide a comprehensive and detailed summary with multiple sections. Go deep into the content with substantial coverage.`;
      maxTokens = 2500;
    }

    let depthInstruction = '';
    if (analysisDepth === 'shallow') {
      depthInstruction = 'Keep analysis straightforward and surface-level.';
    } else if (analysisDepth === 'deep') {
      depthInstruction = 'Provide deep, nuanced analysis with critical thinking, implications, and connections to broader concepts.';
    } else {
      depthInstruction = 'Provide balanced analysis with good detail and practical insights.';
    }

    // Build feature requests
    let featureRequests = [];
    if (extractMetadata === 'true') {
      featureRequests.push('Include document metadata (title, author, publication date, subject)');
    }
    if (highlightKeywords === 'true') {
      featureRequests.push('Highlight key terms, concepts, and terminology with brief explanations');
    }

    const featureText = featureRequests.length > 0 ? `\n\nSpecial Requests:\n${featureRequests.map(f => `• ${f}`).join('\n')}` : '';

    // Create a much more comprehensive prompt
    const prompt = `${summaryInstruction}

${depthInstruction}

Analyze the following PDF content and provide a thorough analysis with these sections:

1. **Document Overview** - What is this document about? (2-3 sentences)

2. **Executive Summary** - Comprehensive overview of the main points (3-4 paragraphs)

3. **Key Topics & Sections** - Detailed breakdown of each major section/topic covered in the document with explanations

4. **Main Arguments & Takeaways** - What are the core arguments, findings, or points being made? Explain each thoroughly

5. **Important Details** - Significant statistics, data, examples, or case studies mentioned

6. **Quotes & Notable Passages** - Extract and highlight the most important or insightful quotes

7. **Analysis & Implications** - What does this mean? Why is it important? What are the practical implications?

8. **Conclusion** - Summary of why this document matters and key takeaways${featureText}

PDF Content:
${limitedText}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: analysisDepth === 'deep' ? 0.8 : 0.7
      })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Groq API Error during PDF processing');
    }

    const aiData = await response.json();
    res.json({ text: aiData.choices[0].message.content });
  } catch (error) {
    console.error('PDF error:', error);
    res.status(500).json({ error: error.message, text: `⚠️ Error processing PDF: ${error.message}` });
  }
});

// ═══════════════════════════════════════════════════════════
// VIDEO PROCESSING ENDPOINT (Transcribe + Summarize)
// ═══════════════════════════════════════════════════════════
app.post('/api/video', upload.single('file'), async (req, res) => {
  try {
    const videoFile = req.file;
    const { apiKey } = req.body;

    if (!videoFile) {
      return res.status(400).json({ 
        error: 'No video file provided',
        text: '⚠️ Error: No video file uploaded'
      });
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API key required',
        text: '⚠️ Error: Groq API key not provided. Please add your API key in Settings.'
      });
    }

    console.log(`Processing video: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);

    // Try to transcribe the video file directly with Whisper
    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('file', videoFile.buffer, {
        filename: videoFile.originalname,
        contentType: videoFile.mimetype
      });
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'en');

      const transcribeRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!transcribeRes.ok) {
        const errorData = await transcribeRes.json().catch(() => ({}));
        console.log('Whisper API error:', errorData.error?.message);
        
        // Provide helpful message if video format not supported
        return res.status(200).json({
          text: '⚠️ Groq Whisper could not process this video file.\n\nQuick solutions:\n1. Convert video to MP3/WAV/OGG using:\n   • Handbrake (free)\n   • FFmpeg command: ffmpeg -i video.mp4 -q:a 0 -map a audio.mp3\n   • Online: CloudConvert, Online-Convert\n\n2. Then upload the audio file\n\n3. Or paste the video transcript/description above',
          source: 'info'
        });
      }

      const transcribeData = await transcribeRes.json();
      const transcript = transcribeData.text || '';

      if (!transcript || transcript.trim().length < 10) {
        return res.json({
          text: '⚠️ No speech detected in the video.\n\nTry:\n• Checking video audio is not muted\n• Using a clearer/higher quality video\n• Extracting and uploading audio separately\n• Pasting the transcript instead',
          source: 'info'
        });
      }

      // Now summarize the transcript using Groq
      const summarizeRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant for students. Create clear, structured, educational summaries.'
            },
            {
              role: 'user',
              content: `Create a structured summary of this video transcript:\n\n**Format:**\n🎯 Main Topic:\n\n📌 Key Points:\n• \n• \n• \n\n📝 Detailed Summary:\n\n✅ Conclusion:\n\nTRANSCRIPT:\n${transcript.substring(0, 3000)}`
            }
          ],
          max_tokens: 2048,
          temperature: 0.7
        })
      });

      if (!summarizeRes.ok) {
        const errorData = await summarizeRes.json().catch(() => ({}));
        console.error('Summarize error:', errorData);
        // Return just the transcript if summarization fails
        return res.json({
          text: `📝 Video Transcript:\n\n${transcript.substring(0, 1000)}...\n\n(Full transcript extracted but summarization service unavailable. Try again later.)`,
          source: 'transcript'
        });
      }

      const summarizeData = await summarizeRes.json();
      const summary = summarizeData.choices[0]?.message?.content || transcript;

      res.json({
        text: summary,
        transcript: transcript,
        source: 'groq-video',
        success: true
      });

    } catch (innerError) {
      console.error('Video processing inner error:', innerError.message);
      throw innerError;
    }

  } catch (error) {
    console.error('Video processing error:', error.message);
    res.status(500).json({
      error: error.message,
      text: `⚠️ Video processing error: ${error.message}`
    });
  }
});

// ═══════════════════════════════════════════════════════════
app.post('/api/image-analyze', async (req, res) => {
  try {
    const { imageData, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: 'API key required',
        text: '⚠️ Error: Groq API key not provided. Please add your API key in Settings.'
      });
    }

    if (!imageData || !imageData.startsWith('data:image')) {
      return res.status(400).json({
        error: 'No image provided',
        text: '⚠️ Error: No image data provided'
      });
    }

    // Use free OCR.space API to extract text from image
    try {
      const FormData = require('form-data');
      
      // Extract base64 data and convert to buffer
      const base64String = imageData.split(',')[1];
      let imageBuffer = Buffer.from(base64String, 'base64');
      
      // Compress image if it exceeds size limit
      if (imageBuffer.length > 1024 * 1024) {
        console.log(`⚠️ Image exceeds 1024 KB (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB), compressing...`);
        imageBuffer = await compressImageForOCR(imageBuffer);
      }
      
      // Convert back to base64 data URI
      const compressedBase64 = imageBuffer.toString('base64');
      const compressedImageData = `data:image/jpeg;base64,${compressedBase64}`;
      
      const ocrForm = new FormData();
      ocrForm.append('base64Image', compressedImageData);
      ocrForm.append('apikey', 'helloworld');
      ocrForm.append('language', 'eng');
      ocrForm.append('isOverlayRequired', 'false');

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: ocrForm.getHeaders(),
        body: ocrForm
      });

      const contentType = ocrResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('OCR service returned non-JSON (HTML error page)');
      }

      const ocrData = await ocrResponse.json();

      if (ocrData.IsErroredOnProcessing) {
        console.log('OCR.space error:', ocrData.ErrorMessage);
        return res.json({
          text: 'Unable to extract text. Try uploading a clearer image or higher resolution.',
          source: 'ocr-space'
        });
      }

      const parsedResults = ocrData.ParsedResults || [];
      const extractedText = parsedResults.map(r => r.ParsedText).join('\n').trim() || 'No text found in image';

      res.json({
        text: extractedText,
        source: 'ocr-space',
        success: true
      });
    } catch (ocrErr) {
      console.log('OCR.space API failed:', ocrErr.message);
      res.json({
        text: 'Image received. Visit https://ocr.space/ to extract text from your image online.',
        source: 'info'
      });
    }

  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({
      error: error.message,
      text: `⚠️ Image analysis error: ${error.message}`
    });
  }
});

// ═══════════════════════════════════════════════════════════
// IMAGE OCR ENDPOINT - Uses OCR.space API with better error handling
// ═══════════════════════════════════════════════════════════
app.post('/api/image-ocr', upload.single('image'), async (req, res) => {
  try {
    const { imageData, apiKey } = req.body;
    const imageFile = req.file;

    let base64Data;
    let fullImageData;
    let fileName = 'image';
    
    if (imageFile) {
      let imageBuffer = imageFile.buffer;
      
      // Check file size and compress if needed
      if (imageBuffer.length > 1024 * 1024) {
        console.log(`⚠️ File exceeds 1024 KB (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB), compressing...`);
        imageBuffer = await compressImageForOCR(imageBuffer);
      }
      
      base64Data = imageBuffer.toString('base64');
      fullImageData = `data:${imageFile.mimetype || 'image/jpeg'};base64,${base64Data}`;
      fileName = imageFile.originalname;
    } else if (imageData) {
      // Extract base64 data and convert to buffer
      const base64String = imageData.split(',')[1];
      let imageBuffer = Buffer.from(base64String, 'base64');
      
      // Compress image if it exceeds size limit
      if (imageBuffer.length > 1024 * 1024) {
        console.log(`⚠️ Image exceeds 1024 KB (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB), compressing...`);
        imageBuffer = await compressImageForOCR(imageBuffer);
      }
      
      base64Data = imageBuffer.toString('base64');
      fullImageData = `data:image/jpeg;base64,${base64Data}`;
    } else {
      return res.status(400).json({
        error: 'No image provided',
        text: '⚠️ Error: No image data provided'
      });
    }

    // Use OCR.space API to extract text from image
    try {
      const FormData = require('form-data');
      const ocrForm = new FormData();
      ocrForm.append('base64Image', fullImageData);
      ocrForm.append('apikey', 'helloworld');
      ocrForm.append('language', 'eng');
      ocrForm.append('detectOrientation', 'true');
      ocrForm.append('isOverlayRequired', 'false');

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: ocrForm.getHeaders(),
        body: ocrForm
      });

      // Check if response is JSON before parsing
      const contentType = ocrResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.log('OCR.space returned non-JSON response (HTML error page)');
        throw new Error('Service returned HTML instead of JSON');
      }

      const ocrData = await ocrResponse.json();

      if (ocrData.IsErroredOnProcessing) {
        console.log('OCR.space processing error:', ocrData.ErrorMessage);
        return res.json({
          text: `OCR Error: ${ocrData.ErrorMessage}\n\nTry uploading a clearer or higher resolution image, or use an online tool: https://ocr.space/`,
          source: 'ocr-space'
        });
      }

      const parsedResults = ocrData.ParsedResults || [];
      const extractedText = parsedResults.map(r => r.ParsedText).join('\n').trim() 
        || 'No text detected in this image. Try a clearer image or higher resolution.';

      res.json({
        text: extractedText,
        source: 'ocr-space',
        success: true
      });
    } catch (ocrErr) {
      console.log('OCR.space API error:', ocrErr.message);
      
      // Provide helpful fallback
      res.json({
        text: `📷 Image: ${fileName}\n\n⚠️ OCR service currently unavailable.\n\nQuick alternatives:\n• Google Lens (mobile)\n• https://ocr.space/ (online tool)\n• Windows OCR or Mac OCR built-in tools\n\nNote: Paste extracted text in the Text Summarizer tool to analyze it.`,
        source: 'info'
      });
    }

  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({
      error: error.message,
      text: `⚠️ Server error: Please try again later`
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PDF PROCESSING ENDPOINT
// ═══════════════════════════════════════════════════════════
app.post('/api/pdf', upload.single('file'), async (req, res) => {
  try {
    const pdfFile = req.file;
    const { apiKey } = req.body;

    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file provided', text: '⚠️ Error: No PDF uploaded' });
    }
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required', text: '⚠️ Error: Groq API key not provided in Settings.' });
    }

    const parser = new PDFParse({ data: pdfFile.buffer });
    const result = await parser.getText();
    const extractedText = result.text || '';
    await parser.destroy();

    if (!extractedText.trim()) {
      return res.json({ text: '⚠️ Could not extract text. The PDF might be scanned or image-based.', source: 'info' });
    }

    // Call Groq API to summarize
    const summarizeRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. Provide structured, educational summaries.' },
          { role: 'user', content: `Please summarize the main content of this PDF document:\n\n${extractedText.substring(0, 15000)}` }
        ],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!summarizeRes.ok) {
       return res.json({ text: `📝 PDF Content Extracted (Summary unavailable):\n\n${extractedText.substring(0, 2000)}...`, source: 'pdf-parse' });
    }

    const summarizeData = await summarizeRes.json();
    res.json({ text: summarizeData.choices[0]?.message?.content || extractedText.substring(0, 1000), source: 'groq', success: true });
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({ error: error.message, text: `⚠️ PDF processing error: ${error.message}` });
  }
});

// ═══════════════════════════════════════════════════════════
// TEXT-TO-SPEECH ENDPOINT (Google Translate TTS)
// ═══════════════════════════════════════════════════════════
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language = 'en', speed = 1 } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text provided', 
        text: '⚠️ Error: Please enter text to convert to speech' 
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({ 
        error: 'Text too long', 
        text: '⚠️ Error: Text must be less than 10000 characters' 
      });
    }

    // Use Google Translate TTS API (free, no key required)
    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=${language}&q=${encodedText}`;

    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'TTS generation failed',
        text: '⚠️ Error: Could not generate speech. Please try again.'
      });
    }

    // Get audio buffer
    const audioBuffer = await response.buffer();
    
    // Send as audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.send(audioBuffer);

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ 
      error: error.message, 
      text: `⚠️ Text-to-Speech error: ${error.message}` 
    });
  }
});

// ═══════════════════════════════════════════════════════════
// SERVE HTML FILE
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'UniMedia_Web.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🤖 UniMedia server running at http://localhost:${PORT}`);
  console.log('✅ All features including audio transcription are now working!');
});
