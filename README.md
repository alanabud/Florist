# BloomPro Studio

A premium, production-oriented Florist SaaS web app for flower shops, floral studios, and event florists.

## Firebase Authentication Setup

### Microsoft / Azure App Registration Requirements
If you are enabling Microsoft sign-in for Outlook/Hotmail/Work accounts, please ensure the following in your Azure Portal:

1. **Platform**: Configure the app as a `Web` platform.
2. **Redirect URI**: Add the exact Firebase redirect URI:
   `https://florist-d5026.firebaseapp.com/__/auth/handler`
   *(If you later use a custom auth domain, document and add that custom handler URI too.)*
3. **Supported Account Types**: Allow both:
   - Microsoft work/school accounts
   - Personal Microsoft accounts (Outlook/Hotmail)
4. **Secrets**: Provide the generated Microsoft Client ID and Client Secret *directly inside your Firebase Console* (`Authentication > Sign-in method > Microsoft`).
   - **DO NOT** expose the Azure client secret in source code, `.env`, or Vite variables.

### Authorized Domains
Ensure the following domains are added to your authorized domains in the Firebase Console:
- `localhost`
- `florist-d5026.web.app`
- `florist-d5026.firebaseapp.com`
- Any production custom domain you add later.

## Testing Firebase Auth
1. **Email/Password**: Try registering and logging in with a test email.
2. **Google**: Click the Google login button.
3. **Microsoft/Outlook**: Click the Microsoft login button.
4. **Role Assignment**: The very first user to authenticate will be assigned the `owner` role. Subsequent users will be assigned the `staff` role.

*Note: You must explicitly enable these providers in the Firebase Console before testing.*
