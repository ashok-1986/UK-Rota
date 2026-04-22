import { RegisterLink, LoginLink } from '@kinde-oss/kinde-auth-nextjs/components'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CareRota</h1>
        <p className="text-gray-500 mb-8">Sign in to your care home account</p>
        <LoginLink className="w-full block bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition mb-4">
          Sign in
        </LoginLink>
        <RegisterLink className="w-full block border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition">
          Create account
        </RegisterLink>
      </div>
    </div>
  )
}
