// gemini.js - UPDATED VERSION
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import shared session management
const sessionManager = require('./sessionManager');
const {
    generateSessionId,
    getSession,
    clearSession,
    hasReservationIntent,
    extractBookTitle,
    processReservationFlow
} = sessionManager;

// ---
// FETCH REAL BOOKS FROM YOUR API
// ---
async function fetchRealBooks() {
    try {
        console.log('$ Fetching real books from API...');
        
        // Your live API endpoint
        const response = await fetch('https://ublc-ai-automation-1.onrender.com');
        
        if (!response.ok) {
            console.warn(`API responded with status: ${response.status}`);
            return getFallbackBooks();
        }
        
        const books = await response.json();
        
        if (!Array.isArray(books)) {
            console.warn('API did not return an array');
            return getFallbackBooks();
        }
        
        console.log(`✓ Successfully fetched ${books.length} real books`);
        return books;
        
    } catch (error) {
        console.error('✗ Failed to fetch real books:', error.message);
        return getFallbackBooks();
    }
}

function getFallbackBooks() {
    console.log('⚠ Using fallback book data');
    return [
        {
            bookId: "B001",
            title: "Programming in C",
            author: "Dennis Ritchie",
            copies_available: 5,
            location: "2nd Floor - Section A",
            category: "Programming"
        },
        {
            bookId: "B002",
            title: "Data Structures and Algorithms",
            author: "Robert Sedgewick",
            copies_available: 3,
            location: "2nd Floor - Section A",
            category: "Computer Science"
        },
        {
            bookId: "B003",
            title: "Python Programming",
            author: "Mark Lutz",
            copies_available: 9,
            location: "2nd Floor - Section A",
            category: "Programming"
        }
    ];
}

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
        success: false,
        error: 'Too many AI requests. Please wait a moment.',
        note: 'Free tier has limited requests per minute.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Library prompt
let libraryPrompt = `You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

IMPORTANT RESERVATION RULES:
1. If user says "reserve [book name]" or similar:
   - Check if they provided student information
   - If NO student info: Ask for: Student ID, Full Name, Email Address
   - If HAS student info: Confirm the reservation details

RESPONSE FORMATS:
- Missing student info: "To reserve [book], I need: 1) Student ID, 2) Full Name, 3) Email Address"
- Has student info: "Confirm: Student: [name], ID: [id], Email: [email]. Book: [book]. Reply 'yes' to confirm."
- Successful reservation: "Reservation confirmed! ID: RES-[number]. Pick up at UBLC Library."

GENERAL GUIDELINES:
- Be friendly, professional, UBLC-focused
- Guide users step-by-step
- Library hours: Mon-Fri 8AM-5PM, Sat 9AM-12PM
- Loan period: 7 days, max 2 books
- Late fee: P10/day per book`;

// Update prompt with real books on startup
async function updateLibraryPrompt() {
    try {
        const books = await fetchRealBooks();
        
        if (books.length > 0) {
            const bookList = books.map(book =>
                `• ${book.title} by ${book.author} (${book.copies_available} available)`
            ).join('\n');
            
            libraryPrompt = `You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

BOOK CATALOG:
${bookList}

IMPORTANT RESERVATION RULES:
1. If user says "reserve [book name]" or similar:
   - Check if they provided student information
   - If NO student info: Ask for: Student ID, Full Name, Email Address
   - If HAS student info: Confirm the reservation details

RESPONSE FORMATS:
- Missing student info: "To reserve [book], I need: 1) Student ID, 2) Full Name, 3) Email Address"
- Has student info: "Confirm: Student: [name], ID: [id], Email: [email]. Book: [book]. Reply 'yes' to confirm."
- Successful reservation: "Reservation confirmed! ID: RES-[number]. Pick up at UBLC Library."

GENERAL GUIDELINES:
- Be friendly, professional, UBLC-focused
- Guide users step-by-step
- Library hours: Mon-Fri 8AM-5PM, Sat 9AM-12PM
- Loan period: 7 days, max 2 books
- Late fee: P10/day per book`;

            console.log('✓ Updated library prompt with real books');
        }
    } catch (error) {
        console.error('Failed to update prompt:', error);
    }
}

updateLibraryPrompt();

