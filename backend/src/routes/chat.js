// chat.js - Updated to use shared sessionManager
const express = require('express');
const router = express.Router();

// Import shared session management
const sessionManager = require('./sessionManager');
const { 
    generateSessionId, 
    getSession, 
    clearSession, 
    hasReservationIntent, 
    extractBookTitle,
    processReservationFlow,
    sessions  // Add this if needed for debugging endpoints
} = sessionManager;

// Function to fetch real books (same as gemini.js)
async function fetchRealBooks() {
    try {
        console.log('📚 [Chat.js] Fetching real books...');
        const response = await fetch('https://ublc-ai-automation-1.onrender.com/api/books');
        
        if (!response.ok) {
            console.warn('Failed to fetch books');
            return getFallbackBooks();
        }
        
        const books = await response.json();
        
        if (!Array.isArray(books)) {
            console.warn('API did not return an array');
            return getFallbackBooks();
        }
        
        console.log(`✅ [Chat.js] Fetched ${books.length} books`);
        return books;
        
    } catch (error) {
        console.error('Error fetching books:', error);
        return getFallbackBooks();
    }
}

// Minimal fallback books (same structure as your mockBooks)
function getFallbackBooks() {
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
        // Add more if needed, but keep minimal
    ];
}

// Get fallback response (updated to use real books)
async function getFallbackResponse(message, session = null) {
    const books = await fetchRealBooks(); // Fetch real books
    
    const lowerMsg = message.toLowerCase();
    
    // If in reservation flow, handle it
    if (session && session.currentFlow === 'reservation') {
        if (session.step === 'collecting_info') {
            return `To reserve "${session.data.bookTitle}", I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
        }
        if (session.step === 'awaiting_confirmation') {
            return `Please confirm: Is your information correct?\nStudent: ${session.data.studentInfo.name}\nID: ${session.data.studentInfo.studentId}\nEmail: ${session.data.studentInfo.email}\n\nReply "yes" to confirm or "no" to correct.`;
        }
    }
    
    // Check for reservation intent
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
                `  • ${b.title} (${b.copies_available} available)`
            ).join('\n');
            return `We have programming books including:\n${bookList}`;
        }
        return "We have programming books: Programming in C, Python Programming, Data Structures and Algorithms.";
    }
    
    if (lowerMsg.includes('hour') || lowerMsg.includes('time') || lowerMsg.includes('open')) {
        return "Library hours: Monday-Friday 8:00 AM - 5:00 PM, Saturday 9:00 AM - 12:00 PM";
    }
    
    if (lowerMsg.includes('book') || lowerMsg.includes('available') || lowerMsg.includes('catalog')) {
        if (books.length > 0) {
            const categories = [...new Set(books.map(b => b.category).filter(Boolean))];
            return `We have books in: ${categories.join(', ')}.`;
        }
        return "We have books in: Programming, Computer Science, Database, Networking, AI/ML, Web Development, Operating Systems, and Software Engineering.";
    }
    
    return "I can help with book reservations, library information, and book searches. What would you like to know?";
}

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Fallback chat endpoint is working',
        available_endpoints: ['POST /'],
        timestamp: new Date().toISOString()
    });
});

router.post('/', async (req, res) => {
    try {
        const { message, student, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ 
                success: false,
                error: 'Message is required',
                timestamp: new Date().toISOString()
            });
        }

        // Use shared session management
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);
        
        // Add user message to history
        session.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        console.log(`[Chat.js] Session ${currentSessionId}: Flow=${session.currentFlow || 'none'}, Step=${session.step || 'none'}`);

        // Fetch real books for processing
        const books = await fetchRealBooks();
        
        // ============================================
        // RESERVATION FLOW HANDLING (using shared functions)
        // ============================================
        
        if (session.currentFlow === 'reservation') {
            // Collecting student info
            if (session.step === 'collecting_info') {
                if (student && student.studentId && student.name && student.email) {
                    session.data.studentInfo = student;
                    session.step = 'awaiting_confirmation';
                    
                    const confirmationMessage = `✅ Thank you, ${student.name}!\n\nI have your request to reserve **"${session.data.bookTitle}"**.\n\n**Please confirm your details:**\n• Student ID: ${student.studentId}\n• Full Name: ${student.name}\n• Email: ${student.email}\n\nIs this correct? (Reply "yes" to confirm or "no" to correct)`;
                    
                    return res.json({
                        success: true,
                        reply: confirmationMessage,
                        sessionId: currentSessionId,
                        requiresConfirmation: true,
                        reservationData: {
                            bookTitle: session.data.bookTitle,
                            studentInfo: student
                        },
                        timestamp: new Date().toISOString()
                    });
                } else {
                    const infoRequest = `📚 To reserve **"${session.data.bookTitle}"**, I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**`;
                    
                    return res.json({
                        success: true,
                        reply: infoRequest,
                        sessionId: currentSessionId,
                        requiresStudentInfo: true,
                        reservationIntent: true,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Awaiting confirmation - Use shared function
            if (session.step === 'awaiting_confirmation') {
                const result = processReservationFlow(message, session, currentSessionId, books);
                if (result) {
                    return res.json({
                        ...result,
                        timestamp: new Date().toISOString()
                    });
                }
                // If no match, continue to normal response
            }
        }

        // ============================================
        // NEW RESERVATION DETECTION (using shared functions)
        // ============================================
        
        if (hasReservationIntent(message)) {
            const bookTitle = extractBookTitle(message, books);
            
            if (bookTitle) {
                const book = books.find(b => b.title === bookTitle);
                session.currentFlow = 'reservation';
                session.step = 'collecting_info';
                session.data.bookTitle = bookTitle;
                session.data.studentInfo = null;
                
                const infoRequest = `📚 I can reserve **"${bookTitle}"** for you!\n\nFirst, I need:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**${book ? `\n\n✅ ${book.copies_available} copies available` : ''}`;
                
                return res.json({
                    success: true,
                    reply: infoRequest,
                    sessionId: currentSessionId,
                    requiresStudentInfo: true,
                    reservationIntent: true,
                    bookTitle: bookTitle,
                    timestamp: new Date().toISOString()
                });
            } else {
                const askBookMessage = "Which book would you like to reserve? You can say:\n• \"Programming in C\"\n• \"Data Structures and Algorithms\"\n• \"Python Programming\"\n• Or any other book title";
                
                return res.json({
                    success: true,
                    reply: askBookMessage,
                    sessionId: currentSessionId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // ============================================
        // REGULAR CHAT RESPONSE
        // ============================================
        
        const fallbackReply = await getFallbackResponse(message, session);
        
        session.conversationHistory.push({
            role: 'assistant',
            content: fallbackReply,
            timestamp: new Date().toISOString()
        });

        return res.json({
            success: true,
            reply: fallbackReply,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString(),
            source: 'fallback-chat'
        });

    } catch (error) {
        console.error("Chat.js error:", error);
        
        return res.json({
            success: true,
            reply: "I'm here to help with UBLC library services! How can I assist you today?",
            sessionId: null,
            timestamp: new Date().toISOString(),
            source: 'error-recovery'
        });
    }
});

// Session cleanup endpoint (uses shared clearSession)
router.post('/clear-session', (req, res) => {
    const { sessionId } = req.body;
    clearSession(sessionId);
    res.json({ 
        success: true, 
        message: 'Session cleared',
        timestamp: new Date().toISOString()
    });
});

// Session info endpoint (for debugging) - Updated to use shared sessions
router.get('/session-info/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = getSession(sessionId); // Use shared getSession
    
    if (!session || session.createdAt === undefined) { // Check if session exists
        return res.json({
            success: false,
            message: 'Session not found',
            timestamp: new Date().toISOString()
        });
    }
    
    res.json({
        success: true,
        session: {
            id: sessionId,
            currentFlow: session.currentFlow,
            step: session.step,
            data: session.data,
            createdAt: session.createdAt,
            historyLength: session.conversationHistory.length
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;