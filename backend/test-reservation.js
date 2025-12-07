// test-reservation.js
const fetch = require('node-fetch');

async function testReservation() {
  const reservationData = {
    bookId: "B001",
    studentId: "2220122",
    studentName: "Maria Santos",
    studentEmail: "2220122@ub.edu.ph"
  };

  console.log('🧪 Testing Reservation API\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/reserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservationData)
    });

    const result = await response.json();
    
    console.log('📋 Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ RESERVATION SUCCESSFUL!');
      console.log(`📖 Book: ${result.details.bookTitle}`);
      console.log(`👤 Student: ${result.details.studentName}`);
      console.log(`📧 Email sent: ${result.details.emailStatus}`);
      console.log(`🆔 Reservation ID: ${result.reservationId}`);
      
      // Check Google Sheets
      console.log('\n🔍 Check your Google Sheets:');
      console.log('1. Books tab - Copies for B001 should be reduced by 1');
      console.log('2. Reservations tab - New reservation should be added');
    } else {
      console.log('\n❌ Reservation failed:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testReservation();