// Gemini API call
async function callGeminiAPI(prompt) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('No Gemini API key found');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`;
        console.log('→ Calling Gemini API...');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts[0]) {
            return {
                success: true,
                text: data.candidates[0].content.parts[0].text,
                model: "gemma-3-4b-it"
            };
        } else {
            throw new Error('Unexpected API response format');
        }

    } catch (error) {
        console.error('✗ Gemini API call failed:', error.message);
        return {
            success: false,
            error: error.message,
            model: "gemma-3-4b-it"
        };
    }
}

// Fallback response
function getFallbackResponse(message, session = null, books = []) {
    const lowerMsg = message.toLowerCase();
    
    if (session && session.currentFlow === 'reservation') {
        if (session.step === 'collecting_info') {
            return `To reserve "${session.data.bookTitle}", I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
        }
        if (session.step === 'awaiting_confirmation') {
            return `Please confirm: Is your information correct?\nStudent: ${session.data.studentInfo.name}\nID: ${session.data.studentInfo.studentId}\nEmail: ${session.data.studentInfo.email}\n\nReply "yes" to confirm or "no" to correct.`;
        }
    }
    
    if (hasReservationIntent(lowerMsg)) {
        const bookTitle = extractBookTitle(message, books);
        if (bookTitle) {
            return `I can help you reserve "${bookTitle}"! Please provide your:\n\n1. Student ID\n2. Full Name\n3. Email Address`;
        }
        return "Which book would you like to reserve?";
    }
    
    if (lowerMsg.includes('programming') || lowerMsg.includes('code')) {
        const programmingBooks = books.filter(b =>
            b.category === 'Programming' ||
            b.title.includes('Programming') ||
            b.title.includes('Python')
        ).slice(0, 5);
        
        if (programmingBooks.length > 0) {
            const bookList = programmingBooks.map(b =>
                `• ${b.title} (${b.copies_available} available)`
            ).join('\n');
            return `We have programming books including:\n${bookList}`;
        }
        return "We have programming books: Programming in C, Python Programming, Data Structures and Algorithms.";
    }
    
    if (lowerMsg.includes('hour') || lowerMsg.includes('time') || lowerMsg.includes('open')) {
        return "Library hours: Monday-Friday 8:00 AM - 5:00 PM, Saturday 9:00 AM - 12:00 PM";
    }
    
    if (lowerMsg.includes('available') || lowerMsg.includes('book list') || lowerMsg.includes('catalog')) {
        if (books.length > 0) {
            const categories = [...new Set(books.map(b => b.category).filter(Boolean))];
            return `Available categories: ${categories.join(', ')}`;
        }
        return "We have books in Programming, Computer Science, Database, Networking, AI/ML, Web Development, Operating Systems, and Software Engineering.";
    }
    
    if (lowerMsg.includes('rule') || lowerMsg.includes('policy') || lowerMsg.includes('late')) {
        return "Library policies: 7-day loan, 2 books maximum, P10/day late fee, reservations held for 3 days.";
    }
    
    return "I'm here to help with UBLC library services! I can assist with book reservations, library information, and book searches.";
}

// Function for library-specific fallback
function getLibraryFallbackResponse(message, session = null) {
    const books = getFallbackBooks();
    return getFallbackResponse(message, session, books);
}

