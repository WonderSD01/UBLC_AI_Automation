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

// Helper function to authenticate Google Sheets
async function authenticateGoogleSheets() {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!serviceEmail || !privateKey) {
    throw new Error('Missing Google Sheets credentials');
  }

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

  return google.sheets({ version: 'v4', auth });
}

// Function to read from Google Sheet with Service Account
async function readBooks() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  
  console.log('🔍 DEBUG: Sheet ID:', sheetId);
  console.log('🔍 DEBUG: Service Email configured:', !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log('🔍 DEBUG: Private Key configured:', !!process.env.GOOGLE_PRIVATE_KEY);

  if (!sheetId) {
    console.log('❌ Missing Google Sheet ID');
    return mockBooks;
  }

  try {
    console.log('📊 Reading from Google Sheet with Service Account...');
    
    const sheets = await authenticateGoogleSheets();
    
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

// Function to decrement copy in Google Sheets
// In dataService.js - Update to match your Google Sheets structure
async function decrementCopyInGoogleSheets(bookId) {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    console.log('❌ Missing Google Sheet ID for write operation');
    return false;
  }

  try {
    console.log(`📝 Updating Google Sheets for book: ${bookId}`);
    
    const sheets = await authenticateGoogleSheets();
    
    // First, find the row number for this bookId
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Books!A2:F', // Columns A-F
    });

    const rows = readResponse.data.values || [];
    
    // Find the row index (0-based) for this bookId
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === bookId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      console.log(`❌ Book ${bookId} not found in Google Sheets`);
      return false;
    }

    // Get current available copies (column D, index 3)
    const currentCopies = parseInt(rows[rowIndex][3]) || 0;
    
    if (currentCopies <= 0) {
      console.log(`❌ No copies available for book ${bookId}`);
      return false;
    }

    // Calculate new available count
    const newCopies = currentCopies - 1;
    
    // Update the cell (rowIndex + 2 because A2 is row 2, column D is column 4)
    const range = `Books!D${rowIndex + 2}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[newCopies]]
      }
    });

    console.log(`✅ Google Sheets updated: ${bookId} now has ${newCopies} copies`);
    return true;

  } catch (error) {
    console.error('❌ Google Sheets write error:', error.message);
    return false;
  }
}
// Function to log reservation to Google Sheets
async function logReservationToGoogleSheets(reservationData) {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    console.log('❌ Missing Google Sheet ID for logging');
    return false;
  }

  try {
    console.log(`📝 Logging reservation to Google Sheets: ${reservationData.reservationId}`);
    
    const sheets = await authenticateGoogleSheets();
    
    // Append to Reservations sheet
    const values = [[
      reservationData.reservationId,
      reservationData.bookId,
      reservationData.title,
      reservationData.studentId,
      reservationData.studentName,
      reservationData.studentEmail,
      new Date().toISOString(),
      'reserved'
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Reservations!A:H',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    });

    console.log(`✅ Reservation logged to Google Sheets: ${reservationData.reservationId}`);
    return true;

  } catch (error) {
    console.error('❌ Error logging reservation to Google Sheets:', error.message);
    return false;
  }
}

// Main decrement copy function
async function decrementCopy(bookId) {
  try {
    // First try to update Google Sheets
    const googleSheetsUpdated = await decrementCopyInGoogleSheets(bookId);
    
    if (googleSheetsUpdated) {
      return true;
    }
    
    // Fallback: update in-memory data
    const books = await readBooks();
    const book = books.find(b => b.bookId === bookId);
    if (!book) throw new Error(`Book not found: ${bookId}`);
    if (book.copies_available <= 0) return false;
    book.copies_available--;
    console.log(`📚 Updated in-memory copy count for ${bookId}: ${book.copies_available}`);
    return true;
    
  } catch (error) {
    console.error('Error decrementing copy:', error.message);
    throw error;
  }
}

// Main log reservation function
async function logReservation(reservationData) {
  try {
    // Log to Google Sheets
    const googleSheetsLogged = await logReservationToGoogleSheets(reservationData);
    
    if (!googleSheetsLogged) {
      console.log('⚠️ Could not log to Google Sheets, using local log only');
    }
    
    // Also keep local log
    mockReservations.push({
      ...reservationData,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Reservation logged: ${reservationData.reservationId}`);
    return true;
    
  } catch (error) {
    console.error('Error logging reservation:', error.message);
    // Don't throw - just log and continue
    return false;
  }
}

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

async function getBookById(bookId) {
  const books = await readBooks();
  return books.find(book => book.bookId === bookId);
}

// NEW: Get all reservations (for debugging)
async function getReservations() {
  return mockReservations;
}

module.exports = {
  readBooks,
  findBooksByQuery,
  getBookById,
  decrementCopy,
  logReservation,
  getReservations
};