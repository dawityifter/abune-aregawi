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
    subgraph "Frontend (Firebase Hosting)"
        A[React App] --> B[Firebase Auth]
        A --> C[API Calls]
    end
    
    subgraph "Backend (Render)"
        D[Node.js/Express] --> E[Sequelize ORM]
        E --> F[PostgreSQL Database]
    end
    
    subgraph "External Services"
        B --> G[Firebase Auth Service]
        F --> H[Supabase PostgreSQL]
        I[Firebase CDN] --> A
    end
    
    C --> D
    style A fill:#61dafb
    style D fill:#68a063
    style F fill:#336791
    style G fill:#ffca28
    style H fill:#3ecf8e
    style I fill:#ffca28
    style "External Services" fill:#000000
```

## 🚀 Deployment Status

| Service | Platform | Status | URL |
|---------|----------|--------|-----|
| **Frontend** | Firebase Hosting | ✅ Deployed | [Live Site](https://abune-aregawit-church.web.app/) |
| **Backend API** | Render | 🔄 Deploying | [API Endpoint](https://abune-aregawi-backend.onrender.com) |
| **Database** | Supabase | ✅ Connected | PostgreSQL Cloud (Free Tier) |
| **Authentication** | Firebase | ✅ Active | Phone + Email Auth |

### 📊 Current Status
- ✅ **Frontend**: Successfully deployed to Firebase Hosting with asset fixes
- 🔄 **Backend**: Deploying to Render with enhanced SSL configuration for Supabase
- ✅ **Database**: Supabase PostgreSQL connected and tested locally
- ✅ **Authentication**: Firebase Auth with feature flags for email/phone methods
- 🔄 **Integration**: Pending backend deployment completion

## 🆕 Recent Improvements

### Deployment & Infrastructure
- ✅ **Firebase Hosting**: Migrated from Vercel to Firebase Hosting with asset path fixes
- ✅ **Supabase Integration**: Switched from Neon to Supabase for free PostgreSQL hosting
- ✅ **Enhanced SSL Configuration**: Production-ready SSL config for external database connections
- ✅ **Feature Flags System**: Environment-based toggles for authentication methods
- ✅ **Error Boundaries**: Comprehensive error handling with user-friendly messages

### Authentication & UX
- ✅ **Phone Authentication**: reCAPTCHA Enterprise with test number bypass logic
- ✅ **Bilingual UI**: English default with improved Tigrinya translations
- ✅ **Church Theme**: Custom gradient theme with traditional church styling
- ✅ **Admin Access**: Fixed role extraction and admin panel access issues
- ✅ **Profile Management**: Separate name fields with proper backend synchronization

### Code Quality & Testing
- ✅ **TypeScript Fixes**: Resolved duplicate translation keys and type errors
- ✅ **Debug Cleanup**: Removed all console.log statements for production readiness
- ✅ **Test Infrastructure**: Enhanced backend testing with Jest integration
- ✅ **Phone Number Formatting**: Comprehensive E.164 normalization throughout app

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: TailwindCSS + Custom Church Theme
- **State Management**: React Context API
- **Authentication**: Firebase Auth (Phone + Email)
- **Internationalization**: English/Tigrinya bilingual support
- **Features**: Feature flags system, Error boundaries
- **Deployment**: Firebase Hosting (with automatic CI/CD)

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **ORM**: Sequelize with enhanced SSL configuration
- **Validation**: Express-validator + custom middleware
- **Authentication**: Dual JWT + Firebase Auth
- **Security**: Helmet, CORS, Rate limiting
- **Testing**: Jest with integration and unit tests
- **Deployment**: Render (with automatic GitHub CI/CD)

### Database
- **Provider**: Supabase (PostgreSQL 17.4)
- **Connection**: Enhanced SSL with certificate bypass
- **Features**: Connection pooling, retry logic
- **Tier**: Free tier (500MB storage)
- **SSL**: Production-ready configuration

### External Services
- **Authentication**: Firebase Authentication (Phone/Email)
- **Hosting**: Firebase Hosting (Frontend) + Render (Backend)
- **Database**: Supabase PostgreSQL (Free tier)
- **Version Control**: GitHub with automated deployments
- **reCAPTCHA**: Google reCAPTCHA Enterprise for phone auth

## 🌐 Features

### ✅ Implemented
- **Bilingual Support**: English and Tigrigna languages with context switching (English default)
- **Member Registration**: Multi-step registration form with comprehensive validation
- **Children Management**: Add, edit, and manage dependents with phone number formatting
- **User Authentication**: Dual Firebase Auth (Phone + Email) with feature flags
- **Role-Based Access Control**: Six-tier role system with proper admin access
- **Profile Management**: Separate name fields (first, middle, last) with backend sync
- **Responsive Design**: Mobile-first approach with custom church theme
- **Phone Authentication**: reCAPTCHA Enterprise with test number bypass
- **Dashboard**: Member dashboard with corrected role extraction
- **Admin Panel**: Full admin interface with member/role management
- **Database Integration**: Supabase PostgreSQL with enhanced SSL configuration
- **API Security**: Dual JWT + Firebase authentication with comprehensive validation
- **Feature Flags**: Environment-based authentication method toggles
- **Error Handling**: User-friendly error messages and retry mechanisms
- **Deployment**: Production-ready Firebase Hosting + Render deployment

### 🚧 In Progress
- **Backend Deployment**: Final Render deployment with Supabase connection
- **API Integration**: Connecting deployed frontend to deployed backend
- **Payment Gateway**: Stripe integration for online giving
- **Email Notifications**: Member communication system

### 📋 Planned
- Member directory
- Contribution tracking
- Ministry management
- Calendar integration
- PDF report generation
- SMS notifications

## 🔧 Environment Setup

### Frontend Environment Variables (Firebase Hosting)
```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# API Configuration
REACT_APP_API_URL=https://abune-aregawi-backend.onrender.com

