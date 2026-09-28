import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  if (token_hash && type === 'email') {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' });
      if (!error) return NextResponse.redirect(new URL('/conta', request.url));
    } catch {
      /* Never expose tokens in error messages. */
    }
  }
  return NextResponse.redirect(new URL('/auth/erro', request.url));
}
