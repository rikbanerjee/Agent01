#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 AI SMS Agent Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env file already exists');
} else {
  console.log('📝 Creating .env file...');
  
  // Copy from example
  const examplePath = path.join(__dirname, '..', 'env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ .env file created from template');
  } else {
    console.log('❌ env.example not found');
    process.exit(1);
  }
}

// Function to ask for input
function askQuestion(question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

// Function to validate phone number format
function validatePhoneNumber(phone) {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

// Function to validate API key format
function validateAPIKey(key, type) {
  if (!key || key.length < 10) {
    return false;
  }
  
  switch (type) {
    case 'twilio_sid':
      return key.startsWith('AC') && key.length === 34;
    case 'twilio_token':
      return key.length >= 32;
    case 'gemini':
      return key.length >= 20;
    default:
      return true;
  }
}

async function runSetup() {
  console.log('\n🔧 Configuration Setup\n');
  
  try {
    // Read current .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Parse current values
    const currentValues = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        currentValues[match[1]] = match[2];
      }
    });
    
    // Collect new values
    const config = {};
    
    console.log('📱 Twilio Configuration:');
    config.TWILIO_ACCOUNT_SID = await askQuestion(
      'Enter your Twilio Account SID',
      currentValues.TWILIO_ACCOUNT_SID || ''
    );
    
    if (!validateAPIKey(config.TWILIO_ACCOUNT_SID, 'twilio_sid')) {
      console.log('⚠️  Warning: Account SID should start with "AC" and be 34 characters long');
    }
    
    config.TWILIO_AUTH_TOKEN = await askQuestion(
      'Enter your Twilio Auth Token',
      currentValues.TWILIO_AUTH_TOKEN || ''
    );
    
    if (!validateAPIKey(config.TWILIO_AUTH_TOKEN, 'twilio_token')) {
      console.log('⚠️  Warning: Auth Token should be at least 32 characters long');
    }
    
    config.TWILIO_PHONE_NUMBER = await askQuestion(
      'Enter your Twilio phone number (e.g., +1234567890)',
      currentValues.TWILIO_PHONE_NUMBER || ''
    );
    
    if (!validatePhoneNumber(config.TWILIO_PHONE_NUMBER)) {
      console.log('⚠️  Warning: Phone number should be in E.164 format (e.g., +1234567890)');
    }
    
    console.log('\n🤖 Gemini AI Configuration:');
    config.GEMINI_API_KEY = await askQuestion(
      'Enter your Google Gemini API key',
      currentValues.GEMINI_API_KEY || ''
    );
    
    if (!validateAPIKey(config.GEMINI_API_KEY, 'gemini')) {
      console.log('⚠️  Warning: API key should be at least 20 characters long');
    }
    
    console.log('\n⚙️  Server Configuration:');
    config.PORT = await askQuestion(
      'Enter server port',
      currentValues.PORT || '3000'
    );
    
    config.NODE_ENV = await askQuestion(
      'Enter environment (development/production)',
      currentValues.NODE_ENV || 'development'
    );
    
    // Generate new .env content
    const newEnvContent = `# Twilio Configuration
TWILIO_ACCOUNT_SID=${config.TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${config.TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=${config.TWILIO_PHONE_NUMBER}

# Google Gemini API Configuration
GEMINI_API_KEY=${config.GEMINI_API_KEY}

# Server Configuration
PORT=${config.PORT}
NODE_ENV=${config.NODE_ENV}

# Optional: Conversation memory settings
MAX_CONVERSATION_HISTORY=10
CONVERSATION_TIMEOUT_HOURS=24
`;
    
    // Write new .env file
    fs.writeFileSync(envPath, newEnvContent);

    // Set restrictive file permissions (owner read/write only)
    try {
      fs.chmodSync(envPath, 0o600);
      console.log('✅ Set secure file permissions (600)');
    } catch (error) {
      console.log('⚠️ Could not set file permissions');
    }

    console.log('\n✅ Configuration saved to .env file');
    
    // Validate configuration
    console.log('\n🔍 Validating Configuration...');
    
    const issues = [];
    
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
      issues.push('Missing Twilio configuration');
    }
    
    if (!config.GEMINI_API_KEY) {
      issues.push('Missing Gemini API key');
    }
    
    if (issues.length === 0) {
      console.log('✅ Configuration looks good!');
      console.log('\n📋 Next Steps:');
      console.log('1. Install dependencies: npm install');
      console.log('2. Start the server: npm run dev');
      console.log('3. Set up ngrok: ngrok http 3000');
      console.log('4. Configure Twilio webhook with your ngrok URL');
      console.log('5. Test by sending an SMS to your Twilio number');
    } else {
      console.log('❌ Configuration issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Check if dependencies are installed
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found. Please run this script from the project root.');
    process.exit(1);
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  Dependencies not installed. Run "npm install" first.');
    console.log('   npm install');
    console.log('');
  }
}

// Main execution
if (require.main === module) {
  checkDependencies();
  runSetup();
}

module.exports = { runSetup, checkDependencies }; 