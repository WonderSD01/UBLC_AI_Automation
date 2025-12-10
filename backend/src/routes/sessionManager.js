
const sessions = {};

// Generate session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get or create session
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

// Clear session after completion
function clearSession(sessionId) {
    if (sessionId && sessions[sessionId]) {
        delete sessions[sessionId];
    }
}

// Extract book title from message (will use real data)
function extractBookTitle(message, books = []) {
    const lowerMsg = message.toLowerCase();
    
    // Check against real book data
    for (const book of books) {
        if (lowerMsg.includes(book.title.toLowerCase())) {
            return book.title;
        }
    }
    
    // Try partial matches
    if (lowerMsg.includes('programming in c') || lowerMsg.includes('programming c')) {
        return "Programming in C";
    }
    if (lowerMsg.includes('data structure') || lowerMsg.includes('algorithms')) {
        return "Data Structures and Algorithms";
    }
    if (lowerMsg.includes('python')) {
        return "Python Programming";
    }
    if (lowerMsg.includes('software engineering')) {
        return "Software Engineering";
    }
    if (lowerMsg.includes('database')) {
        return "Introduction to Database Systems";
    }
    
    // Try to extract from reservation patterns
    const reserveMatch = lowerMsg.match(/reserve\s+(.+)/i);
    if (reserveMatch) {
        const possibleTitle = reserveMatch[1].trim();
        // Check if it matches any book title
        for (const book of books) {
            if (possibleTitle.toLowerCase().includes(book.title.toLowerCase()) || 
                book.title.toLowerCase().includes(possibleTitle.toLowerCase())) {
                return book.title;
            }
        }
    }
    
    return null;
}

// Check reservation intent
function hasReservationIntent(message) {
    const lowerMsg = message.toLowerCase();
    const keywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve', 'can i get', 'i need', 'get me'];
    return keywords.some(keyword => lowerMsg.includes(keyword));
}

// Process reservation flow (uses real book data)
function processReservationFlow(message, session, sessionId, books = []) {
    const lowerMsg = message.toLowerCase().trim();
    
    // User confirms
    if (lowerMsg === 'yes' || lowerMsg.includes('correct') || lowerMsg.includes('confirm')) {
        // Find book in real data
        const book = books.find(b => b.title === session.data.bookTitle);

        if (!book) {
            const errorMessage = `Sorry, "${session.data.bookTitle}" was not found.`;
            clearSession(sessionId);
            return {
                success: false,
                reply: errorMessage,
                sessionId: null
            };
        }

        if (book.copies_available < 1) {
            const errorMessage = `"${book.title}" is currently unavailable (${book.copies_available} copies).`;
            clearSession(sessionId);
            return {
                success: false,
                reply: errorMessage,
                sessionId: null
            };
        }

        // Create successful reservation
        const reservationId = 'RES-' + Date.now();
        const successMessage = `✅ **RESERVATION CONFIRMED!**\n\n📚 **Book:** ${book.title}\n👤 **Student:** ${session.data.studentInfo.name} (${session.data.studentInfo.studentId})\n📧 **Email:** ${session.data.studentInfo.email}\n🆔 **Reservation ID:** ${reservationId}\n📅 **Pick-up by:** ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}\n📍 **Location:** ${book.location || 'UBLC Library'}\n\nPlease present your Student ID at the library counter.`;

        // Note: Real availability update happens via API call
        clearSession(sessionId);

        return {
            success: true,
            reply: successMessage,
            sessionId: null,
            reservationId: reservationId,
            reservationComplete: true,
            book: {
                id: book.bookId || book.id,
                title: book.title,
                author: book.author
            },
            student: session.data.studentInfo
        };
    } else if (lowerMsg === 'no' || lowerMsg.includes('wrong') || lowerMsg.includes('change')) {
        // User wants to correct info
        session.step = 'collecting_info';
        session.data.studentInfo = null;

        const correctionMessage = "Please provide the correct information:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**";

        return {
            success: true,
            reply: correctionMessage,
            sessionId: sessionId,
            requiresStudentInfo: true
        };
    }
    
    return null; // No match
}

module.exports = {
    generateSessionId,
    getSession,
    clearSession,
    hasReservationIntent,
    extractBookTitle,
    processReservationFlow,
    sessions
};