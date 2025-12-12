const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Updated book data (10 books now)
const books = [
  { bookId: "B001", title: "Programming in C", author: "Dennis Ritchie", copies_available: 3, location: "2nd Floor - Section A", category: "Programming" },
  { bookId: "B002", title: "Data Structures and Algorithms", author: "Robert Sedgewick", copies_available: 0, location: "2nd Floor - Section A", category: "Computer Science" },
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

    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Provide AI a clear list of available books
    const booksContext = books.map(b => `${b.title} by ${b.author} (${b.copies_available} available)`).join(', ');

    const prompt = `You are a friendly library assistant for UBLC.

Available Books: ${booksContext}

Your tasks:
- Recommend books based on student queries
- Provide book availability and details
- Detect reservation intent
- Never ask for "Reply YES"; instead, return conversational guidance
- If the student info is missing, prompt them to provide it

Student Message: "${message}"

Assistant:`; 

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiReply = response.text();

    // Detect reservation intent
    const reservationKeywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve'];
    const wantsReservation = reservationKeywords.some(k => message.toLowerCase().includes(k));

    const hasCompleteStudentInfo = student && student.studentId && student.name && student.email && student.email.includes('@');

    res.json({
      success: true,
      reply: aiReply,
      department,
      timestamp: new Date().toISOString(),
      reservationIntent: wantsReservation,
      requiresStudentInfo: !hasCompleteStudentInfo,
      requiresAction: wantsReservation && hasCompleteStudentInfo,
      actionType: wantsReservation ? 'reservation' : 'information',
      student: student || null
    });

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
