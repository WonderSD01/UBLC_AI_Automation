// src/routes/huggingface.js - COMPLETE FREE AI CHATBOT
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting - more requests with token
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute with token
  message: {
    success: false,
    error: 'Too many AI requests. Please wait a moment.',
    note: 'Rate limit exceeded. Free tier allows 30 requests/minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Your Hugging Face Token (from environment variable)
const HF_TOKEN = process.env.HF_TOKEN;
const HAS_TOKEN = !!HF_TOKEN;

console.log(`🔧 Hugging Face configured: ${HAS_TOKEN ? 'WITH TOKEN' : 'PUBLIC ACCESS'}`);

// Models that work well for chat (prioritized)
const CHAT_MODELS = [
  {
    name: 'microsoft/DialoGPT-medium',
    url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
    type: 'dialog',
    description: 'Best for conversational chat'
  },
  {
    name: 'microsoft/DialoGPT-small',
    url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-small',
    type: 'dialog',
    description: 'Lightweight chat model'
  },
  {
    name: 'google/flan-t5-base',
    url: 'https://api-inference.huggingface.co/models/google/flan-t5-base',
    type: 'instruction',
    description: 'Good for following instructions'
  },
  {
    name: 'distilgpt2',
    url: 'https://api-inference.huggingface.co/models/distilgpt2',
    type: 'text',
    description: 'Fast text generation'
  }
];

// LIBRARY SYSTEM PROMPT
const LIBRARY_SYSTEM_PROMPT = `You are UBLC Library Assistant for University of Batangas Lipa Campus.

YOUR ROLE:
- Help students find books in the library
- Explain borrowing rules and policies
- Assist with book reservations
- Provide library hours and information
- Be friendly, professional, and helpful

LIBRARY INFORMATION:
- Hours: Mon-Fri 8AM-5PM, Sat 9AM-12PM, Sun Closed
- Loan Period: 7 days
- Max Books: 2 per student
- Late Fee: ₱10 per day
- Reservation Hold: 3 days

RESERVATION PROCESS:
1. Student provides: ID, Name, Email
2. Check book availability
3. Confirm reservation details
4. Send email confirmation

BOOK CATEGORIES AVAILABLE:
- Programming (C, Python, Java)
- Computer Science (Data Structures, Algorithms)
- Database Systems
- Networking
- AI/ML
- Web Development
- Operating Systems
- Software Engineering

RESPONSE STYLE:
- Be concise but informative
- Ask clarifying questions if needed
- Guide step-by-step through processes
- Always confirm successful actions`;

// Fallback responses when AI fails
function getLibraryFallbackResponse(message) {
  const msg = message.toLowerCase().trim();
  
  if (msg.includes('programming') || msg.includes('c programming') || msg.includes('python') || msg.includes('java')) {
    return `We have several programming books available:
    
📚 **Programming Books:**
- **Programming in C** by Dennis Ritchie (4 copies available)
- **Python Programming** by Mark Lutz (3 copies available)  
- **Data Structures and Algorithms** by Robert Sedgewick (2 copies available)
- **Database Systems** by Hector Garcia-Molina (3 copies available)

📍 Location: 2nd Floor, Section A
📅 Loan Period: 7 days
💵 Late Fee: ₱10/day

Would you like to reserve any of these books?`;
  }
  
  if (msg.includes('reserve') || msg.includes('borrow') || msg.includes('check out') || msg.includes('book me')) {
    return `I can help you reserve a book! 📖

To make a reservation, I need:
1. **Student ID** (e.g., 2220122)
2. **Full Name** (e.g., Maria Santos)
3. **Email Address** (e.g., 2220122@ub.edu.ph)

Once you provide these, I can:
- Check real-time availability
- Reserve the book for 3 days
- Send email confirmation
- Update our library system automatically

What book would you like to reserve?`;
  }
  
  if (msg.includes('hour') || msg.includes('open') || msg.includes('close') || msg.includes('time')) {
    return `🏛️ **UBLC Library Hours:**
    
**Regular Hours:**
- Monday to Friday: 8:00 AM - 5:00 PM
- Saturday: 9:00 AM - 12:00 PM  
- Sunday: Closed

**Holiday Schedule:**
- University holidays: Closed
- Exam periods: Extended hours may apply

**Services Available:**
- Book borrowing & returns
- Computer access stations
- Study areas
- Research assistance
- Reservation pickups

Reservations can be picked up during library hours.`;
  }
  
  if (msg.includes('rule') || msg.includes('policy') || msg.includes('late') || msg.includes('fee')) {
    return `📋 **Library Policies & Rules:**
    
**Borrowing Rules:**
- Loan Period: 7 days per book
- Maximum Books: 2 per student at a time
- Renewals: 1 renewal allowed if no waitlist
- Reservations: Held for 3 business days

**Fees & Penalties:**
- Late Fee: ₱10 per day per book
- Lost Books: Replacement cost + ₱500 processing fee
- Damaged Books: Repair/replacement cost

**General Rules:**
- Student ID required for all transactions
- No food or drinks in book areas
- Silence must be observed in study areas
- Return books to designated drop boxes after hours`;
  }
  
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('what can you do')) {
    return `👋 **Hello! I'm UBLC Library Assistant**

I can help you with:
🔍 **Book Search** - Find available books by title, author, or category
📚 **Reservations** - Reserve books with automatic email confirmation  
⏰ **Library Info** - Hours, policies, fees, and services
💡 **General Help** - Answer questions about library procedures

**Try asking me:**
- "What programming books are available?"
- "How do I reserve a book?"
- "What are the library hours?"
- "What are the late fees?"

How can I assist you today?`;
  }
  
  // Default response
  return `I'm here to help with UBLC library services!

This AI assistant demonstrates:
🤖 **AI Integration** - Natural language understanding
📊 **Real-time Data** - Connected to live Google Sheets  
✅ **Automation** - Reservation processing with email
🚀 **Deployment** - Live on Render with CI/CD
📈 **Analytics** - Usage tracking and monitoring

You can ask me about available books, make reservations, check library hours, or learn about borrowing policies.

How can I help you today?`;
}

