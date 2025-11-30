import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// This is a simple secret to ensure this internal endpoint is not called directly by external users.
const INTERNAL_API_SECRET = 'a_very_secret_string_for_internal_use_only'; 
const KEYS_FILE_PATH = path.join('/app', 'auth_keys.txt');


export async function GET(request: Request) {
    const internalSecret = request.headers.get('X-Internal-Request');

    if (internalSecret !== INTERNAL_API_SECRET) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // Create the file if it doesn't exist
        if (!fs.existsSync(KEYS_FILE_PATH)) {
            fs.writeFileSync(KEYS_FILE_PATH, '', 'utf8');
        }

        const dynamicKeys = fs.readFileSync(KEYS_FILE_PATH, 'utf8');
        const validKeys = dynamicKeys.split('\n').filter(k => k.trim() !== '');
        return NextResponse.json({ keys: validKeys });
    } catch (error) {
        // If there's any other error, return an empty list for security.
        return NextResponse.json({ keys: [] });
    }
}
