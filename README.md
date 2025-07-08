# Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church

A modern, bilingual church management system built with React, Node.js, and Firebase, featuring member registration, children management, and online giving capabilities.

## 🎯 Project Objectives

This application is designed to address the comprehensive needs of church management. For a detailed overview of what this system intends to accomplish, see our **[Project Objectives](Objective.md)** document.

The system aims to:
- Centralize leadership activities and documentation
- Streamline membership and contribution tracking  
- Digitize financial tracking and reporting
- Enhance communication and engagement
- Provide secure role-based access control
- Foster accountability through clear visibility
- Support bilingual operations (English/Tigrigna)

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Frontend (Vercel)"
        A[React App] --> B[Firebase Auth]
        A --> C[API Calls]
    end
    
    subgraph "Backend (Render)"
        D[Node.js/Express] --> E[Sequelize ORM]
        E --> F[PostgreSQL Database]
    end
    
    subgraph "External Services"
        B --> G[Firebase Auth Service]
        F --> H[Neon PostgreSQL]
        I[Vercel CDN] --> A
    end
    
    C --> D
    style A fill:#61dafb
    style D fill:#68a063
    style F fill:#336791
    style G fill:#ffca28
    style H fill:#336791
    style I fill:#000000
```

## 🚀 Deployment Status

| Service | Platform | Status | URL |
|---------|----------|--------|-----|
| **Frontend** | Vercel | ✅ Deployed | [Live Site](https://abune-aregawi.vercel.app/) |
| **Backend API** | Render | ✅ Deployed | [API Endpoint](https://abune-aregawi.onrender.com) |
| **Database** | Neon | ✅ Hosted | PostgreSQL Cloud |
| **Authentication** | Firebase | ✅ Active | Firebase Auth |

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: TailwindCSS
- **State Management**: React Context API
- **Authentication**: Firebase Auth
- **Deployment**: Vercel (with automatic CI/CD)

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **ORM**: Sequelize
- **Validation**: Express-validator
- **Authentication**: JWT + Firebase Auth
- **Deployment**: Render (with automatic CI/CD)

### Database
- **Provider**: Neon (PostgreSQL)
- **Features**: Serverless, auto-scaling
- **SSL**: Enabled
- **Backups**: Automatic

### External Services
- **Authentication**: Firebase Authentication
- **Hosting**: Vercel (Frontend) + Render (Backend)
- **Database**: Neon PostgreSQL
- **Version Control**: GitHub

## 🌐 Features

### ✅ Implemented
- **Bilingual Support**: English and Tigrigna languages with context switching
- **Member Registration**: Multi-step registration form with validation
- **Children Management**: Add, edit, and manage dependents
- **User Authentication**: Firebase Auth with JWT tokens
- **Profile Management**: Update personal and family information
- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Online Giving**: Donation form with payment integration (demo)
- **Dashboard**: Member dashboard with profile overview
- **Database Integration**: PostgreSQL with Sequelize ORM
- **API Security**: JWT authentication and input validation

### 🚧 In Progress
- Payment gateway integration (Stripe)
- Email notifications
- Admin panel development
- Event management system

### 📋 Planned
- Member directory
- Contribution tracking
- Ministry management
- Calendar integration
- PDF report generation
- SMS notifications

## 🔧 Environment Setup

### Frontend Environment Variables (Vercel)
```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_API_URL=https://abune-aregawi.onrender.com
```

### Backend Environment Variables (Render)
```env
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=https://abune-aregawi.vercel.app
PORT=10000
```

## 🚀 Deployment Architecture

```mermaid
graph LR
    subgraph "Development"
        A[Local Development] --> B[GitHub Repository]
    end
    
    subgraph "CI/CD Pipeline"
        B --> C[GitHub Actions]
        C --> D[Vercel Build]
        C --> E[Render Build]
    end
    
    subgraph "Production"
        D --> F[Vercel Frontend]
        E --> G[Render Backend]
        F --> H[Neon Database]
        G --> H
        F --> I[Firebase Auth]
        G --> I
    end
    
    style F fill:#61dafb
    style G fill:#68a063
    style H fill:#336791
    style I fill:#ffca28
