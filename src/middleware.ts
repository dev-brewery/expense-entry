import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_NAME = 'expense_auth'
const AUTH_CODE = process.env.AUTH_CODE || 'change-me-in-production'
const INTERNAL_API_SECRET = 'a_very_secret_string_for_internal_use_only'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/health', '/api/internal/auth-keys']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow public routes
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    // Check for auth cookie
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
    const cookieValue = authCookie?.value

    if (!cookieValue) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Check against primary auth code
    if (cookieValue === AUTH_CODE) {
        return NextResponse.next()
    }

    // Check against dynamic auth codes
    try {
        const internalApiUrl = 'http://localhost:3000/api/internal/auth-keys';
        const response = await fetch(internalApiUrl, {
            headers: {
                'X-Internal-Request': INTERNAL_API_SECRET,
            },
        });
        if (response.ok) {
            const { keys } = await response.json()
            if (Array.isArray(keys) && keys.includes(cookieValue)) {
                return NextResponse.next()
            }
        }
    } catch (error) {
        console.error('Failed to fetch dynamic auth keys:', error)
        // Fall through to redirect if API fails
    }

    // If all checks fail, redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
