// src/routes/gemini.js - COMPLETE FIX FOR GEMINI AI
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Check if Gemini API key is available
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

// COMPREHENSIVE Gemini model testing with API version variations
async function tryGeminiModels(prompt) {
  // COMPREHENSIVE list of ALL possible Gemini model configurations
  const modelTests = [
    // Most likely working models for free tier with v1beta
    { name: 'gemini-pro', apiVersion: 'v1beta' },
    { name: 'models/gemini-pro', apiVersion: 'v1beta' },
    { name: 'gemini-1.0-pro', apiVersion: 'v1beta' },
    { name: 'models/gemini-1.0-pro', apiVersion: 'v1beta' },
    
    // Try different API versions
    { name: 'gemini-pro', apiVersion: 'v1' },
    { name: 'models/gemini-pro', apiVersion: 'v1' },
    { name: 'gemini-1.0-pro', apiVersion: 'v1' },
    
    // Try without explicit version (default)
    { name: 'gemini-pro', apiVersion: null },
    { name: 'gemini-1.0-pro', apiVersion: null },
    
    // Legacy models
    { name: 'text-bison-001', apiVersion: 'v1beta' },
    { name: 'models/text-bison-001', apiVersion: 'v1beta' },
    { name: 'chat-bison-001', apiVersion: 'v1beta' },
    { name: 'models/chat-bison-001', apiVersion: 'v1beta' },
    
    // Try with v1alpha
    { name: 'gemini-pro', apiVersion: 'v1alpha' },
    { name: 'gemini-1.0-pro', apiVersion: 'v1alpha' },
    
    // Try other model names
    { name: 'gemini-1.5-pro', apiVersion: 'v1beta' },
    { name: 'models/gemini-1.5-pro', apiVersion: 'v1beta' },
    { name: 'gemini-1.5-flash', apiVersion: 'v1beta' },
    { name: 'models/gemini-1.5-flash', apiVersion: 'v1beta' },
  ];

  for (const test of modelTests) {
    try {
      console.log(`🔍 Testing: ${test.name} (${test.apiVersion || 'default'})`);
      
      // Create new instance with specific API version
      const testGenAI = test.apiVersion 
        ? new GoogleGenerativeAI(GEMINI_API_KEY, {
            apiVersion: test.apiVersion
          })
        : new GoogleGenerativeAI(GEMINI_API_KEY);
      
      const model = testGenAI.getGenerativeModel({ model: test.name });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(`🎉 SUCCESS with: ${test.name} (${test.apiVersion || 'default'})`);
      return {
        success: true,
        text: text,
        model: test.name,
        apiVersion: test.apiVersion
      };
    } catch (error) {
      console.log(`❌ Failed ${test.name}:`, error.message.substring(0, 80));
      // Continue to next
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }
  }
  
  return {
    success: false,
    error: 'All model configurations failed'
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
      // Try multiple Gemini models with different configurations
      const aiResult = await tryGeminiModels(fullPrompt);
      
      if (aiResult.success) {
        console.log(`✅ Gemini response using ${aiResult.model} (${aiResult.apiVersion || 'default'})`);
        
        return res.json({
          success: true,
          response: aiResult.text,
          source: `gemini-${aiResult.model}`,
          apiVersion: aiResult.apiVersion,
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
      // Use the comprehensive testing for library endpoint too
      const aiResult = await tryGeminiModels(enhancedPrompt);
      
      if (aiResult.success) {
        res.json({
          success: true,
          response: aiResult.text,
          source: `gemini-library-${aiResult.model}`,
          apiVersion: aiResult.apiVersion,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Library AI failed');
      }

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
        { name: "models/gemini-pro", description: "Alternative format" },
        { name: "text-bison-001", description: "Legacy text model" },
        { name: "chat-bison-001", description: "Legacy chat model" }
      ],
      recommended: "gemini-pro",
      status: genAI ? "configured" : "not-configured",
      api_versions: ["v1beta", "v1", "v1alpha"],
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
        "GET /api/gemini/status",
        "GET /api/gemini/discover-models",
        "GET /api/gemini/test-api"
      ],
      timestamp: new Date().toISOString()
    };
    
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

// Model discovery endpoint
router.get('/discover-models', async (req, res) => {
  try {
    if (!genAI) {
      return res.json({
        success: false,
        error: "Gemini not initialized"
      });
    }

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
        const result = await model.generateContent("Say 'Model Test'");
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

// Emergency test endpoint
router.get('/emergency-test', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.json({ error: "No API key" });
    }

    // Test with v1beta
    const testAI = new GoogleGenerativeAI(key, { apiVersion: 'v1beta' });
    const model = testAI.getGenerativeModel({ model: "gemini-pro" });
    
    const result = await model.generateContent("Hello UBLC Library");
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      message: "🎉 GEMINI AI IS WORKING!",
      response: text,
      key_length: key.length,
      key_preview: key.substring(0, 10) + "...",
      api_version: "v1beta",
      model: "gemini-pro"
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      suggestion: "1. Enable API 2. Check key restrictions 3. Wait 5 minutes 4. Try different API version"
    });
  }
});

// API key test endpoint
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

    // Test with multiple configurations
    const configurations = [
      { version: 'v1beta', model: 'gemini-pro' },
      { version: 'v1', model: 'gemini-pro' },
      { version: null, model: 'gemini-pro' },
      { version: 'v1beta', model: 'text-bison-001' }
    ];
    
    const results = [];
    
    for (const config of configurations) {
      try {
        const testAI = config.version 
          ? new GoogleGenerativeAI(key, { apiVersion: config.version })
          : new GoogleGenerativeAI(key);
        
        const model = testAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent("Test");
        const response = await result.response;
        
        results.push({
          configuration: `${config.model} (${config.version || 'default'})`,
          status: "SUCCESS",
          response: response.text().substring(0, 30)
        });
      } catch (error) {
        results.push({
          configuration: `${config.model} (${config.version || 'default'})`,
          status: "FAILED",
          error: error.message.substring(0, 80)
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    res.json({
      success: true,
      key_exists: keyExists,
      key_length: keyLength,
      key_preview: key ? key.substring(0, 15) + "..." : "N/A",
      test_results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: "Debug error",
      details: error.message
    });
  }
});

module.exports = router;