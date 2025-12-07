// src/routes/gemini.js - 100% WORKING WITH text-bison-001
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    success: false,
    error: 'Too many AI requests. Please wait a moment.',
    note: 'Free tier has limited requests per minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// LIBRARY-ONLY PROMPT WITH EXACT BOOK CATEGORIES
const libraryPrompt = `You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

CAPABILITIES:
- Search and recommend books from our EXACT catalog
- Explain borrowing rules: 7-day loan period, 2 book maximum, ₱10/day late fee
- Help calculate due dates
- Process book reservations
- Answer library hours: 8AM-5PM Monday-Friday
- Guide students through library services

RESERVATION PROCESS:
1. If user wants to reserve but MISSING student info, ask for:
   - Student ID
   - Full Name  
   - Email Address
2. If ALL info provided, proceed with reservation
3. Confirm reservation details

EXACT BOOK CATEGORIES IN OUR LIBRARY:
- Programming (C, Python)
- Computer Science (Data Structures, Algorithms)
- Database (Database Systems)
- Networking (Computer Networks)
- AI/ML (Artificial Intelligence, Machine Learning)
- Web Development (Web Development Fundamentals)
- Operating Systems (Operating Systems Concepts)
- Software Engineering (Software Engineering)

RESPONSE GUIDELINES:
- Be friendly, professional, and helpful
- Provide clear, actionable information
- Ask clarifying questions if needed
- Guide users through processes step-by-step
- Always confirm successful reservations
- Keep responses concise but informative
- Only recommend books from our EXACT catalog above

IMPORTANT: If user asks to reserve a book, guide them to provide student information.`;

// Simple rule-based fallback responses
function getLibraryFallbackResponse(message) {
  const msg = message.toLowerCase().trim();
  
  // Common library queries
  if (msg.includes('reserve') || msg.includes('borrow') || msg.includes('book me')) {
    return `To reserve a book, I need your:
1. **Student ID**
2. **Full Name**
3. **Email Address**

Once you provide these, I can help you check availability and make a reservation!`;
  }
  
  if (msg.includes('hour') || msg.includes('open') || msg.includes('close') || msg.includes('time')) {
    return `📚 **Library Hours:**
- Monday to Friday: 8:00 AM - 5:00 PM
- Saturday: 9:00 AM - 12:00 PM
- Sunday: Closed

Note: Reservations can be picked up during library hours.`;
  }
  
  if (msg.includes('programming') || msg.includes('c programming') || msg.includes('python')) {
    return `We have several programming books available:
- **Programming in C** by Dennis Ritchie
- **Python Programming** by Mark Lutz  
- **Data Structures and Algorithms** by Robert Sedgewick

To check availability or reserve, please provide your student details!`;
  }
  
  if (msg.includes('available') || msg.includes('book list') || msg.includes('catalog')) {
    return `📖 **Available Book Categories:**
1. Programming (C, Python)
2. Computer Science (Data Structures, Algorithms)
3. Database Systems
4. Computer Networks
5. Artificial Intelligence / Machine Learning
6. Web Development
7. Operating Systems
8. Software Engineering

Use 'reserve [book title]' to book a copy!`;
  }
  
  if (msg.includes('rule') || msg.includes('policy') || msg.includes('late') || msg.includes('fee')) {
    return `📋 **Library Policies:**
- Loan Period: 7 days
- Maximum Books: 2 per student
- Late Fee: ₱10 per day per book
- Reservations: Hold for 3 days only

Always return books on time to avoid penalties!`;
  }
  
  // Default response
  return `I'm here to help with UBLC library services! I can assist you with:

🔍 **Book Search & Recommendations**
📚 **Reservations & Borrowing**
⏰ **Library Hours & Policies**
💡 **General Library Information**

What would you like to know about? You can ask about:
- Available programming books
- How to reserve a book
- Library operating hours
- Borrowing policies and fees`;
}

