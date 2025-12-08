const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const emailService = require('../services/emailService');

// POST /api/reserve - Make a reservation
router.post('/', async (req, res) => {
  try {
    const { bookId, studentId, studentName, studentEmail, bookTitle } = req.body;

    console.log('📋 Reservation request received:', {
      bookId,
      studentId,
      studentName,
      studentEmail,
      bookTitle
    });

    // VALIDATE REQUIRED FIELDS
    if (!bookId || !studentId || !studentName || !studentEmail) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        error: 'bookId, studentId, studentName, and studentEmail are required' 
      });
    }

    // Validate email format
    if (!studentEmail.includes('@') || !studentEmail.includes('.')) {
      console.error('❌ Invalid email format:', studentEmail);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format' 
      });
    }

    // Get book details
    const books = await dataService.readBooks();
    const book = books.find(b => b.bookId === bookId);
    
    if (!book) {
      console.error(`❌ Book not found: ${bookId}`);
      return res.status(404).json({ 
        success: false,
        error: 'Book not found' 
      });
    }

    // Check availability
    if (book.copies_available <= 0) {
      console.error(`❌ No copies available for book: ${bookId}`);
      return res.status(400).json({ 
        success: false,
        error: 'No copies available' 
      });
    }

    // Generate reservation ID
    const reservationId = `RES-${Date.now()}`;

    // Create reservation object
    const reservation = {
      reservationId,
      bookId,
      title: book.title || bookTitle,
      studentId,
      studentName,
      studentEmail,
      timestamp: new Date().toISOString(),
      status: 'reserved'
    };

    console.log('📝 Creating reservation:', reservation);

    // Decrement available copies
    try {
      const copyUpdated = await dataService.decrementCopy(bookId);
      if (!copyUpdated) {
        throw new Error('Failed to update book availability');
      }
    } catch (decrementError) {
      console.error('❌ Error decrementing copy:', decrementError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update book availability'
      });
    }

    // Log reservation
    try {
      await dataService.logReservation(reservation);
    } catch (logError) {
      console.error('⚠️ Error logging reservation (continuing):', logError.message);
      // Continue even if logging fails
    }

    // Send email confirmation
    let emailStatus = 'sent';
    try {
      await emailService.sendReservationEmail(studentEmail, {
        reservationId,
        bookTitle: book.title,
        author: book.author,
        location: book.location,
        studentName: studentName,
        studentId: studentId,
        pickupDeadline: '3 days'
      });
    } catch (emailErr) {
      console.warn('⚠️ Failed to send email:', emailErr.message);
      emailStatus = 'failed';
    }

    // Log for n8n integration
    console.log('✅ Reservation created successfully:', {
      reservationId: reservationId,
      bookId: bookId,
      title: book.title,
      studentName: studentName,
      studentEmail: studentEmail,
      timestamp: new Date().toISOString(),
      emailStatus: emailStatus,
      status: 'reserved'
    });

    // Return success response
    res.json({
      success: true,
      reservationId,
      message: `Successfully reserved "${book.title}"`,
      details: {
        bookId,
        bookTitle: book.title,
        author: book.author,
        location: book.location,
        studentId,
        studentName,
        studentEmail,
        reservationDate: new Date().toISOString(),
        emailStatus,
        pickupNote: 'Please pick up within 3 days at the library front desk'
      }
    });

  } catch (err) {
    console.error('❌ POST /api/reserve error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: err.message 
    });
  }
});

// GET /api/reserve - Get reservation info
router.get('/', async (req, res) => {
  try {
    // Optional: Get recent reservations
    const reservations = await dataService.getReservations();
    
    res.json({ 
      success: true,
      message: 'UBLC Library Reservation System',
      instructions: 'Send POST request with bookId, studentId, studentName, and studentEmail',
      example: {
        method: 'POST',
        url: '/api/reserve',
        body: {
          bookId: 'B001',
          studentId: '2220123',
          studentName: 'Maria Santos',
          studentEmail: '2220123@ub.edu.ph'
        }
      },
      recentReservations: reservations.slice(-5), // Last 5 reservations
      note: 'Integrated with n8n workflow automation and Google Sheets'
    });
  } catch (err) {
    console.error('GET /api/reserve error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET /api/reserve/:id - Get specific reservation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reservations = await dataService.getReservations();
    const reservation = reservations.find(r => r.reservationId === id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }
    
    res.json({
      success: true,
      reservation: reservation
    });
  } catch (err) {
    console.error('GET /api/reserve/:id error:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// NEW: POST /api/reserve/batch - For n8n batch processing
router.post('/batch', async (req, res) => {
  try {
    const { reservations } = req.body;
    
    if (!Array.isArray(reservations)) {
      return res.status(400).json({
        success: false,
        error: 'reservations array is required'
      });
    }

    const results = [];
    
    for (const reservation of reservations) {
      try {
        const result = await dataService.decrementCopy(reservation.bookId);
        results.push({
          bookId: reservation.bookId,
          success: result,
          message: result ? 'Updated successfully' : 'Failed to update'
        });
      } catch (error) {
        results.push({
          bookId: reservation.bookId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results: results,
      message: `Processed ${reservations.length} reservations`
    });
    
  } catch (err) {
    console.error('POST /api/reserve/batch error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;