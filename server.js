require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory conversation storage (in production, use Redis or database)
const conversations = new Map();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve static files (dashboard)
app.use(express.static('public'));

// Twilio webhook signature validation
const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body;
  
  if (twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, twilioSignature, url, params)) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
};

// Generate AI response using Gemini
async function generateAIResponse(message, conversationHistory = []) {
  try {
    const prompt = `You are a helpful customer service AI assistant. Respond to customer inquiries in a friendly, professional, and concise manner. Keep responses under 160 characters when possible for SMS.

Customer message: ${message}

${conversationHistory.length > 0 ? 'Previous conversation context:\n' + conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\n' : ''}

Please provide a helpful response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
  }
}

// Store conversation history
function storeConversation(phoneNumber, message, response, isCustomer = true) {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, {
      messages: [],
      lastActivity: Date.now()
    });
  }
  
  const conversation = conversations.get(phoneNumber);
  conversation.messages.push({
    role: isCustomer ? 'customer' : 'assistant',
    content: isCustomer ? message : response,
    timestamp: Date.now()
  });
  
  // Keep only recent messages
  const maxHistory = parseInt(process.env.MAX_CONVERSATION_HISTORY) || 10;
  if (conversation.messages.length > maxHistory) {
    conversation.messages = conversation.messages.slice(-maxHistory);
  }
  
  conversation.lastActivity = Date.now();
}

// Clean up old conversations
function cleanupOldConversations() {
  const timeoutHours = parseInt(process.env.CONVERSATION_TIMEOUT_HOURS) || 24;
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const now = Date.now();
  
  for (const [phoneNumber, conversation] of conversations.entries()) {
    if (now - conversation.lastActivity > timeoutMs) {
      conversations.delete(phoneNumber);
    }
  }
}

// Twilio webhook endpoint for incoming SMS
app.post('/webhook/sms', validateTwilioRequest, async (req, res) => {
  try {
    const { Body, From, To } = req.body;
    
    console.log(`Received SMS from ${From}: ${Body}`);
    
    // Get conversation history
    const conversation = conversations.get(From) || { messages: [] };
    const conversationHistory = conversation.messages.slice(-6); // Last 6 messages for context
    
    // Generate AI response
    const aiResponse = await generateAIResponse(Body, conversationHistory);
    
    // Store the conversation
    storeConversation(From, Body, aiResponse, true);
    storeConversation(From, Body, aiResponse, false);
    
    // Send response via Twilio
    await twilioClient.messages.create({
      body: aiResponse,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: From
    });
    
    console.log(`Sent response to ${From}: ${aiResponse}`);
    
    // Send TwiML response
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end('<Response></Response>');
    
  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeConversations: conversations.size
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    port: PORT,
    environment: process.env.NODE_ENV,
    activeConversations: conversations.size,
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// Dashboard endpoint
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`AI SMS Agent server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/sms`);
  
  // Clean up old conversations every hour
  setInterval(cleanupOldConversations, 60 * 60 * 1000);
});

module.exports = app; 