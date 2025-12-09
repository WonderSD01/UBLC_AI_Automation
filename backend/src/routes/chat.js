const express = require('express');
const router = express.Router();

// Simple in-memory session store
const sessions = {};

// Book data matching your server.js
const mockBooks = [
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
    title: "Introduction to Database Systems",
    author: "C.J. Date",
    copies_available: 3,
    location: "2nd Floor - Section B",
    category: "Database"
  },
  {
    bookId: "B004",
    title: "Computer Networks",
    author: "Andrew Tanenbaum",
    copies_available: 5,
    location: "2nd Floor - Section B",
    category: "Networking"
  },
  {
    bookId: "B005",
    title: "Artificial Intelligence",
    author: "Stuart Russell",
    copies_available: 7,
    location: "3rd Floor - Section C",
    category: "AI/ML"
  },
  {
    bookId: "B006",
    title: "Web Development Fundamentals",
    author: "Jon Duckett",
    copies_available: 5,
    location: "2nd Floor - Section A",
    category: "Web Development"
  },
  {
    bookId: "B007",
    title: "Operating Systems Concepts",
    author: "Abraham Silberschatz",
    copies_available: 4,
    location: "2nd Floor - Section B",
    category: "Operating Systems"
  },
  {
    bookId: "B008",
    title: "Software Engineering",
    author: "Ian Sommerville",
    copies_available: 9,
    location: "3rd Floor - Section C",
    category: "Software Engineering"
  },
  {
    bookId: "B009",
    title: "Python Programming",
    author: "Mark Lutz",
    copies_available: 9,
    location: "2nd Floor - Section A",
    category: "Programming"
  },
  {
    bookId: "B010",
    title: "Machine Learning Basics",
    author: "Andriy Burkov",
    copies_available: 8,
    location: "3rd Floor - Section C",
    category: "AI/ML"
  }
];

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

