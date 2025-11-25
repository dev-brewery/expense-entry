import { NextResponse } from 'next/server'
import { z } from 'zod'

const loginSchema = z.object({
    code: z.string().min(1, 'Code is required'),
})

const AUTH_CODE = process.env.AUTH_CODE || 'change-me-in-production'
const AUTH_COOKIE_NAME = 'expense_auth'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { code } = loginSchema.parse(body)

        if (code !== AUTH_CODE) {
            return NextResponse.json(
                { error: 'Invalid authentication code' },
                { status: 401 }
            )
        }

        // Create response with auth cookie
        const response = NextResponse.json({ success: true })

        // Set HttpOnly cookie that expires in 30 days
        response.cookies.set(AUTH_COOKIE_NAME, AUTH_CODE, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: error.errors[0].message },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        )
    }
}
