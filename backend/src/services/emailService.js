// src/services/emailService.js - Updated with better debugging
require('dotenv').config();

const sendReservationEmail = async (to, bookData) => {
  console.log('\n📧 === EMAIL SENDING PROCESS STARTED ===');
  console.log('📧 To:', to);
  console.log('📧 Book Data:', JSON.stringify(bookData, null, 2));
  
  console.log('\n📧 Configuration Check:');
  console.log('- SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? `✓ Set (${process.env.SENDGRID_API_KEY.length} chars)` : '✗ Not set');
  console.log('- First 10 chars of key:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 10) + '...' : 'N/A');
  console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || '✗ Not set');
  
  try {
    // If SendGrid is configured, use it
    if (process.env.SENDGRID_API_KEY) {
      // Clean the API key (remove any whitespace)
      const cleanedApiKey = process.env.SENDGRID_API_KEY.trim();
      
      console.log('\n📧 Attempting to use SendGrid API...');
      console.log('- Cleaned API Key length:', cleanedApiKey.length);
      
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(cleanedApiKey);

      const msg = {
        to: to,
        from: process.env.EMAIL_FROM || 'library@ublc.edu.ph',
        subject: `Book Reservation Confirmed - ${bookData.bookTitle || bookData.title}`,
        text: `
Hello ${bookData.studentName}!

Your book reservation has been confirmed.

Reservation Details:
Reservation ID: ${bookData.reservationId}
Book Title: ${bookData.bookTitle || bookData.title}
Author: ${bookData.author || 'N/A'}
Location: ${bookData.location || 'Library'}

Please pick up your book at the library circulation desk within 3 days.
Bring your student ID and this reservation ID.

Library Hours: Monday - Friday, 8:00 AM - 5:00 PM

Thank you for using UBLC Library Services!

University of Batangas Lipa Campus
Library Services Department
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #8B0000; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #8B0000; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Book Reservation Confirmed</h1>
      <p>University of Batangas Lipa Campus</p>
    </div>
    <div class="content">
      <p>Hello <strong>${bookData.studentName}</strong>,</p>
      <p>Your book reservation has been <strong style="color: #8B0000;">successfully confirmed</strong>.</p>
      
      <div class="details">
        <h3>Reservation Details</h3>
        <p><strong>Reservation ID:</strong> ${bookData.reservationId}</p>
        <p><strong>Book Title:</strong> ${bookData.bookTitle || bookData.title}</p>
        <p><strong>Author:</strong> ${bookData.author || 'N/A'}</p>
        <p><strong>Location:</strong> ${bookData.location || 'Library'}</p>
        <p><strong>Student ID:</strong> ${bookData.studentId}</p>
      </div>
      
      <p><strong>Important:</strong> Please pick up your book at the library circulation desk <strong>within 3 days</strong>.</p>
      
      <h3>Next Steps:</h3>
      <ul>
        <li>Visit the library circulation desk</li>
        <li>Bring your <strong>student ID</strong></li>
        <li>Present this <strong>reservation ID</strong></li>
      </ul>
      
      <p><strong>Library Hours:</strong><br>Monday - Friday: 8:00 AM - 5:00 PM</p>
    </div>
    
    <div class="footer">
      <p>University of Batangas Lipa Campus<br>
      Library Services Department<br>
      <em>Committed to Academic Excellence</em></p>
    </div>
  </div>
</body>
</html>
        `
      };

      console.log('\n📧 Sending email via SendGrid...');
      await sgMail.send(msg);
      console.log('✅ Email sent successfully via SendGrid!');
      
      return { 
        success: true, 
        message: 'Email sent successfully via SendGrid',
        method: 'sendgrid'
      };
    } else {
      console.log('\n⚠️ SendGrid not configured, using mock email');
      console.log('📧 Mock Email Details:');
      console.log(`  To: ${to}`);
      console.log(`  Subject: Book Reservation Confirmed - ${bookData.bookTitle || bookData.title}`);
      console.log(`  Reservation ID: ${bookData.reservationId}`);
      console.log(`  Book: ${bookData.bookTitle || bookData.title}`);
      console.log(`  Student: ${bookData.studentName}`);
      console.log(`  Student ID: ${bookData.studentId}`);
      
      return { 
        success: true, 
        message: 'Mock email sent successfully',
        note: 'Set SENDGRID_API_KEY in .env for real emails',
        method: 'mock'
      };
    }
  } catch (error) {
    console.error('\n❌ Email error details:');
    console.error('- Error message:', error.message);
    console.error('- Error code:', error.code);
    console.error('- Full error:', error);
    
    // Don't throw - email failure shouldn't break reservation
    return { 
      success: false, 
      message: `Email failed: ${error.message}`,
      error: error.message
    };
  }
};

// General email function
const sendEmail = async (to, subject, text) => {
  console.log('📧 Mock email - To: ${to}, Subject: ${subject}');
  console.log('Body: ${text}');
  return { success: true, message: 'Email sent (mock)' };
};

module.exports = {
  sendReservationEmail,
  sendEmail
};