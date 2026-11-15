import { useAuthStore } from '../store';

/**
 * React hook exposing auth state and actions without leaking Zustand internals.
 */
export function useAuth() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const authError = useAuthStore((state) => state.authError);
  const loginNotice = useAuthStore((state) => state.loginNotice);
  const oneTimeRecoveryCodes = useAuthStore((state) => state.oneTimeRecoveryCodes);
  const postRegisterCodesPending = useAuthStore((state) => state.postRegisterCodesPending);

  const validateSession = useAuthStore((state) => state.validateSession);
  const ensureActiveUserId = useAuthStore((state) => state.ensureActiveUserId);
  const register = useAuthStore((state) => state.register);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const recoverPassword = useAuthStore((state) => state.recoverPassword);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const regenerateRecoveryCodes = useAuthStore((state) => state.regenerateRecoveryCodes);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const acknowledgeRegistrationCodes = useAuthStore((state) => state.acknowledgeRegistrationCodes);
  const dismissOneTimeRecoveryCodes = useAuthStore((state) => state.dismissOneTimeRecoveryCodes);
  const clearAuthError = useAuthStore((state) => state.clearAuthError);
  const clearLoginNotice = useAuthStore((state) => state.clearLoginNotice);

  return {
    currentUser,
    isAuthenticated,
    isInitialized,
    isSubmitting,
    authError,
    loginNotice,
    oneTimeRecoveryCodes,
    postRegisterCodesPending,
    validateSession,
    ensureActiveUserId,
    register,
    login,
    logout,
    recoverPassword,
    updateProfile,
    changePassword,
    regenerateRecoveryCodes,
    deleteAccount,
    acknowledgeRegistrationCodes,
    dismissOneTimeRecoveryCodes,
    clearAuthError,
    clearLoginNotice,
  };
}