```

## 📊 Database Schema

```mermaid
erDiagram
    MEMBERS {
        uuid id PK
        string firstName
        string lastName
        string email UK
        string phoneNumber
        enum gender
        date dateOfBirth
        enum maritalStatus
        string firebaseUid UK
        string loginEmail UK
        enum role
        boolean isActive
    }
    
    CHILDREN {
        uuid id PK
        uuid memberId FK
        string firstName
        string lastName
        date dateOfBirth
        enum gender
        string phone
        string email
        string baptismName
    }
    
    MEMBERS ||--o{ CHILDREN : "has"
```

## 🔐 Security Features

- **Authentication**: Firebase Auth with JWT tokens
- **Authorization**: Role-based access control
- **Input Validation**: Express-validator with custom rules
- **SQL Injection Protection**: Sequelize ORM with parameterized queries
- **CORS**: Configured for production domains
- **Environment Variables**: Secure credential management
- **HTTPS**: Enforced on all production deployments

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (local or Neon)
- Firebase project

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/abune-aregawi.git
cd abune-aregawi

# Install all dependencies
npm run install:all

# Set up environment variables
cp backend/env.example backend/.env
# Edit backend/.env with your database and Firebase credentials
```

### Development
```bash
# Start frontend only
npm run start:frontend

# Start backend only
npm run start:backend

# Start both frontend and backend
npm run dev
```

### Database Setup
```bash
# Initialize database (backend directory)
cd backend
npm run db:init

# Reset database (if needed)
npm run db:reset

# Test database connection
npm run db:test
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - Member registration
- `POST /api/auth/login` - Member login
- `GET /api/auth/profile` - Get user profile

### Members
- `GET /api/members` - List members (admin)
- `PUT /api/members/profile` - Update profile
- `GET /api/members/:id` - Get member details

### Children
- `GET /api/children` - Get user's children
- `POST /api/children` - Add child
- `PUT /api/children/:id` - Update child
- `DELETE /api/children/:id` - Remove child

## 🔄 CI/CD Pipeline

### Vercel (Frontend)
- **Trigger**: Push to main branch
- **Build**: `npm run build`
- **Deploy**: Automatic deployment to Vercel
- **Domain**: Custom domain with SSL

### Render (Backend)
- **Trigger**: Push to main branch
- **Build**: `npm install && npm run build`
- **Deploy**: Automatic deployment to Render
- **Health Check**: `/health` endpoint

## 📊 Monitoring & Analytics

- **Vercel Analytics**: Frontend performance monitoring
- **Render Logs**: Backend application logs
- **Neon Metrics**: Database performance monitoring
- **Firebase Analytics**: User behavior tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (frontend and backend)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Test API endpoints with Postman or similar
- Update documentation for new features

## 🐛 Troubleshooting

### Common Issues

**Frontend Build Failures**
- Check environment variables in Vercel
- Verify Firebase configuration
- Ensure all dependencies are installed

**Backend Deployment Issues**
- Verify DATABASE_URL in Render environment variables
- Check JWT_SECRET is set
- Review Render build logs

**Database Connection Issues**
- Verify Neon connection string
- Check SSL configuration
- Ensure database is accessible from Render

## 📄 License

This project is created for the Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church community.

## 🙏 Acknowledgments

- **Neon** for providing the PostgreSQL database
- **Vercel** for frontend hosting and CI/CD
- **Render** for backend hosting and deployment
- **Firebase** for authentication services
- **TailwindCSS** for the beautiful UI framework

---

*Built with love for the Tigray Orthodox Christian community* 

**Last Updated**: December 2024
**Version**: 1.0.0 