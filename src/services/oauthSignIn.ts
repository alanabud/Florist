/**
 * OAuth sign-in policy for Google and Microsoft.
 *
 * Popup is the default. Redirect is only the fallback when the browser
 * reports auth/popup-blocked. Microsoft is configured for personal Outlook
 * accounts and work/school accounts (tenant "common") and always shows the
 * account picker. Google is not restricted to a hosted domain.
 *
 * Auth acceptance is whoever Firebase accepts. This module does not allowlist
 * emails and does not set custom claims. Company membership stays out of band.
 */

export const MICROSOFT_CUSTOM_PARAMETERS = {
  tenant: 'common',
  prompt: 'select_account',
} as const;

/** OIDC scopes plus Microsoft Graph User.Read so personal accounts can return an email. */
export const MICROSOFT_SCOPES = ['openid', 'email', 'profile', 'User.Read'] as const;

export interface OAuthProviderSettings {
  setCustomParameters(params: Record<string, string>): unknown;
  addScope(scope: string): unknown;
}

const providersWithScopes = new WeakSet<object>();

/** Call immediately before every Microsoft sign-in. Safe to call more than once. */
export function applyMicrosoftSignInSettings(provider: OAuthProviderSettings): void {
  provider.setCustomParameters({
    tenant: MICROSOFT_CUSTOM_PARAMETERS.tenant,
    prompt: MICROSOFT_CUSTOM_PARAMETERS.prompt,
  });

  if (providersWithScopes.has(provider)) return;
  for (const scope of MICROSOFT_SCOPES) {
    provider.addScope(scope);
  }
  providersWithScopes.add(provider);
}

export function readAuthError(error: unknown): { code: string; message: string } {
  if (typeof error !== 'object' || error === null) {
    return { code: '', message: typeof error === 'string' ? error : '' };
  }
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : '',
    message: typeof record.message === 'string' ? record.message : '',
  };
}

export function isPopupBlocked(error: unknown): boolean {
  return readAuthError(error).code === 'auth/popup-blocked';
}

/** Redirect is not the default. Only a blocked popup may fall back to it. */
export function popupFailureAction(error: unknown): 'redirect' | 'surface' {
  return isPopupBlocked(error) ? 'redirect' : 'surface';
}

const CANCEL_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/redirect-cancelled-by-user',
]);

export function isUserCancel(error: unknown): boolean {
  return CANCEL_CODES.has(readAuthError(error).code);
}

export function getFriendlyErrorMessage(error: unknown): string {
  const { code, message } = readAuthError(error);

  if (isUserCancel(error)) {
    return 'Sign-in was cancelled. Nothing was changed.';
  }

  // Firebase uses this when the account does not grant the requested permissions.
  if (code === 'auth/user-cancelled' || /access_denied|AADSTS65004/i.test(message)) {
    return 'The sign-in provider did not grant the permissions this app requested. Try again and accept access, or use a different account.';
  }

  if (code === 'auth/popup-blocked') {
    return 'The sign-in popup was blocked, and the full-page sign-in could not start. Allow popups for this site and try again.';
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method. Sign in with the original provider for that email.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Firebase Authentication. Add it under Authentication → Settings → Authorized domains.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is turned off. Enable Google or Microsoft under Authentication → Sign-in method in the Firebase console.';
  }

  if (code === 'auth/user-disabled') {
    return 'This account is disabled. An administrator has to re-enable it before sign-in can succeed.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Wait a moment and try again.';
  }

  if (code === 'auth/web-storage-unsupported') {
    return 'This browser is blocking the site storage sign-in needs. Allow cookies for this site and try again.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'Sign-in was rejected. Check the email and password, or try a different provider.';
  }

  if (code === 'auth/invalid-oauth-client-id' || message.includes('auth/invalid-oauth-client-id')) {
    return 'The identity provider rejected the app configuration (invalid OAuth client). Check the provider in the Firebase console and the matching Azure or Google client id.';
  }

  if (code === 'auth/configuration-not-found' || message.includes('configuration-not-found')) {
    return 'Authentication configuration was not found. Verify the Firebase project and API keys.';
  }

  if (/AADSTS\d+/i.test(message)) {
    return 'Microsoft rejected this sign-in. Confirm the Azure app allows personal and work accounts, the redirect URI matches this Firebase project, and Microsoft is enabled in Firebase Authentication.';
  }

  const cleaned = message.replace(/^Firebase:\s*/i, '').trim();
  if (!cleaned || cleaned.length > 240) {
    return 'Sign-in could not be completed.';
  }
  return cleaned;
}
