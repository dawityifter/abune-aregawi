# Abune Aregawi Church Web Application Setup Guide

This guide will help you set up the complete web application for Abune Aregawi Church, including Firebase Authentication, backend API, and environment configuration.

## 🚀 Quick Start

1. **Clone the repository**
2. **Set up environment variables** (see sections below)
3. **Install dependencies**
4. **Start the development servers**

## 📁 Project Structure

```
abune-aregawi/
├── frontend/          # React + TypeScript frontend
├── backend/           # Node.js + Express API
├── .gitignore         # Root gitignore
└── SETUP.md          # This file
```

## 🔐 Environment Variables Setup

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Backend API URL
REACT_APP_API_URL=http://localhost:5000
```

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=abune_aregawi_church
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@abunearegawichurch.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔥 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "abune-aregawi-church"
4. Follow the setup wizard

### 2. Enable Authentication

1. Go to "Authentication" → "Sign-in method"
2. Enable "Email/Password"
3. Click "Save"

### 3. Create Web App

1. Go to "Project settings" (gear icon)
2. Scroll to "Your apps" section
3. Click web icon (</>) 
4. Register app: "Abune Aregawi Web"
5. Copy the config object to your frontend `.env`

### 4. Set up Firestore (Optional)

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode"
4. Select location close to your users

### 5. Get Firebase Admin SDK

1. Go to "Project settings" → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Use the values in your backend `.env`

## 🗄️ Database Setup

### PostgreSQL Setup

1. Install PostgreSQL
2. Create database: `abune_aregawi_church`
3. Create user with appropriate permissions
4. Update backend `.env` with database credentials

### Database Migration

```bash
cd backend
npm run migrate
```

## 📦 Installation

### Frontend

```bash
cd frontend
npm install
npm start
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## 🔒 Security Best Practices

### Environment Variables

✅ **DO:**
- Use `.env` files for local development
- Use environment variables in production
- Keep `.env` files out of version control
- Use strong, unique secrets

❌ **DON'T:**
- Commit `.env` files to git
- Use default/weak secrets
- Share environment files publicly
- Hardcode secrets in code

### Firebase Security

✅ **DO:**
- Set up proper Firestore security rules
- Use Firebase Admin SDK on backend
- Enable email verification
- Set up proper authentication methods

❌ **DON'T:**
- Use test mode in production
- Share Firebase config publicly
- Use weak authentication methods

### JWT Security

✅ **DO:**
- Use strong, random JWT secrets
- Set appropriate expiration times
- Validate tokens on every request
- Use HTTPS in production

❌ **DON'T:**
- Use weak JWT secrets
- Store sensitive data in JWT payload
- Use long expiration times
- Use HTTP in production

## 🚀 Production Deployment

### Environment Variables

1. Set all environment variables in your hosting platform
2. Use strong, unique secrets
3. Enable HTTPS
4. Set up proper CORS origins

### Firebase Production

1. Set up custom domains
2. Configure proper security rules
3. Enable email verification
4. Set up monitoring and alerts

### Database Production

1. Use managed database service
2. Set up automated backups
3. Configure connection pooling
4. Monitor performance

## 🐛 Troubleshooting

### Common Issues

1. **Environment variables not loading**
   - Check file names (`.env`, not `.env.txt`)
   - Restart development server
   - Check for typos in variable names

2. **Firebase connection issues**
   - Verify API keys in `.env`
   - Check Firebase project settings
   - Ensure authentication is enabled

3. **Database connection issues**
   - Verify database credentials
   - Check if database is running
   - Ensure proper permissions

4. **CORS errors**
   - Check `FRONTEND_URL` in backend `.env`
   - Verify frontend URL in browser
   - Check backend CORS configuration

### Getting Help

- Check the browser console for errors
- Check backend logs for API errors
- Verify all environment variables are set
- Ensure all services are running

## 📝 Development Workflow

1. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm start
   ```

2. **Make changes**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`

3. **Test authentication**
   - Register: `http://localhost:3000/register`
   - Login: `http://localhost:3000/login`
   - Dashboard: `http://localhost:3000/dashboard`

## 🔄 Updates and Maintenance

- Keep dependencies updated
- Monitor Firebase usage
- Review security settings regularly
- Backup database regularly
- Monitor application logs

---

**Remember:** Never commit sensitive information like API keys, passwords, or private keys to version control. Always use environment variables for configuration. 