const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple book data (replace with your actual data service later)
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

// Function to search books
function searchBooks(query) {
  const searchTerm = query.toLowerCase();
  return mockBooks.filter(book => 
    book.title.toLowerCase().includes(searchTerm) ||
    book.author.toLowerCase().includes(searchTerm) ||
    book.category.toLowerCase().includes(searchTerm)
  );
}

// Function to get book details
function getBookDetails(identifier) {
  return mockBooks.find(book => 
    book.bookId.toLowerCase() === identifier.toLowerCase() ||
    book.title.toLowerCase().includes(identifier.toLowerCase())
  );
}

// Function to get all books
function getAllBooks() {
  return mockBooks;
}

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

    // Create a context with book information
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

    // Check if this should trigger a reservation (simple keyword detection)
    const shouldReserve = message.toLowerCase().includes('reserve') || 
                         message.toLowerCase().includes('borrow') ||
                         message.toLowerCase().includes('check out');

    const responseData = {
      success: true,
      reply: aiReply,
      department: department,
      timestamp: new Date().toISOString(),
      requiresAction: shouldReserve,
      actionType: shouldReserve ? 'reservation' : 'information'
    };

    // Add student info if provided
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

// Additional endpoint for n8n integration
router.post('/n8n-webhook', async (req, res) => {
  try {
    const { userMessage, intent, bookTitle, department } = req.body;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });

    let context = "You are UBLC Library Assistant. Help with book searches, availability, and library information.";

    // Add context based on intent from n8n
    if (intent === 'check_availability' && bookTitle) {
      const book = getBookDetails(bookTitle);
      if (book) {
        context += ` The user is asking about "${bookTitle}". It is ${book.copies_available > 0 ? 'available' : 'not available'} with ${book.copies_available} copies. Location: ${book.location}.`;
      }
    }

    const prompt = `${context}\n\nUser: ${userMessage}\nAssistant:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiReply = response.text();

    res.json({
      success: true,
      reply: aiReply,
      intent: intent,
      bookTitle: bookTitle,
      department: department || 'library',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("N8N webhook error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;