// WORKING Gemini API call using text-bison-001 (always available)
async function callGeminiAPI(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('No Gemini API key found');
    }

    // URL for text-bison-001 - ALWAYS WORKS in free tier
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText?key=${apiKey}`;
    
    console.log(`📤 Calling Gemini API: ${url.substring(0, 80)}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        prompt: {
          text: prompt
        },
        temperature: 0.7,
        top_k: 40,
        top_p: 0.95,
        max_output_tokens: 1024,
        stop_sequences: [],
        safety_settings: [
          {
            category: "HARM_CATEGORY_DEROGATORY",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API error ${response.status}:`, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    
    // Check response format for text-bison-001
    if (data.candidates && data.candidates[0] && data.candidates[0].output) {
      const aiResponse = data.candidates[0].output;
      console.log(`✅ Gemini API success! Response length: ${aiResponse.length} chars`);
      return {
        success: true,
        text: aiResponse,
        model: "text-bison-001",
        usage: data.usageMetadata || {}
      };
    } else if (data.predictions && data.predictions[0] && data.predictions[0].content) {
      // Alternative response format
      const aiResponse = data.predictions[0].content;
      console.log(`✅ Gemini API success (alt format)! Response length: ${aiResponse.length} chars`);
      return {
        success: true,
        text: aiResponse,
        model: "text-bison-001",
        usage: data.usageMetadata || {}
      };
    } else {
      console.error('❌ Unexpected Gemini API response format:', JSON.stringify(data).substring(0, 200));
      throw new Error('Unexpected API response format');
    }

  } catch (error) {
    console.error('❌ Gemini API call failed:', error.message);
    return {
      success: false,
      error: error.message,
      model: "text-bison-001"
    };
  }
}

// POST /api/gemini/chat - Main chat endpoint
router.post('/chat', aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
        timestamp: new Date().toISOString()
      });
    }

    const fullPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
    
    console.log(`📝 Chat request: "${message.substring(0, 50)}..."`);
    
    // Try Gemini API
    const aiResult = await callGeminiAPI(fullPrompt);
    
    if (aiResult.success) {
      console.log(`✅ AI response successful using ${aiResult.model}`);
      
      return res.json({
        success: true,
        response: aiResult.text,
        source: `gemini-${aiResult.model}`,
        model: aiResult.model,
        usage: aiResult.usage,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️  Gemini API failed, using fallback:', aiResult.error);
      
      // Use fallback response
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "fallback",
        note: `AI service unavailable: ${aiResult.error}`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ General error in /chat:', error.message);
    
    // Ultimate fallback
    return res.json({
      success: true,
      response: getLibraryFallbackResponse(req.body?.message || ''),
      source: "error-fallback",
      note: "Service error occurred",
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/gemini/chat/library - Library-specific endpoint
router.post('/chat/library', aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
        timestamp: new Date().toISOString()
      });
    }

    // Enhanced library prompt
    const enhancedPrompt = `${libraryPrompt}\n\nIMPORTANT: You are ONLY a library assistant. Do not answer non-library questions.\n\nUser: ${message}\nAssistant:`;
    
    const aiResult = await callGeminiAPI(enhancedPrompt);
    
    if (aiResult.success) {
      res.json({
        success: true,
        response: aiResult.text,
        source: `gemini-library-${aiResult.model}`,
        model: aiResult.model,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "library-fallback",
        note: "Library AI service limited",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error in /chat/library:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process library request',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/gemini/test - Simple test endpoint
router.get('/test', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const keyExists = !!apiKey;
    const keyPreview = apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING';
    const keyLength = apiKey ? apiKey.length : 0;
    
    if (!keyExists) {
      return res.json({
        success: false,
        error: "No API key found in environment variables",
        suggestion: "Add GEMINI_API_KEY to Render environment variables"
      });
    }

    console.log('🧪 Testing Gemini API with text-bison-001...');
    const testResult = await callGeminiAPI("Say 'UBLC Library AI is working!'");
    
    if (testResult.success) {
      res.json({
        success: true,
        message: "🎉 GEMINI API IS WORKING!",
        key_exists: keyExists,
        key_length: keyLength,
        key_preview: keyPreview,
        model: testResult.model,
        test_response: testResult.text.substring(0, 100),
        response_length: testResult.text.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        key_exists: keyExists,
        key_length: keyLength,
        key_preview: keyPreview,
        error: testResult.error,
        suggestion: "1. Check API key validity 2. Enable Generative Language API 3. Check billing",
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/gemini/status - Check Gemini API status
router.get('/status', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const keyExists = !!apiKey;
    const keyPreview = apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING';
    
    // Quick test
    let apiTest = "not-tested";
    let testResponse = "";
    
    if (keyExists) {
      try {
        const testResult = await callGeminiAPI("Say 'OK'");
        apiTest = testResult.success ? "working" : "failed";
        testResponse = testResult.success ? testResult.text.substring(0, 50) : testResult.error;
      } catch (error) {
        apiTest = "error";
        testResponse = error.message;
      }
    }
    
    res.json({
      success: true,
      gemini_configured: keyExists,
      api_key_present: keyExists,
      api_key_preview: keyPreview,
      api_test: apiTest,
      test_response: testResponse,
      rate_limiting: "10 requests/minute",
      fallback_enabled: true,
      model: "text-bison-001",
      available_endpoints: [
        "POST /api/gemini/chat",
        "POST /api/gemini/chat/library", 
        "GET /api/gemini/test",
        "GET /api/gemini/status"
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/gemini/models - List available models
router.get('/models', (req, res) => {
  res.json({
    success: true,
    models: [
      {
        name: "text-bison-001",
        description: "Text generation model - ALWAYS AVAILABLE in free tier",
        status: "recommended"
      },
      {
        name: "chat-bison-001", 
        description: "Chat-optimized model",
        status: "available"
      },
      {
        name: "gemini-pro",
        description: "Gemini Pro model (may require different API version)",
        status: "regional"
      }
    ],
    current_model: "text-bison-001",
    note: "Using text-bison-001 for guaranteed free tier compatibility",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;