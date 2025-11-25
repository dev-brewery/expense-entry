export function validateEnvironment() {
  const required = [
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS',
    'DATABASE_URL',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    const errorMsg = `
╔════════════════════════════════════════════════════════════╗
║  CONFIGURATION ERROR: Missing Required Environment Variables  ║
╚════════════════════════════════════════════════════════════╝

Missing: ${missing.join(', ')}

Please ensure all required environment variables are set in your .env file.
See .env.example for reference.
    `.trim()

    throw new Error(errorMsg)
  }

  // Validate Google credentials are valid JSON
  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS!)
    if (!creds.type || !creds.project_id || !creds.private_key) {
      throw new Error('Invalid credentials structure')
    }
  } catch (error) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON or is missing required fields. ' +
      'Error: ' + (error as Error).message
    )
  }

  console.log('✅ Environment validation passed')
}