// ---
// ENHANCED GEMINI CHAT HANDLER (Main handler for /api/chat)
// ---
const enhancedGeminiHandler = async (req, res) => {
    try {
        const { message, student, sessionId } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: "Valid message is required",
                timestamp: new Date().toISOString()
            });
        }
        
        // 1. FETCH REAL BOOKS
        const books = await fetchRealBooks();
        
        // 2. SESSION MANAGEMENT
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);
        
        session.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        console.log(`📱 [Gemini Enhanced] Session ${currentSessionId}: Flow=${session.currentFlow || 'none'}, Step=${session.step || 'none'}`);
        
        // 3. HANDLE RESERVATION FLOW FIRST (Priority)
        if (session.currentFlow === 'reservation') {
            if (session.step === 'collecting_info') {
                if (student && student.studentId && student.name && student.email) {
                    session.data.studentInfo = student;
                    session.step = 'awaiting_confirmation';
                    
                    const confirmationMessage = `✓ Thank you, ${student.name}!\n\nI have your request to reserve **"${session.data.bookTitle}"**.\n\n**Please confirm your details:**\n• Student ID: ${student.studentId}\n• Full Name: ${student.name}\n• Email: ${student.email}\n\nIs this correct? (Reply "yes" to confirm or "no" to correct)`;
                    
                    return res.json({
                        success: true,
                        response: confirmationMessage,
                        sessionId: currentSessionId,
                        requiresConfirmation: true,
                        source: "gemini-reservation-flow",
                        timestamp: new Date().toISOString()
                    });
                } else {
                    const infoRequest = `✓ To reserve **"${session.data.bookTitle}"**, I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
                    
                    return res.json({
                        success: true,
                        response: infoRequest,
                        sessionId: currentSessionId,
                        requiresStudentInfo: true,
                        source: "gemini-reservation-info",
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            if (session.step === 'awaiting_confirmation') {
                const result = processReservationFlow(message, session, currentSessionId, books);
                if (result) {
                    return res.json({
                        ...result,
                        source: "gemini-reservation-confirmation",
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        // 4. DETECT NEW RESERVATION
        if (hasReservationIntent(message)) {
            const bookTitle = extractBookTitle(message, books);
            
            if (bookTitle) {
                const book = books.find(b => b.title === bookTitle);
                if (book && book.copies_available < 1) {
                    return res.json({
                        success: false,
                        response: `Sorry, "${bookTitle}" is currently unavailable (${book.copies_available} copies).`,
                        sessionId: currentSessionId,
                        source: "gemini-reservation-unavailable",
                        timestamp: new Date().toISOString()
                    });
                }
                
                session.currentFlow = 'reservation';
                session.step = 'collecting_info';
                session.data.bookTitle = bookTitle;
                session.data.studentInfo = null;
                
                const infoRequest = `✓ I can reserve **"${bookTitle}"** for you!\n\nFirst, I need:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**${book ? `\n\n${book.copies_available} copies available` : ''}`;
                
                return res.json({
                    success: true,
                    response: infoRequest,
                    sessionId: currentSessionId,
                    requiresStudentInfo: true,
                    reservationIntent: true,
                    source: "gemini-new-reservation",
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // 5. TRY GEMINI API FIRST (Main functionality)
        console.log('→ Attempting Gemini API call...');
        try {
            let currentPrompt = libraryPrompt;
            
            // Add conversation history
            if (session.conversationHistory.length > 0) {
                const recentHistory = session.conversationHistory.slice(-3)
                    .map(msg => `${msg.role}: ${msg.content}`)
                    .join('\n');
                currentPrompt += `\n\nRecent conversation:\n${recentHistory}\n\nUser: ${message}\nAssistant:`;
            } else {
                currentPrompt += `\n\nUser: ${message}\nAssistant:`;
            }
            
            const aiResult = await callGeminiAPI(currentPrompt);
            
            if (aiResult.success) {
                session.conversationHistory.push({
                    role: 'assistant',
                    content: aiResult.text,
                    timestamp: new Date().toISOString()
                });
                
                console.log('✓ Gemini API successful');
                return res.json({
                    success: true,
                    response: aiResult.text,
                    sessionId: currentSessionId,
                    source: `gemini-${aiResult.model}`,
                    model: aiResult.model,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log('⚠ Gemini API failed, falling back...');
                throw new Error('Gemini API call failed');
            }
        } catch (geminiError) {
            console.log(`⚠ Gemini attempt failed: ${geminiError.message}`);
        }
        
        // 6. FALLBACK TO RULE-BASED (Only if Gemini fails)
        console.log('→ Using rule-based fallback');
        const fallbackResponse = getFallbackResponse(message, session, books);
        
        session.conversationHistory.push({
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date().toISOString()
        });
        
        return res.json({
            success: true,
            response: fallbackResponse,
            sessionId: currentSessionId,
            source: "fallback-after-gemini",
            geminiFailed: true,
            note: 'Using rule-based fallback after Gemini failure',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`✗ General error in ${req.path}:`, error.message);
        
        return res.json({
            success: true,
            response: "I'm here to help with UBLC library services! How can I assist you today?",
            sessionId: null,
            source: "gemini-error-recovery",
            timestamp: new Date().toISOString()
        });
    }
};

// ---
// PURE GEMINI HANDLER (No fallback, for /api/gemini-only/chat)
// ---
const pureGeminiHandler = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: "Valid message is required",
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('→ Pure Gemini API call...');
        const currentPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
        const aiResult = await callGeminiAPI(currentPrompt);
        
        if (aiResult.success) {
            return res.json({
                success: true,
                response: aiResult.text,
                source: `pure-gemini-${aiResult.model}`,
                model: aiResult.model,
                timestamp: new Date().toISOString()
            });
        } else {
            return res.status(500).json({
                success: false,
                error: "Gemini API failed",
                source: "pure-gemini-failed",
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// ---
// FALLBACK-ONLY HANDLER (For /api/fallback-chat)
// ---
const fallbackOnlyHandler = async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message is required",
                timestamp: new Date().toISOString()
            });
        }
        
        const books = await fetchRealBooks();
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);
        
        const fallbackResponse = getFallbackResponse(message, session, books);
        
        return res.json({
            success: true,
            response: fallbackResponse,
            sessionId: currentSessionId,
            source: "pure-fallback",
            note: 'Using rule-based fallback only',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// ---
// REGISTER ENDPOINTS
// ---

// MAIN CHAT ENDPOINT: /api/chat (Gemini with fallback)
router.post('/', apiLimiter, enhancedGeminiHandler);

// GEMINI-ONLY ENDPOINT: /api/gemini/chat (Keep for backward compatibility)
router.post('/chat', apiLimiter, enhancedGeminiHandler);

// NEW: PURE GEMINI (no fallback)
router.post('/gemini-only', apiLimiter, pureGeminiHandler);

// NEW: FALLBACK ONLY (no Gemini)
router.post('/fallback-only', apiLimiter, fallbackOnlyHandler);

// Library-specific endpoint
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
        
        const books = await fetchRealBooks();
        const fallbackResponse = getFallbackResponse(message, null, books);
        
        res.json({
            success: true,
            response: fallbackResponse,
            source: "library-fallback",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to process library request',
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint
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
                message: "✓ GEMINI API IS WORKING!",
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

// Status endpoint
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
            timestamp: new Date().toISOString(),
            endpoints: {
                main_chat: "/api/chat (Gemini with fallback)",
                gemini_only: "/api/gemini/gemini-only (Pure Gemini)",
                fallback_only: "/api/gemini/fallback-only (Fallback only)",
                legacy: "/api/gemini/chat (Legacy)"
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
