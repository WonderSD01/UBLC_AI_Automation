const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: {
        success: false,
        error: 'Too many AI requests. Please wait a moment.',
        note: 'Free tier has limited requests per minute.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ============================================
// SESSION MANAGEMENT (ADD THIS SECTION)
// ============================================
const sessions = {};

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      currentFlow: null,
      step: null,
      data: {},
      conversationHistory: [],
      createdAt: new Date().toISOString()
    };
  }
  return sessions[sessionId];
}

function clearSession(sessionId) {
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
}

// Mock book data matching your server
const mockBooks = [
  { title: "Programming in C", author: "Dennis Ritchie", copies_available: 5 },
  { title: "Data Structures and Algorithms", author: "Robert Sedgewick", copies_available: 3 },
  { title: "Python Programming", author: "Mark Lutz", copies_available: 9 },
  { title: "Software Engineering", author: "Ian Sommerville", copies_available: 9 },
  { title: "Introduction to Database Systems", author: "C.J. Date", copies_available: 3 },
  { title: "Computer Networks", author: "Andrew Tanenbaum", copies_available: 5 },
  { title: "Artificial Intelligence", author: "Stuart Russell", copies_available: 7 },
  { title: "Web Development Fundamentals", author: "Jon Duckett", copies_available: 5 },
  { title: "Operating Systems Concepts", author: "Abraham Silberschatz", copies_available: 4 },
  { title: "Machine Learning Basics", author: "Andriy Burkov", copies_available: 8 }
];

// ============================================
// ENHANCED LIBRARY PROMPT WITH RESERVATION LOGIC
// ============================================
const libraryPrompt = `You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

IMPORTANT RESERVATION RULES:
1. If user says "reserve [book name]" or similar:
   - Check if they provided student information
   - If NO student info: Ask for: Student ID, Full Name, Email Address
   - If HAS student info: Confirm the reservation details

2. BOOK CATALOG:
   - Programming in C (5 copies)
   - Data Structures and Algorithms (3 copies)
   - Python Programming (9 copies)
   - Software Engineering (9 copies)
   - Introduction to Database Systems (3 copies)
   - Computer Networks (5 copies)
   - Artificial Intelligence (7 copies)
   - Web Development Fundamentals (5 copies)
   - Operating Systems Concepts (4 copies)
   - Machine Learning Basics (8 copies)

3. RESPONSE FORMATS:
   - Missing student info: "To reserve [book], I need: 1) Student ID, 2) Full Name, 3) Email Address"
   - Has student info: "Confirm: Student: [name], ID: [id], Email: [email]. Book: [book]. Reply 'yes' to confirm."
   - Successful reservation: "Reservation confirmed! ID: RES-[number]. Pick up at UBLC Library."

4. GENERAL GUIDELINES:
   - Be friendly, professional, UBLC-focused
   - Guide users step-by-step
   - Only recommend books from our catalog
   - Library hours: Mon-Fri 8AM-5PM
   - Loan period: 7 days, max 2 books
   - Late fee: ₱10/day per book`;

// ============================================
// FALLBACK RESPONSES (ENHANCED)
// ============================================
function getLibraryFallbackResponse(message, session = null) {
  const msg = message.toLowerCase().trim();

  // Handle reservation flow if in session
  if (session && session.currentFlow === 'reservation') {
    if (session.step === 'collecting_info') {
      return `To reserve "${session.data.bookTitle}", I need:
1. **Student ID:**
2. **Full Name:**
3. **Email Address:**`;
    }
    if (session.step === 'awaiting_confirmation') {
      return `Please confirm your reservation:
Book: ${session.data.bookTitle}
Student: ${session.data.studentInfo.name}
ID: ${session.data.studentInfo.studentId}
Email: ${session.data.studentInfo.email}

Reply "yes" to confirm or "no" to correct.`;
    }
  }

  // Check for reservation intent
  const hasReserveIntent = msg.includes('reserve') || msg.includes('borrow') || msg.includes('book me');
  if (hasReserveIntent) {
    // Extract book title
    let bookTitle = null;
    for (const book of mockBooks) {
      if (msg.includes(book.title.toLowerCase())) {
        bookTitle = book.title;
        break;
      }
    }
    
    if (bookTitle) {
      return `I can help you reserve "${bookTitle}"! Please provide:
1. Student ID
2. Full Name
3. Email Address`;
    }
    return "Which book would you like to reserve? Available: Programming in C, Python Programming, Data Structures, etc.";
  }

  // Other common queries
  if (msg.includes('programming') || msg.includes('code')) {
    return "Programming books: Programming in C, Python Programming, Data Structures and Algorithms.";
  }
  
  if (msg.includes('hour') || msg.includes('time') || msg.includes('open')) {
    return "Library hours: Monday-Friday 8:00 AM - 5:00 PM, Saturday 9:00 AM - 12:00 PM";
  }
  
  if (msg.includes('available') || msg.includes('book list') || msg.includes('catalog')) {
    return "Available categories: Programming, Computer Science, Database, Networking, AI/ML, Web Development, Operating Systems, Software Engineering.";
  }
  
  if (msg.includes('rule') || msg.includes('policy') || msg.includes('late')) {
    return "Library policies: 7-day loan, 2 books maximum, ₱10/day late fee, reservations held for 3 days.";
  }
  
  return "I'm here to help with UBLC library services! I can assist with book reservations, library information, and book searches.";
}

