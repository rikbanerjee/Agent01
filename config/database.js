// Database configuration and conversation storage
// Currently using in-memory storage, but can be extended for production databases

class ConversationStore {
  constructor() {
    this.conversations = new Map();
    this.maxHistory = parseInt(process.env.MAX_CONVERSATION_HISTORY) || 10;
    this.timeoutHours = parseInt(process.env.CONVERSATION_TIMEOUT_HOURS) || 24;
  }

  // Store a message in conversation history
  storeMessage(phoneNumber, message, response, isCustomer = true) {
    if (!this.conversations.has(phoneNumber)) {
      this.conversations.set(phoneNumber, {
        messages: [],
        lastActivity: Date.now(),
        metadata: {
          phoneNumber,
          createdAt: Date.now(),
          messageCount: 0
        }
      });
    }
    
    const conversation = this.conversations.get(phoneNumber);
    
    // Add message to history
    conversation.messages.push({
      role: isCustomer ? 'customer' : 'assistant',
      content: isCustomer ? message : response,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    });
    
    // Update metadata
    conversation.metadata.messageCount = conversation.messages.length;
    conversation.lastActivity = Date.now();
    
    // Keep only recent messages
    if (conversation.messages.length > this.maxHistory) {
      conversation.messages = conversation.messages.slice(-this.maxHistory);
    }
    
    return conversation;
  }

  // Get conversation history for a phone number
  getConversation(phoneNumber) {
    return this.conversations.get(phoneNumber) || { messages: [], metadata: {} };
  }

  // Get recent messages for context
  getRecentMessages(phoneNumber, count = 6) {
    const conversation = this.getConversation(phoneNumber);
    return conversation.messages.slice(-count);
  }

  // Update conversation metadata
  updateMetadata(phoneNumber, metadata) {
    if (this.conversations.has(phoneNumber)) {
      const conversation = this.conversations.get(phoneNumber);
      conversation.metadata = { ...conversation.metadata, ...metadata };
      conversation.lastActivity = Date.now();
    }
  }

  // Clean up old conversations
  cleanupOldConversations() {
    const timeoutMs = this.timeoutHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [phoneNumber, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity > timeoutMs) {
        this.conversations.delete(phoneNumber);
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} old conversations`);
    return cleanedCount;
  }

  // Get conversation statistics
  getStats() {
    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const activeConversations = conversations.length;
    
    return {
      activeConversations,
      totalMessages,
      averageMessagesPerConversation: activeConversations > 0 ? totalMessages / activeConversations : 0,
      oldestConversation: conversations.length > 0 ? Math.min(...conversations.map(c => c.metadata.createdAt)) : null,
      newestConversation: conversations.length > 0 ? Math.max(...conversations.map(c => c.lastActivity)) : null
    };
  }

  // Search conversations (basic implementation)
  searchConversations(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [phoneNumber, conversation] of this.conversations.entries()) {
      const matchingMessages = conversation.messages.filter(msg => 
        msg.content.toLowerCase().includes(lowerQuery)
      );
      
      if (matchingMessages.length > 0) {
        results.push({
          phoneNumber,
          matchingMessages,
          lastActivity: conversation.lastActivity
        });
      }
    }
    
    return results;
  }

  // Generate unique message ID
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export conversations (for backup)
  exportConversations() {
    return Array.from(this.conversations.entries()).map(([phoneNumber, conversation]) => ({
      phoneNumber,
      ...conversation
    }));
  }

  // Import conversations (for restore)
  importConversations(data) {
    data.forEach(item => {
      this.conversations.set(item.phoneNumber, {
        messages: item.messages || [],
        lastActivity: item.lastActivity || Date.now(),
        metadata: item.metadata || { phoneNumber: item.phoneNumber, createdAt: Date.now(), messageCount: 0 }
      });
    });
  }
}

// Production database integration (example with PostgreSQL)
class PostgresConversationStore {
  constructor(pool) {
    this.pool = pool;
  }

  async storeMessage(phoneNumber, message, response, isCustomer = true) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert or update conversation
      await client.query(`
        INSERT INTO conversations (phone_number, last_activity, message_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (phone_number) 
        DO UPDATE SET last_activity = $2, message_count = conversations.message_count + 1
      `, [phoneNumber, new Date()]);
      
      // Insert message
      await client.query(`
        INSERT INTO messages (phone_number, role, content, timestamp)
        VALUES ($1, $2, $3, $4)
      `, [phoneNumber, isCustomer ? 'customer' : 'assistant', isCustomer ? message : response, new Date()]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecentMessages(phoneNumber, count = 6) {
    const result = await this.pool.query(`
      SELECT role, content, timestamp
      FROM messages 
      WHERE phone_number = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `, [phoneNumber, count]);
    
    return result.rows.reverse();
  }
}

// Factory function to create appropriate store
function createConversationStore(type = 'memory', config = {}) {
  switch (type) {
    case 'postgres':
      return new PostgresConversationStore(config.pool);
    case 'memory':
    default:
      return new ConversationStore();
  }
}

module.exports = {
  ConversationStore,
  PostgresConversationStore,
  createConversationStore
}; 