// Call Hugging Face Inference API
async function callHuggingFace(prompt, modelIndex = 0) {
  try {
    if (modelIndex >= CHAT_MODELS.length) {
      throw new Error('All models failed');
    }
    
    const model = CHAT_MODELS[modelIndex];
    console.log(`🤖 Trying model ${modelIndex + 1}/${CHAT_MODELS.length}: ${model.name}`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add authorization if token available
    if (HF_TOKEN) {
      headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    }
    
    // Prepare request based on model type
    let requestBody;
    const maxLength = 200;
    
    switch (model.type) {
      case 'dialog':
        requestBody = {
          inputs: {
            text: prompt,
            past_user_inputs: [],
            generated_responses: []
          },
          parameters: {
            max_length: maxLength,
            temperature: 0.8,
            top_p: 0.95
          }
        };
        break;
        
      case 'instruction':
        requestBody = {
          inputs: `Library question: ${prompt}\nAssistant response:`,
          parameters: {
            max_length: maxLength,
            temperature: 0.7,
            do_sample: true
          }
        };
        break;
        
      default: // text generation
        requestBody = {
          inputs: prompt,
          parameters: {
            max_new_tokens: maxLength,
            temperature: 0.8,
            top_k: 50,
            top_p: 0.95,
            do_sample: true,
            return_full_text: false
          }
        };
    }
    
    // Make API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(model.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response statuses
    if (response.status === 429) {
      console.log(`⚠️ Rate limit for ${model.name}, trying next model...`);
      return callHuggingFace(prompt, modelIndex + 1);
    }
    
    if (response.status === 503) {
      console.log(`🔄 Model ${model.name} is loading, trying next...`);
      return callHuggingFace(prompt, modelIndex + 1);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`❌ ${model.name} error ${response.status}:`, errorText.substring(0, 100));
      
      // Try next model
      if (modelIndex + 1 < CHAT_MODELS.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        return callHuggingFace(prompt, modelIndex + 1);
      }
      throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    
    // Parse response based on model type
    let aiResponse = '';
    
    if (model.type === 'dialog' && data.generated_text) {
      aiResponse = data.generated_text;
    } else if (Array.isArray(data) && data[0] && data[0].generated_text) {
      aiResponse = data[0].generated_text;
    } else if (data[0] && data[0].generated_text) {
      aiResponse = data[0].generated_text;
    } else if (data.generated_text) {
      aiResponse = data.generated_text;
    } else if (typeof data === 'string') {
      aiResponse = data;
    } else {
      aiResponse = JSON.stringify(data).substring(0, 200);
    }
    
    // Clean up response
    aiResponse = aiResponse
      .replace(/Library question:/g, '')
      .replace(/Assistant response:/g, '')
      .replace(/^[^a-zA-Z0-9"'\(\)]+/, '') // Remove leading non-alphanumeric
      .replace(/[^a-zA-Z0-9\s.,!?'"\(\):-]+$/g, '') // Remove trailing garbage
      .trim();
    
    // Ensure response is reasonable
    if (!aiResponse || aiResponse.length < 10 || aiResponse.length > 1000) {
      console.log(`⚠️ Invalid response from ${model.name}: "${aiResponse.substring(0, 50)}"`);
      if (modelIndex + 1 < CHAT_MODELS.length) {
        return callHuggingFace(prompt, modelIndex + 1);
      }
      throw new Error('Invalid AI response');
    }
    
    console.log(`✅ ${model.name} success: ${aiResponse.substring(0, 60)}...`);
    
    return {
      success: true,
      text: aiResponse,
      model: model.name,
      model_type: model.type,
      provider: 'huggingface',
      used_token: HAS_TOKEN
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`⏰ Timeout for model ${modelIndex}`);
      if (modelIndex + 1 < CHAT_MODELS.length) {
        return callHuggingFace(prompt, modelIndex + 1);
      }
    }
    
    console.error(`❌ Hugging Face error:`, error.message);
    return {
      success: false,
      error: error.message,
      provider: 'huggingface',
      used_token: HAS_TOKEN
    };
  }
}

// ========== API ENDPOINTS ==========

// POST /api/huggingface/chat - Main chat endpoint
router.post('/chat', aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid message is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const fullPrompt = `${LIBRARY_SYSTEM_PROMPT}\n\nUser: ${message}\nAssistant:`;
    
    console.log(`💬 Chat request: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    
    // Call Hugging Face AI
    const aiResult = await callHuggingFace(fullPrompt);
    
    if (aiResult.success) {
      return res.json({
        success: true,
        response: aiResult.text,
        source: 'ai-huggingface',
        model: aiResult.model,
        provider: aiResult.provider,
        used_token: aiResult.used_token,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`⚠️ AI failed, using fallback: ${aiResult.error}`);
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: 'fallback',
        note: `AI service unavailable: ${aiResult.error}`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    return res.json({
      success: true,
      response: getLibraryFallbackResponse(req.body?.message || ''),
      source: 'error-fallback',
      note: 'Service error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/huggingface/test - Test endpoint
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing Hugging Face AI...');
    
    const testPrompt = "Say 'UBLC Library AI Assistant is working correctly!'";
    const aiResult = await callHuggingFace(testPrompt);
    
    if (aiResult.success) {
      res.json({
        success: true,
        message: '🎉 HUGGING FACE AI IS WORKING!',
        provider: 'huggingface',
        model_used: aiResult.model,
        test_response: aiResult.text,
        used_token: aiResult.used_token,
        available_models: CHAT_MODELS.map(m => m.name),
        token_configured: HAS_TOKEN,
        rate_limit: '30 requests/minute',
        free_tier: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        message: 'Hugging Face AI test failed',
        error: aiResult.error,
        provider: 'huggingface',
        available_models: CHAT_MODELS.map(m => m.name),
        token_configured: HAS_TOKEN,
        suggestion: HAS_TOKEN ? 'Check token permissions' : 'Try adding HF_TOKEN for better performance',
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

// GET /api/huggingface/status - Status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    provider: 'huggingface',
    configured: true,
    token_configured: HAS_TOKEN,
    token_status: HAS_TOKEN ? 'Token available' : 'Using public access',
    rate_limit: '30 requests/minute',
    free_tier: true,
    no_payment_required: true,
    available_models: CHAT_MODELS.map(m => ({
      name: m.name,
      type: m.type,
      description: m.description
    })),
    endpoints: [
      'POST /api/huggingface/chat',
      'GET /api/huggingface/test',
      'GET /api/huggingface/status'
    ],
    features: [
      'Natural language understanding',
      'Library-specific knowledge',
      'Fallback responses',
      'Multiple model fallbacks',
      'Rate limiting'
    ],
    project: 'UBLC Library AI Assistant',
    institution: 'University of Batangas Lipa Campus',
    timestamp: new Date().toISOString()
  });
});

// GET /api/huggingface/models - List available models
router.get('/models', (req, res) => {
  res.json({
    success: true,
    models: CHAT_MODELS,
    current_preference: 'DialoGPT-medium (best for chat)',
    token_required: 'Optional (improves performance)',
    free_forever: true,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;