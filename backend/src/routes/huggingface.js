const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many AI requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Your Hugging Face Token
const HF_TOKEN = process.env.HF_TOKEN;
const HAS_TOKEN = !!HF_TOKEN;

console.log(`🔧 Hugging Face: ${HAS_TOKEN ? 'Token configured' : 'Public access'}`);

// NEW: Hugging Face Router API endpoint
const HF_ROUTER_URL = 'https://router.huggingface.co/hf-inference/models';

// Models that work with the new router API
const ROUTER_MODELS = [
  {
    name: 'microsoft/DialoGPT-medium',
    task: 'conversational',
    description: 'Best for chat conversations'
  },
  {
    name: 'google/flan-t5-base',
    task: 'text2text-generation',
    description: 'Good for instructions'
  },
  {
    name: 'distilgpt2',
    task: 'text-generation',
    description: 'Fast text generation'
  },
  {
    name: 'facebook/blenderbot-400M-distill',
    task: 'conversational',
    description: 'Chat-optimized model'
  }
];

// LIBRARY SYSTEM PROMPT (same as before)
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

// Fallback responses (same as before)
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
  
  return `I'm here to help with UBLC library services! You can ask me about available books, make reservations, check library hours, or learn about borrowing policies.

How can I help you today?`;
}

// NEW: Call Hugging Face Router API
async function callHuggingFaceRouter(prompt, modelIndex = 0) {
  try {
    if (modelIndex >= ROUTER_MODELS.length) {
      throw new Error('All models failed');
    }
    
    const model = ROUTER_MODELS[modelIndex];
    console.log(`🤖 Trying model: ${model.name} (${model.task})`);
    
    if (!HF_TOKEN) {
      throw new Error('HF token required for router API');
    }
    
    // Prepare request based on task
    let requestBody;
    const url = `${HF_ROUTER_URL}/${model.name}`;
    
    switch (model.task) {
      case 'conversational':
        requestBody = {
          inputs: {
            text: prompt,
            past_user_inputs: [],
            generated_responses: []
          },
          parameters: {
            max_length: 200,
            temperature: 0.8,
            top_p: 0.95
          }
        };
        break;
        
      case 'text2text-generation':
        requestBody = {
          inputs: prompt,
          parameters: {
            max_length: 200,
            temperature: 0.7
          }
        };
        break;
        
      default: // text-generation
        requestBody = {
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.8,
            top_p: 0.95,
            do_sample: true
          }
        };
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (response.status === 429) {
      console.log(`⚠️ Rate limit, trying next model...`);
      return callHuggingFaceRouter(prompt, modelIndex + 1);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${model.name} error ${response.status}:`, errorText.substring(0, 100));
      
      if (modelIndex + 1 < ROUTER_MODELS.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return callHuggingFaceRouter(prompt, modelIndex + 1);
      }
      throw new Error(`Router API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse response
    let aiResponse = '';
    
    if (model.task === 'conversational' && data.generated_text) {
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
    
    // Clean response
    aiResponse = aiResponse
      .replace(/^[^a-zA-Z0-9"'\(\)]+/, '')
      .trim();
    
    if (!aiResponse || aiResponse.length < 10) {
      console.log(`⚠️ Invalid response, trying next model...`);
      if (modelIndex + 1 < ROUTER_MODELS.length) {
        return callHuggingFaceRouter(prompt, modelIndex + 1);
      }
      throw new Error('Invalid AI response');
    }
    
    console.log(`✅ ${model.name} success: ${aiResponse.substring(0, 60)}...`);
    
    return {
      success: true,
      text: aiResponse,
      model: model.name,
      task: model.task,
      provider: 'huggingface-router',
      used_token: true
    };
    
  } catch (error) {
    console.error('❌ Router API error:', error.message);
    
    // If token is missing, use fallback immediately
    if (error.message.includes('token required')) {
      return {
        success: false,
        error: 'HF token required for router API',
        provider: 'huggingface-router'
      };
    }
    
    if (modelIndex + 1 < ROUTER_MODELS.length) {
      return callHuggingFaceRouter(prompt, modelIndex + 1);
    }
    
    return {
      success: false,
      error: error.message,
      provider: 'huggingface-router'
    };
  }
}

// Try old API as fallback (some models might still work)
async function callHuggingFaceOldAPI(prompt) {
  try {
    // Try a few old endpoints that might still work
    const oldEndpoints = [
      'https://huggingface.co/api/models/microsoft/DialoGPT-medium',
      'https://huggingface.co/api/models/google/flan-t5-base'
    ];
    
    for (const endpoint of oldEndpoints) {
      try {
        console.log(`🔄 Trying old endpoint: ${endpoint}`);
        
        const response = await fetch(`${endpoint}/inference`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(HF_TOKEN && { 'Authorization': `Bearer ${HF_TOKEN}` })
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_length: 150 }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data[0] && data[0].generated_text) {
            return {
              success: true,
              text: data[0].generated_text,
              model: endpoint.split('/').pop(),
              provider: 'huggingface-old',
              used_token: !!HF_TOKEN
            };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('All old endpoints failed');
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider: 'huggingface-old'
    };
  }
}

// Main AI calling function
async function callAI(prompt) {
  // First try new router API
  const routerResult = await callHuggingFaceRouter(prompt);
  if (routerResult.success) return routerResult;
  
  console.log('🔄 Router API failed, trying old API...');
  
  // Try old API as fallback
  const oldResult = await callHuggingFaceOldAPI(prompt);
  if (oldResult.success) return oldResult;
  
  return {
    success: false,
    error: 'All AI services unavailable',
    provider: 'none'
  };
}

// ========== API ENDPOINTS ==========

// POST /api/huggingface/chat
router.post('/chat', aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message required',
        timestamp: new Date().toISOString()
      });
    }
    
    const fullPrompt = `${LIBRARY_SYSTEM_PROMPT}\n\nUser: ${message}\nAssistant:`;
    
    console.log(`💬 Chat: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    
    const aiResult = await callAI(fullPrompt);
    
    if (aiResult.success) {
      return res.json({
        success: true,
        response: aiResult.text,
        source: `ai-${aiResult.provider}`,
        model: aiResult.model,
        provider: aiResult.provider,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`⚠️ AI failed: ${aiResult.error}`);
      return res.json({
        success: true,
        response: getLibraryFallbackResponse(message),
        source: 'fallback',
        note: `AI service: ${aiResult.error}`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Chat error:', error);
    return res.json({
      success: true,
      response: getLibraryFallbackResponse(req.body?.message || ''),
      source: 'error-fallback',
      note: 'Service error',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/huggingface/test
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing Hugging Face AI...');
    
    const testPrompt = "Say 'UBLC Library AI is working!'";
    const aiResult = await callAI(testPrompt);
    
    if (aiResult.success) {
      res.json({
        success: true,
        message: '🎉 HUGGING FACE AI IS WORKING!',
        provider: aiResult.provider,
        model: aiResult.model,
        test_response: aiResult.text,
        used_token: !!HF_TOKEN,
        api_type: 'router-api',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        message: 'Hugging Face AI test failed',
        error: aiResult.error,
        provider: aiResult.provider,
        token_configured: HAS_TOKEN,
        suggestion: 'Hugging Face API endpoints changed. Using fallback responses.',
        fallback_working: true,
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

// GET /api/huggingface/status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    provider: 'huggingface',
    configured: true,
    token_configured: HAS_TOKEN,
    api_endpoint: 'router.huggingface.co',
    rate_limit: '30 requests/minute',
    free_tier: true,
    no_payment_required: true,
    models_available: ROUTER_MODELS.map(m => m.name),
    endpoints: [
      'POST /api/huggingface/chat',
      'GET /api/huggingface/test',
      'GET /api/huggingface/status'
    ],
    features: [
      'Natural language AI',
      'Library-specific responses',
      'Robust fallback system',
      'Multiple model fallbacks',
      'Real Google Sheets integration'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;