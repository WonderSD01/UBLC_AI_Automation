// test-gemini.js
require('dotenv').config();

async function testGemini() {
    console.log('🧪 Testing Gemini API...\n');
    
    // Test with your working API key
    const apiKey = "AIzaSyAFuDNdcknVhLf7XYfcAsnMVOu7W5_ONwI";
    console.log('API Key:', apiKey ? '✅ Present' : '❌ Missing');
    console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    
    try {
        // Use the confirmed working model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`;
        
        console.log('\n📡 Calling Gemini API...');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Say 'UBLC Library API is working perfectly!' in one short sentence."
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 100,
                }
            })
        });
        
        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('\n✅ SUCCESS! Gemini API is working');
            console.log('📝 Response:');
            console.log('─'.repeat(50));
            console.log(data.candidates[0].content.parts[0].text);
            console.log('─'.repeat(50));
            console.log('\n📋 Full response structure:');
            console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
        } else {
            console.log('\n❌ FAILED with error:');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        console.log('Stack:', error.stack);
    }
}

testGemini();