// Extract book title from message
function extractBookTitle(message) {
  const lowerMsg = message.toLowerCase();
  for (const book of mockBooks) {
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
  
  return null;
}

// Check reservation intent
function hasReservationIntent(message) {
  const lowerMsg = message.toLowerCase();
  const keywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve', 'can i get', 'i need', 'get me'];
  return keywords.some(keyword => lowerMsg.includes(keyword));
}

// Get fallback response (when Gemini fails)
function getFallbackResponse(message, session = null) {
  const lowerMsg = message.toLowerCase();
  
  // If in reservation flow, handle it
  if (session && session.currentFlow === 'reservation') {
    if (session.step === 'collecting_info') {
      return `To reserve "${session.data.bookTitle}", I need:
* **Student ID:**
* **Full Name:**
* **Email Address:**`;
    }
    if (session.step === 'awaiting_confirmation') {
      return `Please confirm: Is your information correct?
Student: ${session.data.studentInfo.name}
ID: ${session.data.studentInfo.studentId}
Email: ${session.data.studentInfo.email}

Reply "yes" to confirm or "no" to correct.`;
    }
  }
  
  // General fallback responses
  if (hasReservationIntent(lowerMsg)) {
    const bookTitle = extractBookTitle(message);
    if (bookTitle) {
      return `I can help you reserve "${bookTitle}"! Please provide your:
1. Student ID
2. Full Name
3. Email Address`;
    }
    return "Which book would you like to reserve?";
  }
  
  if (lowerMsg.includes('programming') || lowerMsg.includes('code')) {
    return "We have programming books: Programming in C, Python Programming, Data Structures, and more.";
  }
  
  if (lowerMsg.includes('hour') || lowerMsg.includes('time') || lowerMsg.includes('open')) {
    return "Library hours: Mon-Fri 8AM-5PM, Sat 9AM-12PM, Closed Sunday.";
  }
  
  if (lowerMsg.includes('book') || lowerMsg.includes('available') || lowerMsg.includes('catalog')) {
    return "We have books in: Programming, Computer Science, Database, Networking, AI/ML, Web Development, Operating Systems, and Software Engineering.";
  }
  
  return "I can help with book reservations, library information, and book searches. What would you like to know?";
}

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

    // ============================================
    // SESSION MANAGEMENT
    // ============================================
    const currentSessionId = sessionId || generateSessionId();
    const session = getSession(currentSessionId);
    
    // Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    console.log(`📝 Session ${currentSessionId}: Flow=${session.currentFlow}, Step=${session.step}, Book=${session.data.bookTitle || 'none'}`);

    // ============================================
    // RESERVATION FLOW HANDLING
    // ============================================

    // CASE 1: Already in reservation flow
    if (session.currentFlow === 'reservation') {
      
      // STEP 1A: Collecting student info
      if (session.step === 'collecting_info') {
        if (student && student.studentId && student.name && student.email) {
          // Valid student info received
          session.data.studentInfo = student;
          session.step = 'awaiting_confirmation';
          
          const confirmationMessage = `✅ Thank you, ${student.name}!\n\nI have your request to reserve **"${session.data.bookTitle}"**.\n\n**Please confirm your details:**\n• Student ID: ${student.studentId}\n• Full Name: ${student.name}\n• Email: ${student.email}\n\nIs this correct? (Reply "yes" to confirm or "no" to correct)`;
          
          session.conversationHistory.push({
            role: 'assistant',
            content: confirmationMessage,
            timestamp: new Date().toISOString()
          });

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
          // Still need student info
          const infoRequest = `📚 To reserve **"${session.data.bookTitle}"**, I need:\n\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**\n\nPlease provide this information.`;
          
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
      
      // STEP 1B: Awaiting confirmation
      if (session.step === 'awaiting_confirmation') {
        const lowerMessage = message.toLowerCase().trim();
        
        // User confirms
        if (lowerMessage === 'yes' || lowerMessage.includes('correct') || lowerMessage.includes('confirm')) {
          // Process reservation
          const book = mockBooks.find(b => b.title === session.data.bookTitle);
          
          if (!book) {
            const errorMessage = `❌ Sorry, "${session.data.bookTitle}" was not found.`;
            clearSession(currentSessionId);
            return res.json({
              success: false,
              reply: errorMessage,
              sessionId: null,
              timestamp: new Date().toISOString()
            });
          }
          
          if (book.copies_available < 1) {
            const errorMessage = `❌ "${book.title}" is currently unavailable (${book.copies_available} copies).`;
            clearSession(currentSessionId);
            return res.json({
              success: false,
              reply: errorMessage,
              sessionId: null,
              timestamp: new Date().toISOString()
            });
          }
          
          // Create successful reservation
          const reservationId = 'RES-' + Date.now();
          const successMessage = `🎉 **RESERVATION CONFIRMED!**\n\n📚 **Book:** ${book.title}\n👤 **Student:** ${session.data.studentInfo.name} (${session.data.studentInfo.studentId})\n📧 **Email:** ${session.data.studentInfo.email}\n🔢 **Reservation ID:** ${reservationId}\n📅 **Pick-up by:** ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}\n📍 **Location:** ${book.location}\n\n✅ Please present your Student ID at the library counter.`;
          
          // Update book availability (in mock data)
          book.copies_available -= 1;
          
          // Clear session
          clearSession(currentSessionId);
          
          return res.json({
            success: true,
            reply: successMessage,
            sessionId: null,
            reservationId: reservationId,
            reservationComplete: true,
            book: {
              id: book.bookId,
              title: book.title,
              author: book.author
            },
            student: session.data.studentInfo,
            timestamp: new Date().toISOString()
          });
          
        } else if (lowerMessage === 'no' || lowerMessage.includes('wrong') || lowerMessage.includes('change')) {
          // User wants to correct info
          session.step = 'collecting_info';
          session.data.studentInfo = null;
          
          const correctionMessage = "Please provide the correct information:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**";
          
          return res.json({
            success: true,
            reply: correctionMessage,
            sessionId: currentSessionId,
            requiresStudentInfo: true,
            timestamp: new Date().toISOString()
          });
        }
        // If not yes/no, continue to normal response
      }
    }

    // ============================================
    // NEW RESERVATION DETECTION
    // ============================================

    if (hasReservationIntent(message)) {
      const bookTitle = extractBookTitle(message);
      
      if (bookTitle) {
        // Start new reservation flow
        session.currentFlow = 'reservation';
        session.step = 'collecting_info';
        session.data.bookTitle = bookTitle;
        session.data.studentInfo = null;
        
        const book = mockBooks.find(b => b.title === bookTitle);
        const infoRequest = `📚 I can reserve **"${bookTitle}"** for you!\n\nFirst, I need:\n1. **Student ID:**\n2. **Full Name:**\n3. **Email Address:**\n\n${book ? `✅ ${book.copies_available} copies available` : ''}`;
        
        session.conversationHistory.push({
          role: 'assistant',
          content: infoRequest,
          timestamp: new Date().toISOString()
        });

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
        // Reservation intent but no book specified
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
    // REGULAR CHAT (NON-RESERVATION)
    // ============================================

    // Use fallback response (simpler than Gemini for testing)
    const fallbackReply = getFallbackResponse(message, session);
    
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
    console.error("Chat error:", error);
    
    // Ultimate fallback
    return res.json({
      success: true,
      reply: "I'm here to help with UBLC library services! How can I assist you today?",
      sessionId: null,
      timestamp: new Date().toISOString(),
      source: 'error-recovery'
    });
  }
});

// Session cleanup endpoint
router.post('/clear-session', (req, res) => {
  const { sessionId } = req.body;
  clearSession(sessionId);
  res.json({ 
    success: true, 
    message: 'Session cleared',
    timestamp: new Date().toISOString()
  });
});

// Session info endpoint (for debugging)
router.get('/session-info/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];
  
  if (!session) {
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