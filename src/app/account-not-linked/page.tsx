import { SignOutButton } from '@clerk/nextjs'
import AccountLinkedRedirect from './AccountLinkedRedirect'

export default async function AccountNotLinkedPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>
}) {
  const { linked } = await searchParams
  const wasLinked = linked === '1'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
        {wasLinked ? (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Linked!</h1>
            <p className="text-gray-600 mb-6">
              Your account has been linked to your care home.
            </p>
            {/* Reloads the Clerk session JWT so fresh metadata is available, then redirects */}
            <AccountLinkedRedirect />
            <SignOutButton redirectUrl="/sign-in">
              <button className="mt-4 text-blue-600 text-sm hover:underline">
                Or sign out and sign in manually
              </button>
            </SignOutButton>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Not Linked</h1>
            <p className="text-gray-600 mb-6">
              Your account is not linked to a care home. Please contact your administrator.
            </p>
            <SignOutButton redirectUrl="/sign-in">
              <button className="text-blue-600 text-sm hover:underline">
                Sign out and try another account
              </button>
            </SignOutButton>
          </>
        )}
      </div>
    </div>
  )
}
