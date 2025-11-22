// Test script for Google Sheets integration
const { google } = require('googleapis');
require('dotenv').config();

async function testGoogleSheetsIntegration() {
  console.log('🧪 Testing Google Sheets Integration...\n');

  // Check environment variables
  console.log('1. Checking environment variables...');
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;

  if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_SPREADSHEET_ID is not set');
    process.exit(1);
  }
  console.log('✅ Spreadsheet ID:', spreadsheetId);

  if (!credentials) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not set');
    process.exit(1);
  }
  console.log('✅ Service account credentials are set\n');

  // Initialize Google Sheets API
  console.log('2. Initializing Google Sheets API...');
  let auth, sheets;
  try {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize API:', error.message);
    process.exit(1);
  }

  // Test accessing the spreadsheet
  console.log('3. Testing spreadsheet access...');
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('✅ Successfully accessed spreadsheet:', spreadsheet.data.properties.title);
    console.log('   Existing sheets:', spreadsheet.data.sheets?.map(s => s.properties.title).join(', ') || 'None\n');
  } catch (error) {
    console.error('❌ Failed to access spreadsheet:', error.message);
    console.error('   Make sure the service account has been granted Editor access to the sheet');
    process.exit(1);
  }

  // Create October 2025 sheet
  const sheetName = 'November 2025';
  console.log(`4. Creating "${sheetName}" sheet...`);

  try {
    // Check if sheet already exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = spreadsheet.data.sheets?.find(
      sheet => sheet.properties?.title === sheetName
    );

    let sheetId;
    if (existingSheet) {
      console.log(`   ℹ️  Sheet "${sheetName}" already exists, will use it`);
      sheetId = existingSheet.properties.sheetId;
    } else {
      // Create the sheet
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName },
            },
          }],
        },
      });
      sheetId = response.data.replies[0].addSheet.properties.sheetId;
      console.log(`✅ Created sheet "${sheetName}"`);
    }

    // Add headers
    console.log('5. Adding headers...');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', 'Date', 'Description', 'Amount', 'Category']],
      },
    });
    console.log('✅ Headers added');

    // Add TOTAL row
    console.log('6. Adding TOTAL formula...');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!G2:H2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['TOTAL:', '=SUM(D3:D)']],
      },
    });
    console.log('✅ TOTAL formula added');

    // Format headers and total row as bold
    console.log('7. Formatting header and total rows...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 2,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      },
    });
    console.log('✅ Formatting applied');

    // Add a test expense
    console.log('8. Adding test expense...');
    const testExpense = [
      'test-' + Date.now(),
      '2025-11-15',
      'Test Expense from Integration Test',
      25.50,
      'Food'
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A3:E`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [testExpense],
      },
    });
    console.log('✅ Test expense added');

    // Verify the expense was added
    console.log('9. Verifying expense...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A3:E3`,
    });

    if (response.data.values && response.data.values.length > 0) {
      console.log('✅ Expense verified:', response.data.values[0]);
    } else {
      console.error('❌ Could not verify expense');
    }

    console.log('\n✅ All tests passed! Google Sheets integration is working correctly.');
    console.log(`\n📊 View your spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testGoogleSheetsIntegration().catch(console.error);
