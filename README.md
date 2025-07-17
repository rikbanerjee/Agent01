# AI SMS Agent

An intelligent SMS customer service agent built with Twilio and Google's Gemini AI. This application automatically responds to customer SMS messages using AI-powered responses.

## Features

- 🤖 **AI-Powered Responses**: Uses Google Gemini AI to generate intelligent, contextual responses
- 📱 **SMS Integration**: Seamless integration with Twilio for SMS handling
- 💬 **Conversation Memory**: Maintains conversation context for better responses
- 🔒 **Security**: Webhook signature validation and rate limiting
- 📊 **Health Monitoring**: Built-in health check and status endpoints
- 🧹 **Auto Cleanup**: Automatically cleans up old conversations

## Prerequisites

- Node.js (v16 or higher)
- Twilio account with a phone number
- Google Gemini API key
- ngrok (for local development and webhook testing)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-sms-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your actual credentials:
   ```env
   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
   TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890

   # Google Gemini API Configuration
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

## Getting API Keys

### Twilio Setup
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token from the Twilio Console
3. Purchase a phone number in the Twilio Console
4. Note down your phone number for the `TWILIO_PHONE_NUMBER` variable

### Gemini API Setup
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key to your `.env` file

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

## Setting Up Twilio Webhook

1. **Start ngrok** (for local development)
   ```bash
   ngrok http 3000
   ```

2. **Configure Twilio Webhook**
   - Go to your Twilio Console
   - Navigate to Phone Numbers → Manage → Active numbers
   - Click on your phone number
   - Under "Messaging", set the webhook URL to:
     ```
     https://your-ngrok-url.ngrok.io/webhook/sms
     ```
   - Set the HTTP method to `POST`

## API Endpoints

### Webhook Endpoint
- **POST** `/webhook/sms` - Twilio webhook for incoming SMS messages

### Health & Status
- **GET** `/health` - Health check endpoint
- **GET** `/status` - Detailed status information

## Testing

1. **Start the server**
   ```bash
   npm run dev
   ```

2. **Start ngrok**
   ```bash
   ngrok http 3000
   ```

3. **Configure Twilio webhook** with your ngrok URL

4. **Send an SMS** to your Twilio phone number

5. **Check the logs** to see the conversation flow

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Required |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Required |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Required |
| `GEMINI_API_KEY` | Your Google Gemini API key | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `MAX_CONVERSATION_HISTORY` | Max messages to keep in memory | 10 |
| `CONVERSATION_TIMEOUT_HOURS` | Hours before cleaning up conversations | 24 |

## Production Deployment

### Recommended Setup
- Use a production database (PostgreSQL, MongoDB) instead of in-memory storage
- Set up Redis for conversation caching
- Use environment-specific configuration
- Set up proper logging and monitoring
- Use HTTPS in production
- Set up proper error handling and alerts

### Deployment Options
- **Heroku**: Easy deployment with environment variables
- **AWS**: Use EC2 or Lambda with API Gateway
- **Google Cloud**: Use App Engine or Cloud Run
- **DigitalOcean**: Use App Platform or Droplets

## Security Considerations

- ✅ Webhook signature validation
- ✅ Rate limiting
- ✅ Helmet.js security headers
- ✅ Environment variable protection
- ✅ Input validation

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages**
   - Check ngrok is running and accessible
   - Verify webhook URL in Twilio console
   - Check server logs for errors

2. **AI responses not generating**
   - Verify Gemini API key is correct
   - Check API quota and limits
   - Review server logs for API errors

3. **SMS not sending**
   - Verify Twilio credentials
   - Check phone number format
   - Ensure sufficient Twilio credits

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Twilio and Gemini API documentation
- Open an issue on GitHub 