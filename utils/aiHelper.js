const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIHelper {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  // Generate AI response with context
  async generateResponse(message, conversationHistory = [], context = {}) {
    try {
      const prompt = this.buildPrompt(message, conversationHistory, context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      return this.filterResponse(text);
    } catch (error) {
      console.error('Error generating AI response:', error);
      return this.getFallbackResponse();
    }
  }

  // Build the prompt with context and conversation history
  buildPrompt(message, conversationHistory = [], context = {}) {
    const systemPrompt = `You are a helpful customer service AI assistant for a business. Your role is to:

1. Respond to customer inquiries in a friendly, professional manner
2. Keep responses concise (under 160 characters when possible for SMS)
3. Be helpful and informative
4. If you don't know something, politely say so and offer to connect them with a human
5. Maintain a consistent, professional tone

Business Context: ${context.businessInfo || 'General customer service'}

Customer message: ${message}

${conversationHistory.length > 0 ? 'Previous conversation context:\n' + conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\n' : ''}

Please provide a helpful response:`;

    return systemPrompt;
  }

  // Filter and clean the AI response
  filterResponse(response) {
    // Remove any markdown formatting
    let cleaned = response.replace(/[*_`#]/g, '');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Ensure response is not too long for SMS
    if (cleaned.length > 160) {
      cleaned = cleaned.substring(0, 157) + '...';
    }
    
    // Remove any inappropriate content (basic filtering)
    const inappropriateWords = ['fuck', 'shit', 'damn', 'ass'];
    for (const word of inappropriateWords) {
      cleaned = cleaned.replace(new RegExp(word, 'gi'), '***');
    }
    
    return cleaned;
  }

  // Get fallback response when AI fails
  getFallbackResponse() {
    const fallbacks = [
      "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
      "Thank you for your message. I'm experiencing technical difficulties. Please contact us again in a few minutes.",
      "I apologize, but I'm unable to respond at the moment. Please try again or contact our support team."
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Analyze message sentiment (basic implementation)
  analyzeSentiment(message) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'satisfied', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'angry', 'frustrated', 'disappointed', 'hate', 'dislike'];
    
    const words = message.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Check if message requires human intervention
  shouldEscalateToHuman(message, conversationHistory = []) {
    const escalationKeywords = [
      'speak to someone', 'talk to human', 'real person', 'agent', 'representative',
      'manager', 'supervisor', 'complaint', 'refund', 'cancel', 'billing issue',
      'technical problem', 'emergency', 'urgent'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    // Check for escalation keywords
    for (const keyword of escalationKeywords) {
      if (lowerMessage.includes(keyword)) {
        return true;
      }
    }
    
    // Check conversation length (escalate after 10 messages)
    if (conversationHistory.length >= 10) {
      return true;
    }
    
    // Check for negative sentiment in recent messages
    const recentMessages = conversationHistory.slice(-3);
    const negativeCount = recentMessages.filter(msg => 
      msg.role === 'customer' && this.analyzeSentiment(msg.content) === 'negative'
    ).length;
    
    if (negativeCount >= 2) {
      return true;
    }
    
    return false;
  }

  // Generate escalation response
  getEscalationResponse() {
    return "I understand you'd like to speak with a human representative. I'm connecting you with our support team now. Someone will be with you shortly.";
  }
}

module.exports = AIHelper; 