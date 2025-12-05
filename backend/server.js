require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');


// Create Express app
const app = express();


// Manual CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
 
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});


app.use(express.json({ limit: '10mb' }));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);


// Import routes
const chatRoutes = require('./src/routes/chat');
const booksRoutes = require('./src/routes/books');
const reserveRoutes = require('./src/routes/reserve');
const geminiRoutes = require('./src/routes/gemini');


// Use routes
app.use('/api/chat', chatRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/reserve', reserveRoutes);
app.use('/api/gemini', geminiRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'UBLC AI Automation Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    config: {
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      sendgrid: !!process.env.SENDGRID_API_KEY,
      sheets: !!process.env.GOOGLE_SHEET_ID
    }
  });
});


// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to UBLC AI Automation System',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      books: '/api/books',
      reserve: '/api/reserve',
      gemini: '/api/gemini/chat',
      chat: '/api/chat'
    }
  });
});


// FIXED 404 handler - Use a simple middleware without '*'
app.use((req, res, next) => {
  // If no routes have handled the request, it's a 404
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      availableEndpoints: [
        'GET /',
        'GET /api/health',
        'GET /api/books',
        'POST /api/chat',
        'POST /api/reserve',
        'POST /api/gemini/chat'
      ]
    });
  }
});


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 UBLC Backend running on  https://ublc-ai-automation-1.onrender.com`);
  console.log('\n📋 Configuration Check:');
  console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
  console.log(`   Gemini: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  console.log(`   SendGrid: ${process.env.SENDGRID_API_KEY ? '✅' : '❌'}`);
  console.log(`   Google Sheets: ${process.env.GOOGLE_SHEET_ID ? '✅' : '❌'}`);
 
  console.log('\n🔗 Available Endpoints:');
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Chat API: https://ublc-ai-automation-1.onrender.com/api/gemini/chat`);
  console.log(`   Books API: https://ublc-ai-automation-1.onrender.com/api/books`);
  console.log(`   Reserve API: https://ublc-ai-automation-1.onrender.com/api/reserve`);
  console.log(`   Gemini API: http://localhost:${PORT}/api/gemini/chat`);
  console.log('\n💡 Tip: Test with: curl http://localhost:3000/api/health\n');
});
