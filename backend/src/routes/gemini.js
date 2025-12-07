// src/routes/gemini.js - UPDATED with correct Gemini model names
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Check if Gemini API key is available
// At the top of gemini.js, replace the genAI initialization:

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;

if (GEMINI_API_KEY) {
  try {
    // Try v1beta first (most common)
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini initialized with default API');
  } catch (error) {
    console.log('❌ Default init failed:', error.message);
    
    // Try with explicit configuration
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY, {
        apiVersion: 'v1beta'
      });
      console.log('✅ Gemini initialized with v1beta');
    } catch (error2) {
      console.log('❌ v1beta init failed:', error2.message);
      
      // Try v1alpha
      try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY, {
          apiVersion: 'v1alpha'
        });
        console.log('✅ Gemini initialized with v1alpha');
      } catch (error3) {
        console.log('❌ All initialization attempts failed');
      }
    }
  }
}

// Rate limiting to prevent quota issues
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: {
    success: false,
    error: 'Too many AI requests. Please wait a moment.',
    note: 'Free tier has limited requests per minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Add this endpoint to discover available models
router.get('/discover-models', async (req, res) => {
  try {
    if (!genAI) {
      return res.json({
        success: false,
        error: "Gemini not initialized"
      });
    }

    // Try to list models (if API supports it)
    const testPrompts = [
      "Say 'Model Test 1'",
      "Say 'Model Test 2'",
      "Say 'Model Test 3'"
    ];
    
    const testModels = [
      'gemini-pro',
      'gemini-1.0-pro', 
      'text-bison-001',
      'gemini-1.5-flash'
    ];
    
    const results = [];
    
    for (const modelName of testModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(testPrompts[0]);
        const response = await result.response;
        
        results.push({
          model: modelName,
          status: "WORKING",
          response: response.text().substring(0, 50)
        });
      } catch (error) {
        results.push({
          model: modelName,
          status: "FAILED",
          error: error.message.substring(0, 100)
        });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// LIBRARY-ONLY PROMPT WITH EXACT BOOK CATEGORIES
const libraryPrompt = `
You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

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

IMPORTANT: If user asks to reserve a book, guide them to provide student information.
`;

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

// Try different Gemini models in order - FIXED with common models
async function tryGeminiModels(prompt) {
  // Try ALL possible model names and formats
  const models = [
    // Common models
    'gemini-pro',
    'models/gemini-pro',
    'gemini-1.0-pro',
    'models/gemini-1.0-pro',
    'gemini-1.5-pro',
    'models/gemini-1.5-pro',
    
    // Flash models
    'gemini-1.5-flash',
    'models/gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'models/gemini-1.5-flash-001',
    
    // Legacy/text models
    'text-bison-001',
    'models/text-bison-001',
    'chat-bison-001',
    'models/chat-bison-001',
    
    // Try with different API versions
    'gemini-pro:generateContent',
    'gemini-1.0-pro:generateContent'
  ];
  
  for (const modelName of models) {
    try {
      console.log(`🤖 Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ SUCCESS with model: ${modelName}`);
      return {
        success: true,
        text: text,
        model: modelName
      };
    } catch (error) {
      console.log(`❌ Model ${modelName} failed:`, error.message.substring(0, 100));
      // Continue to next model
    }
  }
  
  return {
    success: false,
    error: 'All Gemini models failed'
  };
}

// POST /api/gemini/chat - Main chat endpoint with fallback
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

    // Check if Gemini API is configured
    if (!genAI) {
      console.log('ℹ️  Gemini API not configured, using fallback');
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "fallback-no-api-key",
        timestamp: new Date().toISOString()
      });
    }

    const fullPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
    
    console.log(`📤 Gemini request: "${message.substring(0, 50)}..."`);
    
    try {
      // Try multiple Gemini models
      const aiResult = await tryGeminiModels(fullPrompt);
      
      if (aiResult.success) {
        console.log(`✅ Gemini response using ${aiResult.model}`);
        
        return res.json({
          success: true,
          response: aiResult.text,
          source: `gemini-${aiResult.model}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // All models failed, use fallback
        throw new Error('All AI models unavailable');
      }
      
    } catch (aiError) {
      console.log('❌ Gemini API failed:', aiError.message);
      
      // Check if it's a quota error
      if (aiError.message.includes('429') || aiError.message.includes('quota') || aiError.message.includes('exceeded')) {
        console.log('⚠️  Gemini quota exceeded, using fallback');
        
        return res.json({
          success: true,
          response: getLibraryFallbackResponse(message),
          source: "fallback-quota-exceeded",
          note: "AI service quota limit reached. Using library assistant mode.",
          timestamp: new Date().toISOString()
        });
      }
      
      // Other AI errors
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "fallback-ai-error",
        note: "AI service temporarily unavailable. Using library assistant.",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ General error in /chat:', error);
    
    // Ultimate fallback
    return res.json({
      success: true,
      response: "Welcome to UBLC Library! I'm here to help you with book reservations, library information, and general assistance. How can I help you today?",
      source: "fallback-general",
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
    
    if (!genAI) {
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "library-fallback",
        timestamp: new Date().toISOString()
      });
    }

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-pro"  // Updated to common model
      });
      
      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const text = response.text();

      res.json({
        success: true,
        response: text,
        source: "gemini-library",
        timestamp: new Date().toISOString()
      });

    } catch (aiError) {
      console.log('Library AI failed:', aiError.message);
      
      res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: "library-fallback",
        note: "AI service limited",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error in /chat/library:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process library request',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/gemini/models - List available models
router.get('/models', async (req, res) => {
  try {
    const models = {
      available: [
        { name: "gemini-pro", description: "Most common free tier model" },
        { name: "gemini-1.0-pro", description: "Legacy pro model" },
        { name: "models/gemini-pro", description: "Alternative format" }
      ],
      recommended: "gemini-pro",
      status: genAI ? "configured" : "not-configured",
      note: "Free tier has rate limits. Fallback responses available."
    };
    
    res.json({
      success: true,
      ...models,
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

// GET /api/gemini/status - Check Gemini API status
router.get('/status', async (req, res) => {
  try {
    const status = {
      gemini_configured: !!genAI,
      api_key_present: !!process.env.GEMINI_API_KEY,
      rate_limiting: "5 requests/minute",
      fallback_enabled: true,
      available_endpoints: [
        "POST /api/gemini/chat",
        "POST /api/gemini/chat/library", 
        "GET /api/gemini/models",
        "GET /api/gemini/status"
      ],
      timestamp: new Date().toISOString()
    };
    
    // Test Gemini if configured
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const testPrompt = "Say 'OK' if working";
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        
        status.gemini_test = "working";
        status.test_response = response.text().substring(0, 50);
      } catch (testError) {
        status.gemini_test = "failed";
        status.test_error = testError.message.substring(0, 100);
      }
    }
    
    res.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add this debug endpoint
router.get('/test-api', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const keyExists = !!key;
    const keyLength = key ? key.length : 0;
    
    if (!keyExists) {
      return res.json({
        success: false,
        error: "API key not found in environment"
      });
    }

    // Test the API key directly
    const testAI = new GoogleGenerativeAI(key);
    const model = testAI.getGenerativeModel({ model: "gemini-pro" });
    
    try {
      const result = await model.generateContent("Say 'TEST OK'");
      const response = await result.response;
      const text = response.text();
      
      res.json({
        success: true,
        message: "Gemini API is WORKING!",
        response: text,
        key_length: keyLength,
        key_preview: key.substring(0, 15) + "...",
        model: "gemini-pro"
      });
    } catch (aiError) {
      res.json({
        success: false,
        error: "Gemini API call failed",
        details: aiError.message,
        key_length: keyLength,
        key_preview: key.substring(0, 15) + "...",
        suggestion: "Check: 1) API key validity 2) Quota 3) API enabled in Google Cloud"
      });
    }
    
  } catch (error) {
    res.json({
      success: false,
      error: "Debug error",
      details: error.message
    });
  }
});

module.exports = router;