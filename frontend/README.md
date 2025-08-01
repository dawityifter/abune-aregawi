# Abune Aregawi Church - Frontend

This is the frontend application for Abune Aregawi Church, built with React and Firebase.

## Development

### Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

## Deployment

### Manual Deployment

1. Build the app: `npm run build`
2. Deploy to Firebase: `firebase deploy --only hosting`

### Automated Deployment with GitHub Actions

The project includes a GitHub Actions workflow that automatically deploys the app to Firebase when changes are pushed to the `main` branch.

#### Setup Instructions

1. **Generate a Firebase CI token**:
   ```bash
   firebase login:ci
   ```
   This will give you a token that you'll add to GitHub Secrets.

2. **Add the following secrets to your GitHub repository**:
   - Go to your repository on GitHub
   - Click on "Settings" > "Secrets and variables" > "Actions"
   - Click "New repository secret" and add:
     - `FIREBASE_TOKEN`: The token you generated in step 1
     - `REACT_APP_API_URL`: Your backend API URL
     - `REACT_APP_FIREBASE_API_KEY`: Your Firebase API key
     - `REACT_APP_FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain
     - `REACT_APP_FIREBASE_PROJECT_ID`: Your Firebase project ID
     - `REACT_APP_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket
     - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID
     - `REACT_APP_FIREBASE_APP_ID`: Your Firebase app ID
     - `REACT_APP_FIREBASE_MEASUREMENT_ID`: Your Firebase measurement ID (if using Analytics)
     - `REACT_APP_RECAPTCHA_SITE_KEY`: Your reCAPTCHA site key (for phone authentication)

3. **Push to the main branch**:
   The workflow will automatically run when you push to the main branch.

#### Manual Trigger

You can also manually trigger the deployment from the GitHub Actions tab in your repository.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
