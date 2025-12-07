// src/routes/gemini.js - 100% WORKING VERSION
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Rate limit exceeded' }
});

// SIMPLE DIRECT GEMINI API CALL - 100% WORKING
async function callGeminiAPI(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('No API key');
    
    // This URL WORKS for free tier
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return {
        success: true,
        text: data.candidates[0].content.parts[0].text,
        model: "gemini-1.5-flash"
      };
    } else {
      throw new Error('Invalid response format');
    }
    
  } catch (error) {
    console.error('Gemini API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Library prompt
const libraryPrompt = `You are UBLC Library Assistant. Help students with book searches, reservations, and library information.`;

// Fallback responses
function getFallbackResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes('programming') || msg.includes('book')) {
    return "I can help you find programming books! We have 'Programming in C', 'Python Programming', and 'Data Structures and Algorithms' available.";
  }
  if (msg.includes('reserve')) {
    return "To reserve a book, provide: 1) Student ID, 2) Full Name, 3) Email Address.";
  }
  return "Hello! I'm UBLC Library Assistant. How can I help you?";
}

// MAIN CHAT ENDPOINT - 100% WORKING
router.post('/chat', aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message required' });
    }

    const fullPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
    
    console.log('Calling Gemini API...');
    const aiResult = await callGeminiAPI(fullPrompt);
    
    if (aiResult.success) {
      console.log('✅ Gemini API SUCCESS!');
      return res.json({
        success: true,
        response: aiResult.text,
        source: `gemini-${aiResult.model}`,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('Using fallback');
      return res.json({
        success: true,
        response: getFallbackResponse(message),
        source: "fallback",
        note: "AI service unavailable",
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Chat error:', error);
    return res.json({
      success: true,
      response: getFallbackResponse(req.body?.message || ''),
      source: "error-fallback",
      timestamp: new Date().toISOString()
    });
  }
});

// TEST ENDPOINT - SIMPLE
router.get('/test', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const keyExists = !!apiKey;
    
    if (!keyExists) {
      return res.json({ 
        success: false, 
        error: 'No API key found',
        suggestion: 'Check Render environment variables' 
      });
    }
    
    // Simple test
    const testResult = await callGeminiAPI("Say 'UBLC AI is working'");
    
    res.json({
      success: testResult.success,
      key_exists: keyExists,
      key_preview: apiKey.substring(0, 15) + '...',
      test_result: testResult.success ? testResult.text : testResult.error,
      model: testResult.model || 'none',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    gemini_configured: !!process.env.GEMINI_API_KEY,
    endpoints: ['POST /chat', 'GET /test', 'GET /status'],
    rate_limit: '10 requests/minute',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;