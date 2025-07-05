# Firebase Authentication Setup

This guide will help you set up Firebase Authentication for the Abune Aregawi Church web application.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name (e.g., "abune-aregawi-church")
4. Follow the setup wizard (you can disable Google Analytics for now)

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

## 3. Create a Web App

1. In your Firebase project, click the gear icon next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>) to add a web app
5. Enter an app nickname (e.g., "Abune Aregawi Web")
6. Click "Register app"
7. Copy the Firebase configuration object

## 4. Configure Environment Variables

Create a `.env` file in the `frontend` directory with the following variables:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Backend API URL (optional - defaults to localhost:5000)
REACT_APP_API_URL=http://localhost:5000
```

Replace the values with your actual Firebase configuration.

## 5. Enable Firestore Database (Optional)

If you want to store additional user data:

1. Go to "Firestore Database" in the Firebase console
2. Click "Create database"
3. Choose "Start in test mode" for development
4. Select a location close to your users
5. Click "Done"

## 6. Security Rules

For development, you can use test mode. For production, you'll want to set up proper security rules.

## 7. Test the Setup

1. Start the frontend development server: `npm start`
2. Navigate to `/register` to test user registration
3. Navigate to `/login` to test user login
4. Check that users are created in Firebase Authentication

## 8. Production Considerations

- Set up proper Firestore security rules
- Enable additional authentication methods if needed (Google, Facebook, etc.)
- Configure custom domains for authentication
- Set up email templates for password reset and email verification
- Enable email verification if required

## Troubleshooting

- Make sure all environment variables are prefixed with `REACT_APP_`
- Check the browser console for any Firebase-related errors
- Verify that your Firebase project has Authentication enabled
- Ensure your domain is authorized in Firebase Authentication settings 