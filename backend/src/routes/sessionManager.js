
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

    // 1️⃣ Step: collecting student info
    if (session.step === "collecting_info") {
        const match = message.match(/(\d+),\s*(.*?),\s*([\w.-]+@[\w.-]+\.\w+)/);
        if (!match) {
            return {
                success: false,
                reply: "Please provide your details in this format:\n\n**ID, Full Name, Email**"
            };
        }

        session.data.studentInfo = {
            studentId: match[1],
            name: match[2],
            email: match[3]
        };

        session.step = "awaiting_confirmation";

        return {
            success: true,
            reply: `Please confirm your reservation:\n\nStudent: ${session.data.studentInfo.name}\nID: ${session.data.studentInfo.studentId}\nEmail: ${session.data.studentInfo.email}\nBook: ${session.data.bookTitle}\n\nReply **yes** to confirm or **no** to update your information.`,
            requiresConfirmation: true
        };
    }

    // 2️⃣ Step: awaiting confirmation
    if (session.step === "awaiting_confirmation") {
        if (lowerMsg === "yes") {
            const book = books.find(b => b.title === session.data.bookTitle);

            if (!book) {
                clearSession(sessionId);
                return {
                    success: false,
                    reply: `Sorry, I cannot find the book "${session.data.bookTitle}".`
                };
            }

            if (book.copies_available < 1) {
                clearSession(sessionId);
                return {
                    success: false,
                    reply: `Sorry, "${book.title}" is currently unavailable.`
                };
            }

            const reservationId = "RES-" + Date.now();

            const successMessage = 
                `✅ **RESERVATION CONFIRMED!**\n\n` +
                `📚 Book: ${book.title}\n` +
                `👤 Student: ${session.data.studentInfo.name}\n` +
                `🆔 Student ID: ${session.data.studentInfo.studentId}\n` +
                `📧 Email: ${session.data.studentInfo.email}\n` +
                `🆔 Reservation ID: ${reservationId}\n` +
                `📅 Pick-up by: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}`;

            clearSession(sessionId);

            return {
                success: true,
                reply: successMessage,
                reservationComplete: true,
                reservationId: reservationId
            };
        }

        if (lowerMsg === "no") {
            session.step = "collecting_info";
            session.data.studentInfo = null;

            return {
                success: true,
                reply: "Okay! Please send your correct details in this format:\n\n**ID, Full Name, Email**",
                requiresStudentInfo: true
            };
        }

        return {
            success: true,
            reply: `Please reply **yes** to confirm or **no** to update your information.`,
            requiresConfirmation: true
        };
    }

    return null;
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
