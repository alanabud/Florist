import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyMicrosoftSignInSettings,
  getFriendlyErrorMessage,
  MICROSOFT_CUSTOM_PARAMETERS,
  MICROSOFT_SCOPES,
  popupFailureAction,
} from '../src/services/oauthSignIn.ts';

test('Microsoft sign-in asks for common tenant, account picker, and profile scopes', () => {
  const scopes: string[] = [];
  const parameterWrites: Record<string, string>[] = [];
  const provider = {
    setCustomParameters(params: Record<string, string>) {
      parameterWrites.push({ ...params });
    },
    addScope(scope: string) {
      scopes.push(scope);
    },
  };

  applyMicrosoftSignInSettings(provider);
  applyMicrosoftSignInSettings(provider);

  assert.deepEqual(parameterWrites, [
    { tenant: 'common', prompt: 'select_account' },
    { tenant: 'common', prompt: 'select_account' },
  ]);
  assert.deepEqual(MICROSOFT_CUSTOM_PARAMETERS, { tenant: 'common', prompt: 'select_account' });
  assert.deepEqual(scopes, [...MICROSOFT_SCOPES]);
  assert.equal(scopes.includes('openid'), true);
  assert.equal(scopes.includes('email'), true);
  assert.equal(scopes.includes('profile'), true);
  assert.equal(scopes.includes('User.Read'), true);
  assert.equal('hd' in parameterWrites[0], false);
});

test('redirect fallback is only for a blocked popup', () => {
  assert.equal(popupFailureAction({ code: 'auth/popup-blocked' }), 'redirect');
  assert.equal(popupFailureAction({ code: 'auth/popup-closed-by-user' }), 'surface');
  assert.equal(popupFailureAction({ code: 'auth/cancelled-popup-request' }), 'surface');
  assert.equal(popupFailureAction({ code: 'auth/user-cancelled' }), 'surface');
  assert.equal(popupFailureAction({ code: 'auth/redirect-cancelled-by-user' }), 'surface');
  assert.equal(popupFailureAction({ code: 'auth/operation-not-allowed' }), 'surface');
  assert.equal(popupFailureAction(new Error('nope')), 'surface');
});

test('cancel is a calm message and a denial is honest', () => {
  assert.equal(
    getFriendlyErrorMessage({ code: 'auth/popup-closed-by-user' }),
    'Sign-in was cancelled. Nothing was changed.',
  );
  assert.equal(
    getFriendlyErrorMessage({ code: 'auth/redirect-cancelled-by-user' }),
    'Sign-in was cancelled. Nothing was changed.',
  );
  assert.match(
    getFriendlyErrorMessage({ code: 'auth/user-cancelled' }),
    /did not grant the permissions/i,
  );
  assert.match(
    getFriendlyErrorMessage({ code: 'auth/internal-error', message: 'access_denied' }),
    /did not grant the permissions/i,
  );
  assert.match(
    getFriendlyErrorMessage({ code: 'auth/operation-not-allowed' }),
    /turned off/i,
  );
  assert.equal(getFriendlyErrorMessage({}), 'Sign-in could not be completed.');
  assert.doesNotThrow(() => getFriendlyErrorMessage(null));
  assert.doesNotMatch(
    getFriendlyErrorMessage({ code: 'auth/popup-closed-by-user' }),
    /Error 400/,
  );
});

test('OAuth source stays popup-first, unrestricted Google, and does not invent an allowlist', () => {
  const authService = readFileSync(new URL('../src/services/authService.ts', import.meta.url), 'utf8');
  const login = readFileSync(new URL('../src/pages/Login.tsx', import.meta.url), 'utf8');
  const company = readFileSync(new URL('../src/context/CompanyContext.tsx', import.meta.url), 'utf8');

  assert.match(authService, /signInWithPopup/);
  assert.match(authService, /signInWithRedirect/);
  assert.match(authService, /getRedirectResult/);
  assert.match(authService, /new GoogleAuthProvider\(\)/);
  assert.match(authService, /applyMicrosoftSignInSettings\(microsoftProvider\)/);
  assert.doesNotMatch(authService, /hostedDomain|\bhd\s*:/);
  assert.doesNotMatch(authService, /setCustomUserClaims|allowlist|allowedEmails|bloompro\.qa/);
  assert.match(login, /completeRedirectSignIn/);
  assert.match(company, /No client-side membership provisioning/);
  assert.match(company, /bootstrap-default-company-user\.js/);
});
