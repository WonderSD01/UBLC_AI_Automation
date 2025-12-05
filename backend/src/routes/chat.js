const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple book data
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
  }
];

router.post('/', async (req, res) => {
  try {
    const { message, student, department = 'library' } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });

    const booksContext = mockBooks.map(book => 
      `${book.title} by ${book.author} (${book.copies_available} available)`
    ).join(', ');

    const prompt = `You are an intelligent library assistant for UBLC (University of Batangas Lipa Campus).

Available Books: ${booksContext}

Your capabilities:
- Search and recommend books based on student needs
- Check availability and provide book details
- Help students understand library procedures

Guidelines:
- Be friendly, helpful, and conversational
- When students ask about books, check the available books list above
- Always mention how many copies are available
- If a book is not in the list, suggest similar available books
- For reservations, guide them to use the reservation system
- Provide helpful suggestions based on their interests

Current query: ${message}

Assistant:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiReply = response.text();

    // Check reservation intent
    const reservationKeywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve'];
    const shouldReserve = reservationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Check if student info is complete
    const hasCompleteStudentInfo = student && 
      student.studentId && 
      student.name && 
      student.email && 
      student.email.includes('@');

    const responseData = {
      success: true,
      reply: aiReply,
      department: department,
      timestamp: new Date().toISOString(),
      reservationIntent: shouldReserve,
      requiresStudentInfo: !hasCompleteStudentInfo,
      requiresAction: shouldReserve && hasCompleteStudentInfo,
      actionType: shouldReserve ? 'reservation' : 'information'
    };

    if (student) {
      responseData.student = student;
    }

    res.json(responseData);

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Keep your other routes if you have them
router.post('/n8n-webhook', async (req, res) => {
  // ... your n8n webhook code
});

module.exports = router;