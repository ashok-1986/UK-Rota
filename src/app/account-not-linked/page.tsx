import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components'
import AccountLinkedRedirect from './AccountLinkedRedirect'

export default async function AccountNotLinkedPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; reason?: string }>
}) {
  const { linked, reason } = await searchParams
  const wasLinked = linked === '1'

  const message =
    reason === 'new'
      ? 'Your account has been created. Your administrator needs to link you to a care home before you can access the system.'
      : reason === 'claims-pending'
      ? 'Your account is linked but your access level has not been configured yet. Please contact your administrator to set your role in the system.'
      : 'Your account is not linked to a care home. Please contact your administrator.'

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
            <AccountLinkedRedirect />
            <LogoutLink className="mt-4 block text-blue-600 text-sm hover:underline">
              Or sign out and sign in manually
            </LogoutLink>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">🏥</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {reason === 'new' ? 'Account Created' : reason === 'claims-pending' ? 'Access Pending' : 'Account Not Linked'}
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <LogoutLink className="text-blue-600 text-sm hover:underline">
              Sign out and try another account
            </LogoutLink>
          </>
        )}
      </div>
    </div>
  )
}
