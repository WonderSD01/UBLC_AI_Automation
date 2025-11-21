// --- Core Interaction Features Logic ---

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const quickActions = document.getElementById('quick-actions');
const clearChatBtn = document.getElementById('clear-chat-btn');
const analyticsToggleBtn = document.getElementById('analytics-toggle-btn');
const analyticsPanel = document.getElementById('analytics-panel');

// Utility function to get a formatted timestamp
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Function to automatically scroll the chat window to the bottom
function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to create and append a message bubble
function appendMessage(messageText, sender, isRich=false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-response');

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    // Add Avatar for bot messages
    if (sender === 'bot') {
        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = 'U A'; // UBLC Assist
        messageDiv.appendChild(avatar);
    }
    
    // Simple text for now. For rich content, one would parse isRich/a content object
    contentDiv.innerHTML = `<p>${messageText}</p><span class="timestamp">${getTimestamp()}</span>`;
    messageDiv.appendChild(contentDiv);

    chatWindow.appendChild(messageDiv);
    scrollToBottom();
}

// Function to show/hide typing indicator
function toggleTypingIndicator(show) {
    const existingIndicator = document.querySelector('.typing-indicator');
    if (show && !existingIndicator) {
        const indicator = document.createElement('div');
        indicator.classList.add('message', 'bot-response', 'typing-indicator');
        indicator.innerHTML = `<div class="avatar">U A</div><div class="message-content">Bot is typing... (...)</div>`;
        chatWindow.appendChild(indicator);
        scrollToBottom();
    } else if (!show && existingIndicator) {
        existingIndicator.remove();
    }
}

// --- Main Send Logic ---
function sendMessage() {
    const text = userInput.value.trim();
    if (text === '') return;

    // 1. Append User Message
    appendMessage(text, 'user');
    userInput.value = '';

    // 2. Show Typing Indicator
    toggleTypingIndicator(true);

    // 3. Simulate AI response (replace with actual API call)
    setTimeout(() => {
        // 4. Hide Typing Indicator
        toggleTypingIndicator(false);
        
        // 5. Generate Response (Placeholder Logic)
        let botResponse = `Thank you for your inquiry about "${text}". `;

        if (text.toLowerCase().includes('clearance')) {
             // Example of Structured List/Table response
            botResponse += `I can check your clearance status! Here is an example of what that data would look like: 
                <div style="margin-top: 10px; font-size: 0.9em;">
                    <strong style="color: var(--ublc-maroon);">Clearance Status:</strong>
                    <ul style="margin-left: 20px; list-style-type: disc;">
                        <li>Library: <span style="color: green;">Cleared</span></li>
                        <li>Accounting: <span style="color: red;">Pending (₱500 fee)</span></li>
                        <li>IT/MIS: <span style="color: green;">Cleared</span></li>
                    </ul>
                </div>
                <p>Would you like the <span class="response-hyperlink">Official Clearance Form link</span>?</p>`;
        } else if (text.toLowerCase().includes('library')) {
            // Example of Hyperlinks/Buttons
            botResponse += `For Library services, please check our <a href="#" class="response-button">Full Book Catalog</a> or <a href="#" class="response-button">Book a Study Room</a>.`;
        } else {
            // Error/Fallback Message (A generic response for unknowns)
            botResponse = "I apologize, I don't have enough information on that topic yet. Could you please rephrase your question or select one of the department buttons? If the issue is urgent, you can <a href='#' class='response-hyperlink'>Talk to a Human/Submit a Ticket</a>.";
        }
        
        appendMessage(botResponse, 'bot');
    }, Math.random() * 2000 + 1000); // 1 to 3 second delay
}

// Event Listeners for Interaction
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Quick Action Buttons Listener (Delegation)
quickActions.addEventListener('click', (e) => {
    if (e.target.classList.contains('quick-action-btn')) {
        const query = e.target.getAttribute('data-query');
        userInput.value = query; // Prefill or directly send
        sendMessage();
    }
});

// Clear Chat / New Conversation
clearChatBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to start a new conversation?')) {
        // Clear all messages except the welcome message and quick actions
        const messages = chatWindow.querySelectorAll('.message:not(.welcome-message)');
        messages.forEach(msg => msg.remove());
        
        // Re-show quick actions if they were hidden
        quickActions.style.display = 'flex';
        
        appendMessage('Conversation history cleared. How can I assist you now?', 'bot');
    }
});

// Analytics Dashboard Toggle
analyticsToggleBtn.addEventListener('click', () => {
    // Toggles visibility on desktop and mobile
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    
    if (isMobile) {
        // Mobile uses a 'visible' class to slide the panel up
        analyticsPanel.classList.toggle('visible');
    } else {
        // Desktop uses 'hidden' class to simply show/hide the sidebar
        analyticsPanel.classList.toggle('hidden');
    }
});

// Initial Scroll (ensures the welcome message is visible)
scrollToBottom();