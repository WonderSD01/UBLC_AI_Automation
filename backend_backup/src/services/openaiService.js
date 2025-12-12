require('dotenv').config();

// Use fetch if available (Node.js 18+ has built-in fetch)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(prompt, systemPrompt = "You are a helpful UBLC library assistant.") {
  // If key missing, return a safe response
  if (!OPENAI_KEY) {
    console.warn('OPENAI_API_KEY not set — returning mock response');
    if (prompt.toLowerCase().includes('reserve')) {
      return JSON.stringify({
        "action": "reserve_book",
        "bookId": "B001", 
        "title": "Programming in C"
      });
    }
    return 'This is a demo response because OPENAI_API_KEY is not configured. How can I help you with library services today?';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    throw error;
  }
}

module.exports = { callOpenAI };