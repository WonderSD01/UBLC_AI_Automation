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

    const prompt = `You are an intelligent library assistant...`; // Your existing prompt

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiReply = response.text();

    // === FIXED CODE BELOW ===
    // Check reservation intent
    const reservationKeywords = ['reserve', 'borrow', 'check out', 'book me', 'i want to reserve'];
    const shouldReserve = reservationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)  // 'message' is defined above from req.body
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
      // CRITICAL: Add these for n8n workflow
      reservationIntent: shouldReserve,
      requiresStudentInfo: !hasCompleteStudentInfo,
      // For backward compatibility
      requiresAction: shouldReserve && hasCompleteStudentInfo,
      actionType: shouldReserve ? 'reservation' : 'information'
    };

    // Add student info if provided
    if (student) {
      responseData.student = student;
    }

    res.json(responseData);
    // === END FIXED CODE ===

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