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

// Function to read from Google Sheet with Service Account
async function readBooks() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  console.log('🔍 DEBUG: Sheet ID:', sheetId);
  console.log('🔍 DEBUG: Service Email configured:', !!serviceEmail);
  console.log('🔍 DEBUG: Private Key configured:', !!privateKey);

  if (!sheetId || !serviceEmail || !privateKey) {
    console.log('❌ Missing Google Sheets credentials');
    return mockBooks;
  }

  try {
    console.log('📊 Reading from Google Sheet with Service Account...');
    
    // Clean the private key
    const cleanPrivateKey = privateKey
      .replace(/\\n/g, '\n')
      .replace(/^"|"$/g, '')
      .trim();

    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID || 'ublc-library-system',
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || 'auto-generated',
        private_key: cleanPrivateKey,
        client_email: serviceEmail,
        client_id: process.env.GOOGLE_CLIENT_ID || 'auto-generated',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Books!A2:F',
    });

    console.log('✅ Google Sheets API response received');
    const rows = response.data.values || [];
    console.log(`📊 Found ${rows.length} rows in Google Sheets`);

    if (rows.length === 0) {
      console.log('❌ Google Sheets is EMPTY - no data found');
      return mockBooks;
    }

    console.log('📖 First row sample:', rows[0]);
    
    const books = rows.map(row => ({
      bookId: row[0] || '',
      title: row[1] || '',
      author: row[2] || '',
      copies_available: parseInt(row[3]) || 0,
      location: row[4] || '',
      category: row[5] || ''
    }));

    console.log(`✅ Successfully loaded ${books.length} REAL books from Google Sheets`);
    return books;

  } catch (error) {
    console.error('❌ Google Sheets ERROR:', error.message);
    console.log('📚 Falling back to mock data');
    return mockBooks;
  }
}

// Other functions remain the same...
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