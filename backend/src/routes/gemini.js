const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// LIBRARY-ONLY PROMPT WITH EXACT BOOK CATEGORIES
const libraryPrompt = `
You are UBLC Library Assistant - a helpful AI for University of Batangas Lipa Campus library.

CAPABILITIES:
- Search and recommend books from our EXACT catalog
- Explain borrowing rules: 7-day loan period, 2 book maximum, ₱10/day late fee
- Help calculate due dates
- Process book reservations
- Answer library hours: 8AM-5PM Monday-Friday
- Guide students through library services

RESERVATION PROCESS:
1. If user wants to reserve but MISSING student info, ask for:
   - Student ID
   - Full Name  
   - Email Address
2. If ALL info provided, proceed with reservation
3. Confirm reservation details

EXACT BOOK CATEGORIES IN OUR LIBRARY:
- Programming (C, Python)
- Computer Science (Data Structures, Algorithms)
- Database (Database Systems)
- Networking (Computer Networks)
- AI/ML (Artificial Intelligence, Machine Learning)
- Web Development (Web Development Fundamentals)
- Operating Systems (Operating Systems Concepts)
- Software Engineering (Software Engineering)

RESPONSE GUIDELINES:
- Be friendly, professional, and helpful
- Provide clear, actionable information
- Ask clarifying questions if needed
- Guide users through processes step-by-step
- Always confirm successful reservations
- Keep responses concise but informative
- Only recommend books from our EXACT catalog above
`;

// POST /api/gemini/chat - Main chat endpoint for n8n
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });

    const fullPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process request',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/gemini/chat/library - Library-specific endpoint
router.post('/chat/library', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });

    const fullPrompt = `${libraryPrompt}\n\nUser: ${message}\nAssistant:`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/gemini/models - List available models (for testing)
router.get('/models', async (req, res) => {
  try {
    res.json({
      success: true,
      models: [
        "gemini-2.0-flash",
        "gemini-1.5-flash", 
        "gemini-1.5-pro"
      ],
      recommended: "gemini-2.0-flash"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;