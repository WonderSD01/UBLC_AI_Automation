const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Full book list (replace mockBooks with all 10 if you want)
const books = [
  { bookId: "B001", title: "Programming in C", author: "Dennis Ritchie", copies_available: 5, location: "2nd Floor - Section A", category: "Programming" },
  { bookId: "B002", title: "Data Structures and Algorithms", author: "Robert Sedgewick", copies_available: 3, location: "2nd Floor - Section A", category: "Computer Science" },
  { bookId: "B003", title: "Introduction to Database Systems", author: "C.J. Date", copies_available: 3, location: "2nd Floor - Section B", category: "Database" },
  { bookId: "B004", title: "Computer Networks", author: "Andrew Tanenbaum", copies_available: 5, location: "2nd Floor - Section B", category: "Networking" },
  { bookId: "B005", title: "Artificial Intelligence", author: "Stuart Russell", copies_available: 7, location: "3rd Floor - Section C", category: "AI/ML" },
  { bookId: "B006", title: "Web Development Fundamentals", author: "Jon Duckett", copies_available: 5, location: "2nd Floor - Section A", category: "Web Development" },
  { bookId: "B007", title: "Operating Systems Concepts", author: "Abraham Silberschatz", copies_available: 4, location: "2nd Floor - Section B", category: "Operating Systems" },
  { bookId: "B008", title: "Software Engineering", author: "Ian Sommerville", copies_available: 9, location: "3rd Floor - Section C", category: "Software Engineering" },
  { bookId: "B009", title: "Python Programming", author: "Mark Lutz", copies_available: 9, location: "2nd Floor - Section A", category: "Programming" },
  { bookId: "B010", title: "Machine Learning Basics", author: "Andriy Burkov", copies_available: 8, location: "3rd Floor - Section C", category: "AI/ML" }
];

router.post('/', async (req, res) => {
  try {
    const { message, student, department = 'library' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Provide the full book list in context
    const booksContext = books.map(book => 
      `${book.title} by ${book.author} (${book.copies_available} available)`
    ).join(', ');

    // Fixed AI prompt: no "Reply YES", always use provided student info
    const prompt = `You are a friendly and helpful UBLC library assistant.

Available Books: ${booksContext}

Instructions:
- Suggest books and show availability
- Help with reservations using the student info provided
- Do NOT ask the user to confirm with "Reply YES"
- If a student wants to reserve, guide them politely and conversationally
- Provide clear instructions and be concise

Student Message: "${message}"

Assistant:`;

    const result = await model.generateContent(prompt);
    let aiReply = (await result.response).text();

    // Sanitize AI response: remove any leftover "Confirm … Reply YES"
    aiReply = aiReply.replace(/Confirm:.*Reply\s+YES/gi, '').trim();

    // Detect reservation intent
    const reservationKeywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve'];
    const shouldReserve = reservationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Check if student info is complete
    const hasCompleteStudentInfo = student && student.studentId && student.name && student.email && student.email.includes('@');

    // Prepare response to frontend
    const responseData = {
      success: true,
      reply: aiReply,
      department,
      timestamp: new Date().toISOString(),
      reservationIntent: shouldReserve,
      requiresStudentInfo: !hasCompleteStudentInfo,
      requiresAction: shouldReserve && hasCompleteStudentInfo,
      actionType: shouldReserve ? 'reservation' : 'information'
    };

    if (student) responseData.student = student;

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

module.exports = router;