# Feature Flags
REACT_APP_ENABLE_EMAIL_AUTH=true
REACT_APP_ENABLE_PHONE_AUTH=true
REACT_APP_DEFAULT_AUTH_METHOD=phone
```

### Backend Environment Variables (Render)
```env
# Environment
NODE_ENV=production
PORT=10000

# Database (Supabase)
DATABASE_URL=postgresql://postgres.project_ref:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Authentication
JWT_SECRET=your_secure_jwt_secret_key
FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_encoded_service_account

# CORS
FRONTEND_URL=https://abune-aregawit-church.web.app
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

## 👥 Role-Based Access Control (RBAC)

The system implements a comprehensive role-based access control system with six distinct roles, each with specific permissions and access levels. This ensures that users can only access features and data appropriate to their role within the church community.

### 🔑 Role Hierarchy

```mermaid
graph TD
    A[Guest] --> B[Member]
    B --> C[Secretary]
    B --> D[Treasurer]
    B --> E[Church Leadership]
    C --> F[Admin]
    D --> F
    E --> F
    
    style A fill:#ff9999
    style B fill:#99ccff
    style C fill:#99ff99
    style D fill:#ffcc99
    style E fill:#cc99ff
    style F fill:#ff6666
```

### 📋 Role Descriptions & Permissions

#### 🚪 **Guest** (Limited Access)
**Description**: Unregistered visitors with minimal access to public information.

**Permissions**:
- ✅ View public church information
- ✅ Access landing page and general content
- ✅ Register as a new member
- ✅ View basic church announcements

**Restrictions**:
- ❌ No access to member directory
- ❌ Cannot view financial information
- ❌ No access to admin features
- ❌ Cannot manage children records

---

#### 👤 **Member** (Standard Access)
**Description**: Registered church members with access to personal and family management features.

**Permissions**:
- ✅ View and edit personal profile
- ✅ Manage children records (add, edit, delete)
- ✅ Access member dashboard
- ✅ View personal contribution history
- ✅ Update contact information
- ✅ Access bilingual content
- ✅ Submit online donations

**Restrictions**:
- ❌ Cannot view other members' information
- ❌ No access to financial reports
- ❌ Cannot manage church-wide settings

---

#### 📝 **Secretary** (Administrative Support)
**Description**: Church administrative staff responsible for member records and documentation.

**Permissions**:
- ✅ All Member permissions
- ✅ View member directory (read-only)
- ✅ Access member registration data
- ✅ Generate member reports
- ✅ Manage member status (active/inactive)
- ✅ Export member data
- ✅ Access bilingual content management

