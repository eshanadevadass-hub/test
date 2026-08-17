/* Fill this in with your own Firebase project's config, from:
   Firebase console > Project settings (gear icon) > General tab >
   "Your apps" > the Web app (</>) you registered > SDK setup and configuration.

   The apiKey below is NOT a secret -- Firebase access is controlled by the
   Firestore security rules on the project, not by hiding this value, so it's
   fine for this file to be public/committed.

   Until every PASTE_... placeholder below is replaced with a real value,
   username uniqueness only applies per-device (the app's original, fully
   local behaviour) -- signUp/updateUsername detect the placeholder and skip
   the global check rather than breaking. */
window.FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
  appId: "PASTE_YOUR_APP_ID_HERE"
};
