import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { resolveProductRoute } from '@/repositories/product-routes';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/produtos/')) {
    const slug = request.nextUrl.pathname.slice('/produtos/'.length);
    try {
      const canonical = await resolveProductRoute(slug);
      if (!canonical)
        return NextResponse.rewrite(new URL('/produto-nao-encontrado', request.url), {
          status: 404,
        });
      if (canonical !== slug) {
        const target = request.nextUrl.clone();
        target.pathname = `/produtos/${canonical}`;
        return NextResponse.redirect(target, 308);
      }
      return NextResponse.next();
    } catch {
      return new Response('Catálogo temporariamente indisponível. Tente novamente.', {
        status: 503,
      });
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    '/produtos/:path+',
    '/login',
    '/cadastro',
    '/admin/:path*',
    '/conta/:path*',
    '/auth/:path*',
    '/checkout/:path*',
    '/atacado/:path*',
  ],
};