**Restrictions**:
- ❌ Cannot modify financial records
- ❌ No access to treasury functions
- ❌ Cannot change member roles

---

#### 💰 **Treasurer** (Financial Management)
**Description**: Church financial officer responsible for financial tracking and reporting.

**Permissions**:
- ✅ All Member permissions
- ✅ View financial reports and summaries
- ✅ Access donation and contribution data
- ✅ Generate financial reports
- ✅ Track online and offline donations
- ✅ Export financial data
- ✅ View member contribution history

**Restrictions**:
- ❌ Cannot modify member records
- ❌ No access to member management features
- ❌ Cannot change system settings

---

#### ⛪ **Church Leadership** (Leadership Access)
**Description**: Church leaders, elders, and ministry heads with broad administrative access.

**Permissions**:
- ✅ All Secretary and Treasurer permissions
- ✅ Full member directory access
- ✅ Manage member roles (except admin)
- ✅ Access all church reports
- ✅ View ministry and activity data
- ✅ Manage church announcements
- ✅ Access leadership dashboard

**Restrictions**:
- ❌ Cannot modify system configuration
- ❌ No access to admin-only features
- ❌ Cannot change admin roles

---

#### 🔧 **Admin** (Full System Access)
**Description**: System administrators with complete access to all features and data.

**Permissions**:
- ✅ **Complete system access**
- ✅ All permissions from other roles
- ✅ Manage all user roles and permissions
- ✅ Access admin dashboard and analytics
- ✅ System configuration and settings
- ✅ Database management and backups
- ✅ User account management
- ✅ Security and audit logs
- ✅ API endpoint management
- ✅ Content management system

**Key Features**:
- 🔐 **Role Management**: Assign and modify user roles
- 📊 **Analytics Dashboard**: View system usage and statistics
- 👥 **Member Management**: Full CRUD operations on all members
- 🔧 **System Settings**: Configure application parameters
- 📈 **Reports**: Generate comprehensive system reports

---

### 🔄 Role Assignment & Management

#### **Automatic Role Assignment**
- **New Registrations**: Automatically assigned "Member" role
- **Firebase Integration**: Roles synchronized between Firebase and PostgreSQL
- **Role Inheritance**: Higher roles inherit permissions from lower roles

#### **Manual Role Management**
- **Admin Assignment**: Only existing admins can assign admin roles
- **Role Promotion**: Church leadership can promote members to secretary/treasurer
- **Role Demotion**: Admins can modify any user's role
- **Audit Trail**: All role changes are logged for security

#### **Role Validation**
- **Database Consistency**: Roles validated against PostgreSQL enum values
- **Frontend Validation**: Role-based UI rendering and access control
- **API Protection**: Backend middleware enforces role-based permissions

### 🛡️ Security Implementation

#### **Frontend Security**
```typescript
// Role-based component rendering
{userRole === 'admin' && <AdminDashboard />}
{['admin', 'church_leadership'].includes(userRole) && <MemberDirectory />}
{['admin', 'treasurer'].includes(userRole) && <FinancialReports />}
```

#### **Backend Security**
```javascript
// Role-based middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'access.denied' 
      });
    }
    next();
  };
};
```

#### **API Endpoint Protection**
- **Public Endpoints**: `/api/auth/register`, `/api/auth/login`
- **Member Endpoints**: Profile management, children management
- **Admin Endpoints**: User management, system configuration
- **Role-Specific Endpoints**: Financial reports, member directory

### 📊 Role Statistics & Analytics

The admin dashboard provides insights into role distribution and usage:

- **Role Distribution**: Percentage of users in each role
- **Activity Metrics**: Usage patterns by role
- **Access Logs**: Track role-based feature usage
- **Security Alerts**: Monitor for unusual access patterns

### 🔐 Best Practices

1. **Principle of Least Privilege**: Users receive minimum necessary permissions
2. **Role Separation**: Financial and administrative functions are separated
3. **Regular Audits**: Periodic review of role assignments
4. **Secure Role Changes**: All role modifications require proper authorization
5. **Audit Logging**: Complete trail of role changes and access patterns

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

**Last Updated**: July 2025
**Version**: 1.1.0 
