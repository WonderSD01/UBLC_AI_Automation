// server.js - Updated with correct imports
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to all requests
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5678', // n8n default port
        'http://127.0.0.1:5500',  
        'http://localhost:5500',
        'http://localhost:8080',
        'https://ublc-ai-automation-1.onrender.com', 
        'https://*.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
    }
    next();
});

// Import routes from src/routes/
const booksRouter = require('./src/routes/books');
const reserveRouter = require('./src/routes/reserve');
const geminiRouter = require('./src/routes/gemini'); // Updated gemini.js

// ONLY MOUNT GEMINI AT /api/chat (remove duplicate mounting)
app.use('/api/books', booksRouter);
app.use('/api/reserve', reserveRouter);
app.use('/api/chat', geminiRouter);    // Main chat endpoint
app.use('/api/gemini', geminiRouter);  // Keep for backward compatibility

console.log("=== UPDATED ROUTER CONFIGURATION ===");
console.log("✓ /api/chat → gemini.js (Gemini with fallback)");
console.log("✓ /api/gemini → gemini.js (Backward compatibility)");
console.log("✓ /api/gemini/gemini-only → Pure Gemini (no fallback)");
console.log("✓ /api/gemini/fallback-only → Fallback only (no Gemini)");

// Health check endpoint (for Render.com monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'UBLC Library Backend',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// System info endpoint
app.get('/api/system-info', (req, res) => {
    const info = {
        success: true,
        service: 'UBLC Library Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            google_sheets: {
                configured: !!process.env.GOOGLE_SHEET_ID,
                sheet_id: process.env.GOOGLE_SHEET_ID ? 'Configured' : 'Not configured',
                service_account: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
            },
            gemini_ai: {
                configured: !!process.env.GEMINI_API_KEY,
                key_present: process.env.GEMINI_API_KEY ? 'Yes' : 'No'
            },
            email: {
                configured: !!process.env.SENDGRID_API_KEY,
                from_email: process.env.EMAIL_FROM || 'Not configured'
            }
        },
        endpoints: {
            books: '/api/books',
            reserve: '/api/reserve',
            gemini: '/api/gemini/chat'
        }
    };
    res.json(info);
});

// Test Google Sheets connection endpoint
app.get('/api/test-sheets', async (req, res) => {
    try {
        const dataService = require('./src/services/dataService');
        const books = await dataService.readBooks();

        const response = {
            success: true,
            message: `Connected successfully. Found ${books.length} books.`,
            books_count: books.length,
            sample_books: books.slice(0, 3),
            using_mock_data: books.some(b => b.bookId === 'B001' || b.bookId === 'B002'),
            google_sheets_configured: !!process.env.GOOGLE_SHEET_ID,
            timestamp: new Date().toISOString()
        };

        res.json(response);
    } catch (error) {
        console.error('Test sheets error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to connect to Google Sheets',
            using_mock_data: true,
            timestamp: new Date().toISOString()
        });
    }
});

// Test reservation endpoint
app.post('/api/test-reservation', async (req, res) => {
    try {
        const { bookId = 'B001', studentId = 'TEST123', studentName = 'Test Student', studentEmail = 'test@ub.edu.ph' } = req.body;

        const dataService = require('./src/services/dataService');

        // Check book availability
        const books = await dataService.readBooks();
        const book = books.find(b => b.bookId === bookId);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: `Book ${bookId} not found`
            });
        }

        res.json({
            success: true,
            message: 'Reservation test endpoint',
            book: {
                id: book.bookId,
                title: book.title,
                available_copies: book.copies_available,
                can_reserve: book.copies_available > 0
            },
            student: {
                id: studentId,
                name: studentName,
                email: studentEmail
            },
            test_data: {
                google_sheets_id: process.env.GOOGLE_SHEET_ID || 'Not configured',
                service_account: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Configured' : 'Not configured'
            }
        });
    } catch (error) {
        console.error('Test reservation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test Gemini API endpoint
app.get('/api/test-gemini', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Say 'UBLC Library API test successful'"
                    }]
                }]
            })
        });

        const data = await response.json();

        res.json({
            success: response.ok,
            status: response.status,
            message: response.ok ? 'Gemini API is working' : 'Gemini API failed',
            response: data.candidates?.[0]?.content?.parts?.[0]?.text || data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'UBLC Library Backend API',
        version: '1.0.0',
        endpoints: {
            books: '/api/books - GET books list',
            reserve: '/api/reserve - POST make reservation',
            gemini_chat: '/api/gemini/chat - POST AI chat',
            gemini_test: '/api/test-gemini - GET test Gemini API',
            health: '/health - GET system health',
            info: '/api/system-info - GET system information',
            test_sheets: '/api/test-sheets - GET test Google Sheets connection'
        },
        documentation: 'See README.md for API documentation',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requested_url: req.url,
        method: req.method,
        available_endpoints: [
            'GET /',
            'GET /health',
            'GET /api/system-info',
            'GET /api/books',
            'POST /api/reserve',
            'POST /api/gemini/chat',
            'POST /api/chat', 
            'GET /api/test-sheets',
            'GET /api/test-gemini'
        ]
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 UBLC Library Backend Server Started!
=========================================
🌐 Server URL: http://localhost:${PORT}
📊 Google Sheets: ${process.env.GOOGLE_SHEET_ID ? '✅ Configured' : '❌ NOT CONFIGURED'}
🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ NOT CONFIGURED'}
📧 Email Service: ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ NOT CONFIGURED'}

Available Endpoints:
GET /                    - API Information
GET /health              - Health Check
GET /api/system-info     - System Information
GET /api/books           - List all books
POST /api/reserve        - Make reservation
POST /api/gemini/chat    - AI Chat endpoint
GET /api/test-sheets     - Test Google Sheets
GET /api/test-gemini     - Test Gemini API

Environment: ${process.env.NODE_ENV || 'development'}
Started: ${new Date().toISOString()}
`);

    // Log warning if using mock data
    if (!process.env.GOOGLE_SHEET_ID) {
        console.warn('\n⚠️ WARNING: Google Sheets not configured. Using mock data.');
        console.warn('  Set GOOGLE_SHEET_ID in .env file to use real Google Sheets.\n');
    }
});