import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

const UserNotRegisteredError = () => {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen public-trading-bg">
      <div className="max-w-md w-full p-8 bg-black/40 rounded-lg shadow-lg border border-white/10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-500/15">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Brak dostępu</h1>
          <p className="text-white/70 mb-8">
            To konto nie ma dostępu do aplikacji. Konta zakłada wyłącznie administrator w Firebase.
          </p>
          <Button className="fx-cta w-full" onClick={() => logout(true)}>
            Wróć do logowania
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
