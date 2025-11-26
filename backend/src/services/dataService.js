const { google } = require('googleapis');
require('dotenv').config();

// Mock data for fallback
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

let mockReservations = [];

// Simple function to read from public Google Sheet
async function readBooks() {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    console.log('📚 Using mock data - Google Sheet ID not configured');
    return mockBooks;
  }

  try {
    console.log('📊 Reading from public Google Sheet...');
    
    const sheets = google.sheets({ version: 'v4' });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Books!A2:F',
      // No auth needed for public sheets
    });

    const rows = response.data.values || [];
    console.log(`📊 Found ${rows.length} rows in Google Sheets`);

    if (rows.length === 0) {
      console.log('📚 Google Sheets empty, using mock data');
      return mockBooks;
    }

    const books = rows.map(row => ({
      bookId: row[0] || '',
      title: row[1] || '',
      author: row[2] || '',
      copies_available: parseInt(row[3]) || 0,
      location: row[4] || '',
      category: row[5] || ''
    }));

    console.log(`✅ Successfully loaded ${books.length} books from Google Sheets`);
    return books;

  } catch (error) {
    console.error('❌ Google Sheets error:', error.message);
    console.log('📚 Falling back to mock data');
    return mockBooks;
  }
}

// Keep all your other functions the same...
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

async function decrementCopy(bookId) {
  try {
    const books = await readBooks();
    const book = books.find(b => b.bookId === bookId);
    if (!book) throw new Error(`Book not found: ${bookId}`);
    if (book.copies_available <= 0) return false;
    book.copies_available--;
    return true;
  } catch (error) {
    console.error('Error decrementing copy:', error.message);
    throw error;
  }
}

async function logReservation(reservationData) {
  mockReservations.push({
    ...reservationData,
    timestamp: new Date().toISOString()
  });
  console.log(`✅ Reservation logged: ${reservationData.reservationId}`);
  return true;
}

async function getBookById(bookId) {
  const books = await readBooks();
  return books.find(book => book.bookId === bookId);
}

module.exports = {
  readBooks,
  findBooksByQuery,
  getBookById,
  decrementCopy,
  logReservation
};