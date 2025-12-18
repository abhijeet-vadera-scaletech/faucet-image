import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const validEmail = process.env.AUTH_EMAIL;
    const validPassword = process.env.AUTH_PASSWORD;

    if (!validEmail || !validPassword) {
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 500 }
      );
    }

    if (email === validEmail && password === validPassword) {
      const response = NextResponse.json({ success: true });

      // Set a simple session cookie (expires in 24 hours)
      response.cookies.set("auth_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
