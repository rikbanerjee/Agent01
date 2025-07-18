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

// Trust proxy for rate limiting behind ngrok/proxies
app.set('trust proxy', 1);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory conversation storage (in production, use Redis or database)
const conversations = new Map();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use X-Forwarded-For header for IP detection when behind proxy
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
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

// Test client endpoint
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-client.html'));
});

// Test API endpoint for simulating SMS without Twilio
app.post('/api/test-sms', async (req, res) => {
  try {
    const { message, phoneNumber = '+1234567890', simulateTwilio = false } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        example: {
          message: "Hello, what are your business hours?",
          phoneNumber: "+1234567890",
          simulateTwilio: false
        }
      });
    }
    
    console.log(`🧪 Test SMS from ${phoneNumber}: ${message}`);
    
    // Get conversation history
    const conversation = conversations.get(phoneNumber) || { messages: [] };
    const conversationHistory = conversation.messages.slice(-6);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(message, conversationHistory);
    
    // Store the conversation
    storeConversation(phoneNumber, message, aiResponse, true);
    storeConversation(phoneNumber, message, aiResponse, false);
    
    const response = {
      success: true,
      request: {
        message,
        phoneNumber,
        timestamp: new Date().toISOString()
      },
      response: {
        aiMessage: aiResponse,
        timestamp: new Date().toISOString()
      },
      conversation: {
        totalMessages: conversation.messages.length + 2,
        history: conversationHistory.slice(-4) // Last 4 messages for context
      }
    };
    
    // Simulate Twilio response format if requested
    if (simulateTwilio) {
      response.twilioSimulation = {
        sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'delivered',
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        to: phoneNumber,
        body: aiResponse,
        date_created: new Date().toISOString()
      };
    }
    
    console.log(`🤖 AI Response: ${aiResponse}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Error in test SMS API:', error);
    res.status(500).json({ 
      error: 'Failed to process test SMS',
      details: error.message 
    });
  }
});

// Get conversation history for a phone number
app.get('/api/conversations/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const conversation = conversations.get(phoneNumber);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found',
        phoneNumber 
      });
    }
    
    res.json({
      phoneNumber,
      conversation: {
        messages: conversation.messages,
        metadata: conversation.metadata,
        lastActivity: conversation.lastActivity
      }
    });
    
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ 
      error: 'Failed to get conversation',
      details: error.message 
    });
  }
});

// List all active conversations
app.get('/api/conversations', (req, res) => {
  try {
    const conversationList = Array.from(conversations.entries()).map(([phoneNumber, conversation]) => ({
      phoneNumber,
      messageCount: conversation.messages.length,
      lastActivity: conversation.lastActivity,
      lastMessage: conversation.messages[conversation.messages.length - 1]?.content || 'No messages'
    }));
    
    res.json({
      totalConversations: conversationList.length,
      conversations: conversationList
    });
    
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ 
      error: 'Failed to list conversations',
      details: error.message 
    });
  }
});

// Check product pricing endpoint
app.get('/api/pricing/:productType', async (req, res) => {
  try {
    const { productType } = req.params;
    const aiHelper = new (require('./utils/aiHelper'))(process.env.GEMINI_API_KEY);
    
    console.log(`🔍 Checking pricing for: ${productType}`);
    const pricingInfo = await aiHelper.webScraper.getPricingInfo(productType);
    
    res.json({
      success: true,
      productType,
      pricing: pricingInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking pricing:', error);
    res.status(500).json({ 
      error: 'Failed to check pricing',
      details: error.message 
    });
  }
});

// Search products endpoint
app.get('/api/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const aiHelper = new (require('./utils/aiHelper'))(process.env.GEMINI_API_KEY);
    
    console.log(`🔍 Searching for: ${query}`);
    const products = await aiHelper.webScraper.searchProducts(query);
    
    res.json({
      success: true,
      query,
      products,
      count: products.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ 
      error: 'Failed to search products',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`AI SMS Agent server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/sms`);
  
  // Clean up old conversations every hour
  setInterval(cleanupOldConversations, 60 * 60 * 1000);
});

module.exports = app; 