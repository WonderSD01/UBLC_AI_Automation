// test-sheets.js
require('dotenv').config();
const { google } = require('googleapis');

async function testGoogleSheets() {
  try {
    const sheets = google.sheets({ version: 'v4' });

    // Parse the service account key from env
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // Create auth client
    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Test reading the first row of Books tab
    const sheetId = process.env.GOOGLE_SHEET_ID;
const range = 'Books!A2:F';

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: sheetId,
      range,
    });

    console.log('✅ Successfully connected to Google Sheets!');
    console.log('Data fetched from Books tab:');
    console.table(response.data.values);

  } catch (err) {
    console.error('❌ Error connecting to Google Sheets:');
    console.error(err.message);
    console.error('\nCheck these things:');
    console.log('- GOOGLE_SHEET_ID in your .env');
    console.log('- GOOGLE_SERVICE_ACCOUNT_KEY is correctly formatted (all on one line)');
    console.log('- Google Sheet shared with service account email');
    console.log('- Sheet tab names exactly: "Books" and "Reservations"');
  }
}

testGoogleSheets();
