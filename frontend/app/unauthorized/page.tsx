import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Giriş qadağandır</h1>
        <p className="text-gray-500 mb-6 max-w-sm">
          Bu səhifəyə daxil olmaq üçün lazımi icazəniz yoxdur.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark">
            Əsas Səhifəyə Qayıt
          </Link>
          <Link href="/auth/login" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Daxil Ol
          </Link>
        </div>
      </div>
    </div>
  );
}
