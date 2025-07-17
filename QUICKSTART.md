# 🚀 Quick Start Guide

Get your AI SMS Agent up and running in 5 minutes!

## Prerequisites

- Node.js (v16 or higher)
- A Twilio account with a phone number
- A Google Gemini API key
- ngrok (for local development)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure the Application

Run the interactive setup script:

```bash
npm run setup
```

This will guide you through entering your:
- Twilio Account SID
- Twilio Auth Token  
- Twilio Phone Number
- Google Gemini API Key

## Step 3: Start the Server

```bash
npm run dev
```

The server will start on port 3000 (or your configured port).

## Step 4: Set Up Webhook (Local Development)

1. **Start ngrok** in a new terminal:
   ```bash
   ngrok http 3000
   ```

2. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

3. **Configure Twilio Webhook**:
   - Go to [Twilio Console](https://console.twilio.com/)
   - Navigate to Phone Numbers → Manage → Active numbers
   - Click on your phone number
   - Under "Messaging", set the webhook URL to:
     ```
     https://your-ngrok-url.ngrok.io/webhook/sms
     ```
   - Set HTTP method to `POST`

## Step 5: Test Your Agent

Send an SMS to your Twilio phone number! The AI will respond automatically.

## Step 6: Monitor Your Agent

Visit the dashboard at: `http://localhost:3000/dashboard`

## 🎯 Example Conversation

**Customer:** "Hi, what are your business hours?"

**AI Agent:** "Hello! We're open Monday-Friday 9AM-6PM and Saturday 10AM-4PM. How can I help you today?"

**Customer:** "Do you offer refunds?"

**AI Agent:** "Yes, we offer refunds within 30 days of purchase with a valid receipt. Would you like to speak with our customer service team about a specific refund?"

## 🔧 Troubleshooting

### Webhook Not Receiving Messages
- Check that ngrok is running
- Verify the webhook URL in Twilio console
- Check server logs for errors

### AI Not Responding
- Verify your Gemini API key is correct
- Check API quota and limits
- Review server logs for API errors

### SMS Not Sending
- Verify Twilio credentials
- Check phone number format (E.164)
- Ensure sufficient Twilio credits

## 📊 Dashboard Features

- Real-time system status
- Active conversation count
- Configuration status
- Auto-refresh every 30 seconds

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Use HTTPS in production
- Regularly rotate your API keys
- Monitor your API usage

## 🚀 Production Deployment

For production deployment, consider:
- Using a production database (PostgreSQL, MongoDB)
- Setting up Redis for caching
- Using environment-specific configuration
- Setting up proper logging and monitoring
- Using HTTPS
- Setting up error handling and alerts

## 📞 Support

If you need help:
1. Check the troubleshooting section
2. Review the full README.md
3. Check server logs for errors
4. Verify your API keys and configuration

---

**Happy SMS-ing! 🤖📱** 