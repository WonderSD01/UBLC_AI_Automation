const { google } = require('googleapis');
require('dotenv').config();

// Google Sheets configuration
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Check if we have valid Google credentials
const hasValidGoogleCredentials = () => {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
         process.env.GOOGLE_PRIVATE_KEY && 
         process.env.GOOGLE_SHEET_ID;
};

// Read all books from Google Sheets
async function readBooks() {
  if (!hasValidGoogleCredentials()) {
    throw new Error('Google Sheets credentials not configured');
  }

  try {
    console.log('📊 Reading books from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Books!A2:F',
    });

    const rows = response.data.values || [];
    const books = rows.map(row => ({
      bookId: row[0] || '',
      title: row[1] || '',
      author: row[2] || '',
      copies_available: parseInt(row[3]) || 0,
      location: row[4] || '',
      category: row[5] || ''
    }));

    console.log(`✅ Loaded ${books.length} books from Google Sheets`);
    return books;

  } catch (error) {
    console.error('❌ Google Sheets error:', error.message);
    throw new Error(`Failed to read from Google Sheets: ${error.message}`);
  }
}

// Search books by query
async function findBooksByQuery(q) {
  if (!q) return [];
  const books = await readBooks();
  const searchTerm = q.toLowerCase();
  return books.filter(book =>
    (book.title && book.title.toLowerCase().includes(searchTerm)) ||
    (book.author && book.author.toLowerCase().includes(searchTerm)) ||
    (book.bookId && book.bookId.toLowerCase() === searchTerm) ||
    (book.category && book.category.toLowerCase().includes(searchTerm))
  );
}

// Decrement book copy count when reserved
async function decrementCopy(bookId) {
  try {
    const books = await readBooks();
    const bookIndex = books.findIndex(b => b.bookId === bookId);

    if (bookIndex === -1) {
      throw new Error(`Book not found: ${bookId}`);
    }

    if (books[bookIndex].copies_available <= 0) {
      console.log(`❌ No copies available for ${bookId}`);
      return false;
    }

    // Decrement the copy count
    books[bookIndex].copies_available -= 1;

    // Update in Google Sheets
    await updateBookInSheets(books[bookIndex], bookIndex + 2); // +2 for header row

    console.log(`✅ Decremented copy for ${bookId}. New count: ${books[bookIndex].copies_available}`);
    return true;
  } catch (error) {
    console.error('Error decrementing copy:', error.message);
    throw error;
  }
}

// Update single book in Google Sheets
async function updateBookInSheets(book, rowIndex) {
  const values = [
    [
      book.bookId,
      book.title,
      book.author,
      book.copies_available,
      book.location,
      book.category
    ]
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Books!A${rowIndex}:F${rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values }
  });
}

// Log reservation to Google Sheets
async function logReservation(reservationData) {
  try {
    const timestamp = new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const values = [
      [
        reservationData.reservationId,
        reservationData.bookId,
        reservationData.title || 'N/A',
        reservationData.studentName,
        reservationData.studentEmail,
        timestamp,
        'Active'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Reservations!A:G',
      valueInputOption: 'RAW',
      resource: { values }
    });

    console.log('✅ Reservation logged to Google Sheets');
    return true;
  } catch (error) {
    console.error('Error logging reservation:', error.message);
    throw error;
  }
}

// Get book by ID
async function getBookById(bookId) {
  const books = await readBooks();
  return books.find(book => book.bookId === bookId);
}

// Mock functions for compatibility
async function writeBooks(books) {
  console.log('📝 Would write books to Google Sheets');
  return true;
}

module.exports = {
  readBooks,
  writeBooks,
  findBooksByQuery,
  getBookById,
  decrementCopy,
  logReservation
};