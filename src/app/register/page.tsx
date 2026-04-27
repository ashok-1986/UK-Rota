import { redirect } from 'next/navigation'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { getKindeAuth } from '@/lib/auth'
import RegisterHomeForm from '@/components/onboarding/RegisterHomeForm'

export default async function RegisterPage() {
    const { isAuthenticated, getUser } = getKindeServerSession()

    const authed = await isAuthenticated()

    if (!authed) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏥</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">CareRota</h1>
                    <p className="text-gray-500 mb-8">Get started</p>
                    <a
                        href="/api/auth/kinde/login?post_login_redirect_url=/register"
                        className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
                    >
                        Create your account first
                    </a>
                    <p className="text-xs text-gray-400 mt-4">
                        You&apos;ll create your login credentials, then set up your care home.
                    </p>
                </div>
            </div>
        )
    }

    // Already onboarded?
    const auth = await getKindeAuth()
    if (auth?.homeId) {
        redirect('/dashboard')
    }

    const user = await getUser()

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white p-8 rounded-2xl shadow-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Set up your care home</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Fill in the details below to register your organisation.
                    </p>
                </div>
                <RegisterHomeForm
                    kindeUserId={user?.id ?? ''}
                    kindeEmail={user?.email ?? ''}
                    kindeFirstName={user?.given_name ?? undefined}
                    kindeLastName={user?.family_name ?? undefined}
                />
            </div>
        </div>
    )
}