// ============================================
// GEMINI API CALL
// ============================================
async function callGeminiAPI(prompt) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('No Gemini API key found');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`;
        console.log(`📡 Calling Gemini API...`);

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
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            return {
                success: true,
                text: data.candidates[0].content.parts[0].text,
                model: "gemma-3-4b-it",
                usage: data.usageMetadata || {}
            };
        } else {
            throw new Error('Unexpected API response format');
        }
    } catch (error) {
        console.error('❌ Gemini API call failed:', error.message);
        return {
            success: false,
            error: error.message,
            model: "gemma-3-4b-it"
        };
    }
}

// ============================================
// MAIN CHAT ENDPOINT WITH RESERVATION SUPPORT
// ============================================
router.post('/chat', apiLimiter, async (req, res) => {
    try {
        const { message, student, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message is required",
                timestamp: new Date().toISOString()
            });
        }

        // ============================================
        // SESSION MANAGEMENT
        // ============================================
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);
        
        // Add to conversation history
        session.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        console.log(`📝 Session ${currentSessionId}: Flow=${session.currentFlow}, Step=${session.step}`);

        // ============================================
        // RESERVATION FLOW HANDLING
        // ============================================
        
        // Check if in reservation flow
        if (session.currentFlow === 'reservation') {
            
            // Collecting student info
            if (session.step === 'collecting_info') {
                if (student && student.studentId && student.name && student.email) {
                    // Store student info and ask for confirmation
                    session.data.studentInfo = student;
                    session.step = 'awaiting_confirmation';
                    
                    const confirmationMessage = `✅ Thank you, ${student.name}!\n\nI have your request to reserve **"${session.data.bookTitle}"**.\n\n**Please confirm your details:**\n• Student ID: ${student.studentId}\n• Full Name: ${student.name}\n• Email: ${student.email}\n\nIs this correct? (Reply "yes" to confirm or "no" to correct)`;
                    
                    return res.json({
                        success: true,
                        response: confirmationMessage,
                        sessionId: currentSessionId,
                        requiresConfirmation: true,
                        source: "reservation-flow",
                        timestamp: new Date().toISOString()
                    });
                } else {
                    // Still need student info
                    const infoRequest = `📚 To reserve **"${session.data.bookTitle}"**, I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
                    
                    return res.json({
                        success: true,
                        response: infoRequest,
                        sessionId: currentSessionId,
                        requiresStudentInfo: true,
                        source: "reservation-info-request",
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Awaiting confirmation
            if (session.step === 'awaiting_confirmation') {
                const lowerMessage = message.toLowerCase().trim();
                
                // User confirms
                if (lowerMessage === 'yes' || lowerMessage.includes('correct') || lowerMessage.includes('confirm')) {
                    // Process reservation
                    const reservationId = 'RES-' + Date.now();
                    const successMessage = `🎉 **RESERVATION CONFIRMED!**\n\n📚 **Book:** ${session.data.bookTitle}\n👤 **Student:** ${session.data.studentInfo.name} (${session.data.studentInfo.studentId})\n📧 **Email:** ${session.data.studentInfo.email}\n🔢 **Reservation ID:** ${reservationId}\n📅 **Pick-up by:** Within 3 days\n📍 **Location:** UBLC Main Library\n\n✅ Please present your Student ID at the library counter.`;
                    
                    // Clear session
                    clearSession(currentSessionId);
                    
                    return res.json({
                        success: true,
                        response: successMessage,
                        sessionId: null,
                        reservationId: reservationId,
                        reservationComplete: true,
                        source: "reservation-complete",
                        timestamp: new Date().toISOString()
                    });
                    
                } else if (lowerMessage === 'no' || lowerMessage.includes('wrong')) {
                    // User wants to correct info
                    session.step = 'collecting_info';
                    session.data.studentInfo = null;
                    
                    const correctionMessage = "Please provide the correct information:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**";
                    
                    return res.json({
                        success: true,
                        response: correctionMessage,
                        sessionId: currentSessionId,
                        requiresStudentInfo: true,
                        source: "reservation-correction",
                        timestamp: new Date().toISOString()
                    });
                }
                // If not yes/no, continue to AI response
            }
        }

        // ============================================
        // DETECT NEW RESERVATION INTENT
        // ============================================
        const hasReserveIntent = message.toLowerCase().includes('reserve') || 
                                message.toLowerCase().includes('borrow') || 
                                message.toLowerCase().includes('book me');
        
        if (hasReserveIntent) {
            // Extract book title
            let bookTitle = null;
            for (const book of mockBooks) {
                if (message.toLowerCase().includes(book.title.toLowerCase())) {
                    bookTitle = book.title;
                    break;
                }
            }
            
            if (bookTitle) {
                // Start new reservation flow
                session.currentFlow = 'reservation';
                session.step = 'collecting_info';
                session.data.bookTitle = bookTitle;
                session.data.studentInfo = null;
                
                const infoRequest = `📚 I can reserve **"${bookTitle}"** for you!\n\nFirst, I need:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
                
                return res.json({
                    success: true,
                    response: infoRequest,
                    sessionId: currentSessionId,
                    requiresStudentInfo: true,
                    reservationIntent: true,
                    source: "new-reservation",
                    timestamp: new Date().toISOString()
                });
            }
        }

        // ============================================
        // REGULAR AI RESPONSE (Gemini API)
        // ============================================
        // Build prompt with context
        let contextPrompt = libraryPrompt;
        if (session.conversationHistory.length > 0) {
            const recentHistory = session.conversationHistory
                .slice(-3)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            contextPrompt += `\n\nRecent conversation:\n${recentHistory}\n\nUser: ${message}\nAssistant:`;
        } else {
            contextPrompt += `\n\nUser: ${message}\nAssistant:`;
        }

        // Try Gemini API
        const aiResult = await callGeminiAPI(contextPrompt);

        if (aiResult.success) {
            return res.json({
                success: true,
                response: aiResult.text,
                sessionId: currentSessionId,
                source: `gemini-${aiResult.model}`,
                model: aiResult.model,
                usage: aiResult.usage,
                timestamp: new Date().toISOString()
            });
        } else {
            // Use fallback
            const fallbackResponse = getLibraryFallbackResponse(message, session);
            return res.json({
                success: true,
                response: fallbackResponse,
                sessionId: currentSessionId,
                source: "fallback",
                note: `AI service limited: ${aiResult.error}`,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error("General error in /chat:", error.message);
        
        // Ultimate fallback
        return res.json({
            success: true,
            response: "I'm here to help with UBLC library services! How can I assist you today?",
            sessionId: null,
            source: "error-recovery",
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// KEEP OTHER ENDPOINTS (unchanged)
// ============================================

// POST /api/gemini/chat/library - Library-specific endpoint
router.post('/chat/library', apiLimiter, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message is required",
                timestamp: new Date().toISOString()
            });
        }

        const enhancedPrompt = `${libraryPrompt}\n\nIMPORTANT: You are ONLY a library assistant.\n\nUser: ${message}\nAssistant:`;
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
        if (!apiKey) {
            return res.json({
                success: false,
                error: "No API key found",
                suggestion: "Add GEMINI_API_KEY to environment variables"
            });
        }

        const testResult = await callGeminiAPI("Say 'UBLC Library AI is working!'");
        
        if (testResult.success) {
            res.json({
                success: true,
                message: "✅ GEMINI API IS WORKING!",
                key_exists: true,
                model: testResult.model,
                test_response: testResult.text,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                error: testResult.error,
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
        
        let apiTest = "not-tested";
        if (keyExists) {
            try {
                const testResult = await callGeminiAPI("Say 'OK'");
                apiTest = testResult.success ? "working" : "failed";
            } catch {
                apiTest = "error";
            }
        }

        res.json({
            success: true,
            gemini_configured: keyExists,
            api_test: apiTest,
            rate_limiting: "30 requests/minute",
            fallback_enabled: true,
            model: "gemma-3-4b-it",
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
                name: "gemma-3-4b-it",
                description: "Gemma 3 4B - CONFIRMED WORKING",
                status: "recommended"
            }
        ],
        current_model: "gemma-3-4b-it",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;