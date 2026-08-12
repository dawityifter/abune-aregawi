# Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church

A modern, bilingual (English/Tigrigna) church management system built with React, Node.js/Express, Firebase, and PostgreSQL. Features comprehensive member registration, financial tracking, role-based access control, SMS communications, and department management for church operations.

**Status**: ✅ Production-Ready | **Frontend**: Firebase Hosting | **Backend**: OCI Compute | **Database**: Supabase PostgreSQL

## 🎯 Project Objectives

This application is designed to address the comprehensive needs of church management. For a detailed overview of what this system intends to accomplish, see our **[Project Objectives](docs/Objective.md)** document.

The system aims to:
- Centralize leadership activities and documentation
- Streamline membership and contribution tracking  
- Digitize financial tracking and reporting with granular role-based permissions
- Enhance communication and engagement through SMS and department management
- Provide secure role-based access control (7+ specialized roles)
- Foster accountability through clear visibility and audit trails
- Support bilingual operations (English/Tigrigna) with proper internationalization

## 🏗️ Architecture Overview

### System Architecture Diagram
```mermaid
graph TB
    User["👤 User"]
    
    subgraph "Frontend Layer"
        FE["React 18 + TypeScript<br/>TailwindCSS<br/>Firebase Auth"]
        i18n["i18n Context<br/>English/Tigrigna"]
    end
    
    subgraph "Authentication"
        FB["Firebase Auth<br/>Phone + Email"]
        JWT["JWT Tokens<br/>Dual Verification"]
    end
    
    subgraph "Backend Layer"
        API["Express.js API<br/>Controllers + Routes"]
        Services["Service Layer<br/>Business Logic<br/>GL Codes, Payments,<br/>Reconciliation"]
        Models["Sequelize Models<br/>33 Models,<br/>67+ Migrations"]
    end
    
    subgraph "External Services"
        Twilio["Twilio<br/>SMS Broadcasting"]
        Stripe["Stripe<br/>Payments"]
        Sheets["Google Sheets<br/>Ledger Export"]
    end
    
    subgraph "Data Layer"
        PG["PostgreSQL 17.4<br/>Supabase"]
    end
    
    User -->|HTTPS| FE
    FE -->|Auth Flow| FB
    FE -->|getIdToken| JWT
    FE -->|API Calls| API
    FE <-->|Language| i18n
    
    API -->|Verify JWT| JWT
    API -->|Business Rules| Services
    API -->|Query/Write| Models
    
    Services -->|Send SMS| Twilio
    Services -->|Process Payments| Stripe
    Services -->|Export Ledger| Sheets
    
    Models -->|SQL Queries| PG
    
    style FE fill:#61a0d4
    style Services fill:#8ec5fc
    style JWT fill:#90EE90
    style Twilio fill:#FFB6C1
```

### Deployment Architecture
```mermaid
graph LR
    Internet["🌐 Internet"]
    
    subgraph "Firebase Hosting"
        FE_PROD["React App<br/>abune-aregawi-church-app.web.app"]
    end
    
    subgraph "OCI Compute (Always-Free)"
        BE_PROD["Express.js Backend<br/>api.abunearegawi.church<br/>Port 10000"]
    end
    
    subgraph "Supabase"
        DB_PROD["PostgreSQL 17.4<br/>Free Tier<br/>500MB Storage"]
    end
    
    subgraph "CI/CD"
        GH["GitHub Actions<br/>on push → main"]
    end
    
    Internet -->|DNS: abune-aregawi-church-app.web.app| FE_PROD
    FE_PROD -->|HTTPS| BE_PROD
    BE_PROD -->|TCP 6543<br/>Connection Pool| DB_PROD
    GH -->|Deploy| FE_PROD
    GH -->|Deploy SSH| BE_PROD
    
    style FE_PROD fill:#FFD700
    style BE_PROD fill:#90EE90
    style DB_PROD fill:#87CEEB
```

### Role-Based Access Control (RBAC)

The system implements 7+ specialized roles with granular permissions:

| Role | Tier | Permissions | Use Case |
|------|------|-------------|----------|
| **Guest** | 0 | View-only public content | Non-members, visitors |
| **Member** | 1 | Profile, personal info, payment history | All registered members (auto-assigned) |
| **Treasurer** | 2 | All financial operations (legacy, being phased out) | Department heads, finance team |
| **Bookkeeper** | 3 | Daily financial ops, income/expense recording, bank reconciliation | Finance operations |
| **AR Team** | 4 | Income/donations only (read/write) | Accounts receivable staff |
| **AP Team** | 5 | Expenses/vendor payments only (read/write) | Accounts payable staff |
| **Budget Committee** | 6 | Financial read-only + budget approval authority | Leadership, planning committee |
| **Auditor** | 7 | Financial and system audit read-only access | External/internal auditors |
| **Church Leadership** | 8 | Department management, limited financial visibility, SMS access | Pastors, elders, deacons |
| **Admin** | 9 | Full system access (users, roles, configuration) | System administrators |
| **Secretary** | 10 | SMS/communication access, member search, basic reporting | Administrative support |
| **Onboarding Coordinator** | 11 | New member workflow management | Membership intake |

**Permission Categories**:
- `canManageMembers`: Create/edit member profiles
- `canManageIncome`: Record donations, pledges, tithes
- `canManageExpenses`: Record vendor payments, reimbursements
- `canApprovePayments`: Approve payment requests
- `canAccessFinancialReports`: View financial dashboards and reports
- `canManageDepartments`: Create/edit departments and assignments
- `canSendCommunications`: Send SMS broadcasts
- `canAccessAuditLogs`: View system audit trails
- `canManageRoles`: Assign/modify user roles (Admin only)

### Database Schema Overview

**33 Sequelize Models** across key domains:

**Membership**
- `Member` (id, firebaseUid, firstName, middleName, lastName, email, phoneNumber, status, rolesJson, etc.)
- `Dependent` (memberId, firstName, relationship, dateOfBirth, etc.)
- `MemberNote` (memberId, content, createdBy, createdAt, etc.)

**Organization**  
- `Department` (id, name, type, description, leaderId, parentDepartmentId, isActive, isPublic, etc.)
- `DepartmentMember` (departmentId, memberId, role, etc.)

**Financial**
- `Transaction` (id, memberId, amount, type, method, paymentDate, reference, etc.)
- `LedgerEntry` (id, transactionId, glCode, accountName, amount, description, etc.)
- `GLCode` (code, name, category, type, isActive, etc.)
- `MemberLoan` (memberId, amount, disbursedDate, dueDate, status, etc.)
- `Vendor` (id, name, email, phone, address, paymentTerms, etc.)
- `ExpenseRequest` (vendorId, amount, description, status, approvedBy, etc.)

**Communication**
- `SMSLog` (id, senderId, recipientId, departmentId, message, status, sentAt, etc.)
- `EmailLog` (id, senderId, recipientId, subject, body, status, sentAt, etc.)

**Configuration & Audit**
- `Role` (name, displayName, permissions, tier, createdAt, etc.)
- `SystemAuditLog` (userId, action, resourceType, resourceId, changes, ipAddress, timestamp, etc.)
- `SystemConfig` (key, value, description, updatedBy, updatedAt, etc.)

Plus 10+ other models for payments, pledges, expenses, budget tracking, etc.

**Migration Strategy**:
- Primary: `backend/migrations/` (sequelize-cli tracked in SequelizeMeta table)
- Legacy: `backend/src/database/migrations/` (manual ad-hoc scripts for complex operations)
- See [db-migrations SKILL.md](./.claude/skills/db-migrations/SKILL.md) for detailed procedures

## 🚀 Deployment Status

| Service | Platform | Status | URL |
|---------|----------|--------|-----|
| **Frontend** | Firebase Hosting | ✅ Active | [abune-aregawi-church-app.web.app](https://abune-aregawi-church-app.web.app) |
| **Backend API** | OCI Compute | ✅ Active | [api.abunearegawi.church](https://api.abunearegawi.church) |
| **Database** | Supabase PostgreSQL | ✅ Connected | PostgreSQL 17.4 (Free Tier) |
| **Authentication** | Firebase | ✅ Active | Phone + Email Auth |
| **CI/CD** | GitHub Actions | ✅ Automated | Auto-deploys on push to main |

### 📊 System Status
- ✅ **Frontend**: Successfully deployed to Firebase Hosting with auto CI/CD
- ✅ **Backend**: Deployed to OCI Compute with Supabase PostgreSQL integration
- ✅ **Database**: Supabase connected with enhanced SSL configuration
- ✅ **Authentication**: Firebase Auth with phone and email methods
- ✅ **Integration**: Frontend ↔ Backend ↔ Database fully operational
- ✅ **SMS Gateway**: Twilio SMS system operational for communications and broadcasts

## 📋 Implementation & Development

### 11-Agent Specialized Suite (August 2026)
✅ **Multi-Agent Architecture**: Deployed 11 specialized sub-agents for solo development
- **Tier 1 (Opus)**: Backend API Layer, Business Logic & Services, Database & ORM, Java Migration Lead
- **Tier 2 (Sonnet)**: Security & Vulnerabilities, UI/UX & Design System  
- **Tier 3-4 (Haiku)**: Auth Specialist, External Integrations, Frontend Component Developer, Testing & QA, Documentation Specialist
- **Benefits**: Parallel async work, embedded code quality review, clear domain boundaries, skill library for reusable procedures
- **Skills Library**: db-migrations, payment-reconciliation, ledger-sheets-export (+ framework for adding more)
- **Use**: Agents automatically route user requests to appropriate specialist; coordinate complex multi-domain features

## 🆕 Recent Improvements

### Financial Management Enhancements (January 2026 – August 2026)
- ✅ **Granular Financial Roles**: Expanded Treasurer role into specialized functions
  - **Bookkeeper**: Daily financial operations, income/expense recording, bank reconciliation
  - **AR Team** (Accounts Receivable): Income/donations focus with dedicated dashboard
  - **AP Team** (Accounts Payable): Expenses/vendor payments focus with vendor tracking
  - **Budget Committee**: Read-only oversight with budget approval authority
  - **Auditor**: Strict read-only access for financial and system log auditing
- ✅ **Enhanced RBAC**: Fine-grained permissions (canManageIncome, canManageExpenses, canApprovePayments)
- ✅ **Payment Validation**: Minimum $1.00 payment amounts enforced across all payment types
- ✅ **GL Code System**: Income and expense GL codes with hierarchical categorization
- ✅ **Expense Tracking**: Complete expense workflow (vendor management, reimbursement requests, approval chains)
- ✅ **Ledger System**: Dual-write architecture (Transactions + Ledger Entries) for complete financial audit trail
- ✅ **Bank Reconciliation**: Zelle email integration, automatic transaction matching to members
- ✅ **Anonymous Donations**: Full support for non-member and truly anonymous donations with optional donor information

### SMS & Communications (October 2025 – Present)
- ✅ **Department SMS Broadcasting**: Send messages to entire departments via Twilio
  - Target all members of a ministry, committee, or service team
  - Department dropdown with filtering and member count
  - Batch sending with rate limiting (20 concurrent, 1s delay)
  - Success tracking with detailed delivery counts and logs
- ✅ **Multi-Target Messaging**: Individual, group, department, or broadcast-to-all
  - Real-time member search with filtering by name, ID, phone, email
  - Role-based access control (Admin, Church Leadership, Secretary with canSendCommunications permission)
  - Comprehensive logging to sms_logs table with sender, recipient, status
- ✅ **Communications Dashboard**: Cards visible to authorized roles with quick links to SMS/Outreach features

### Department Management (October 2025 – Present)
- ✅ **Complete Department System**: Full CRUD operations with hierarchy support
  - Create, edit, delete departments (ministries, committees, service teams, etc.)
  - Assign department leaders with enhanced member selection (displays ID, phone, email)
  - Parent/sub-department relationships for organizational hierarchy
  - Active/inactive status and public visibility toggling
  - Department member tracking with member count
- ✅ **Member Department Assignment**: Manage department memberships
  - Add multiple members with role assignment (Leader, Coordinator, Member)
  - Remove members and update department roles
  - Search members by name, ID, phone, email with instant filtering
  - Visual member list with contact information display
- ✅ **Enhanced Search & Filtering**: Improved UX for large member lists
  - Real-time search in leader selection dropdowns and member search modals
  - Filter by name, member ID, phone, email with filtered count display
  - Fast performance even with 500+ member records
- ✅ **Route Preservation**: Improved navigation experience
  - Page refresh maintains current route (e.g., /admin, /treasurer, /dashboard)
  - No unwanted redirects to dashboard on refresh
  - Proper login flow with intended route preservation
- ✅ **API Optimization**: Significant reduction in API payload size
  - 66% reduction in member list data transfer (30+ → 10 essential fields)
  - Faster page loads and improved mobile performance
  - Only returns fields actually used by frontend components

### Financial Management (October 2025 – August 2026)
- ✅ **Payment Overview Dashboard**: Pledge-based statistics with real-time metrics
  - Computes member payment status from `yearly_pledge` and actual payments
  - "Contributing Members" metric shows members with active pledges
  - Up-to-date vs Behind tracking based on expected-to-date calculations
  - Uses normalized `ledger_entries` table for consistent reporting
- ✅ **Anonymous Payment Support**: Full treasurer capability for non-member donations
  - Accept payments from truly anonymous donors, named non-members, or organizations
  - Separate donor fields: type (Individual/Organization), name, email, phone, memo
  - All payment methods supported (cash, check, card, ACH, online)
  - Business rule: Membership dues require a member (cannot be anonymous)
  - Transaction list displays anonymous donations with "Non-Member" badge
- ✅ **Payment Validation**: Minimum payment amount of $1.00 enforced
  - Frontend validation with clear error messages
  - Backend validation at controller and model levels (applied to all payment types)
- ✅ **Expense & Income GL Codes**: Hierarchical categorization system
  - Income GL codes (100-199 range) with types: Tithes, Offerings, Pledges, Special Collections
  - Expense GL codes (500-599 range) with types: Salaries, Utilities, Supplies, Maintenance
  - GL code allocation during transaction creation with validation
- ✅ **Dual-Write Architecture**: Transactional consistency
  - Every transaction creates matching ledger entry for audit trail
  - Transactions table for operational queries
  - Ledger entries for financial reporting and reconciliation
  - Consistent payment method and fund categorization

### Code Quality & Infrastructure (Ongoing)
- ✅ **TypeScript Strictness**: Full strict mode for type safety
- ✅ **Jest Testing**: Comprehensive backend and frontend test suites
- ✅ **Pre-commit Hooks**: Linting and format validation
- ✅ **Debug Cleanup**: Production-ready code (no console.log statements)
- ✅ **Error Boundaries**: User-friendly error handling throughout app
- ✅ **Phone Number Normalization**: E.164 format throughout system
- ✅ **CI/CD Pipeline**: Automated tests, builds, and deployments via GitHub Actions
- ✅ **Bilingual Support**: English/Tigrigna with proper locale handling

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript (strict mode)
- **Styling**: TailwindCSS + Custom Church Theme with gradients
- **State Management**: React Context API
- **Authentication**: Firebase Auth SDK (Phone + Email with reCAPTCHA)
- **Internationalization**: Custom i18n context (English/Tigrigna)
- **Testing**: Jest + React Testing Library with utilities
- **Router**: React Router v7 with future-flags enabled
- **Deployment**: Firebase Hosting with auto CI/CD

### Backend
- **Runtime**: Node.js 18+ with Express.js framework
- **ORM**: Sequelize 6 with 33 models and 67+ migrations
- **Database**: PostgreSQL 17.4 via Supabase with connection pooling
- **Authentication**: Firebase Admin SDK + dual JWT + custom middleware
- **Validation**: express-validator with custom rules
- **Security**: Helmet, CORS, rate limiting, input sanitization
- **SMS Gateway**: Twilio SDK integration for communications
- **Testing**: Jest with integration and unit test suites
- **Logging**: Comprehensive audit trails for financial and SMS operations
- **Deployment**: OCI Compute via automated GitHub Actions

### External Services
- **Authentication**: Firebase Authentication (Phone/Email methods)
- **Hosting**: Firebase Hosting (Frontend) + OCI Compute (Backend)
- **Database**: Supabase PostgreSQL (Free tier, 500MB storage)
- **SMS**: Twilio for SMS broadcasting and communications
- **Security**: Google reCAPTCHA Enterprise for phone auth
- **Version Control**: GitHub with automated CI/CD pipelines
- **Future**: Stripe for online payment processing

### Development Tools
- **Package Manager**: npm (monorepo with root, frontend/, backend/)
- **Build**: Create React App (CRA) for frontend
- **Testing**: Jest (frontend & backend) + React Testing Library
- **Linting**: ESLint with react-app config
- **Code Quality**: TypeScript strict mode, pre-commit hooks
- **Debugging**: VS Code debugger support, Firebase emulator
- **Documentation**: Markdown with Mermaid diagrams

## 🌐 Features

### ✅ Core Features (Implemented & Production-Ready)

**Membership & Organization**
- ✅ Bilingual Support (English/Tigrigna) with context-based switching
- ✅ Member Registration: Multi-step form with comprehensive validation
- ✅ Children/Dependents Management: Add, edit, manage with proper data validation
- ✅ User Authentication: Firebase Auth (Phone + Email) with reCAPTCHA Enterprise
- ✅ Role-Based Access Control: 7+ specialized roles with granular permissions
- ✅ Profile Management: First, middle, last name fields with backend synchronization
- ✅ Responsive Design: Mobile-first with custom church theme and gradients
- ✅ Dashboard: Role-specific dashboards with relevant cards and metrics
- ✅ Admin Panel: Full admin interface with member/role/department management

**Financial Management**
- ✅ Payment Recording: All payment methods (cash, check, card, ACH, online)
- ✅ Payment Overview Dashboard: Pledge-based statistics and contributing members tracking
- ✅ Anonymous Donations: Accept non-member donations with optional donor info
- ✅ Payment Validation: Minimum $1.00 amounts enforced
- ✅ GL Code System: Income/expense categorization with GL code assignment
- ✅ Ledger System: Dual-write architecture for complete audit trail
- ✅ Treasurer Dashboard: Financial reports, transaction history, contribution tracking
- ✅ Specialized Roles: Bookkeeper, AR Team, AP Team, Budget Committee, Auditor
- ✅ Bank Reconciliation: Zelle email integration with automatic transaction matching
- ✅ Expense Tracking: Vendor management, reimbursement requests, approval workflows

**Communications & Outreach**
- ✅ SMS Broadcast System: Department-based or member-targeted SMS via Twilio
- ✅ Batch Messaging: Rate-limited batch sending (20 concurrent, 1s delay)
- ✅ Message Logging: Complete audit trail in sms_logs table
- ✅ Search & Filtering: Real-time member search by name, ID, phone, email
- ✅ Relationship Department Tools: Member engagement, follow-up tracking, notes
- ✅ Role-Based Permissions: SMS access controlled by role permissions

**Department Management**
- ✅ Department CRUD: Create, edit, delete departments with hierarchy
- ✅ Leader Assignment: Select department leaders with member details display
- ✅ Member Management: Assign/remove members with role tracking
- ✅ Hierarchy Support: Parent/sub-department relationships
- ✅ Status Management: Active/inactive and public visibility toggles
- ✅ Enhanced Search: Fast filtering of large member lists
- ✅ Member Count Tracking: Visual display of department composition

### 🚧 In Progress / Planned
- **Stripe Payment Gateway**: Online donation processing and subscription management
- **Email Notifications**: Member communication system with templates
- **Report Generation**: PDF exports for financial and membership reports
- **Calendar Integration**: Church calendar with events and scheduling
- **Vendor Management**: Advanced AP features (vendor portal, invoice matching, recurring payments)
- **Budget Planning**: Budget creation, approval, and variance analysis
- **Activity Audit Logs**: Enhanced system logging for compliance and security audits


## 🔧 Environment Setup & Configuration

### Quick Start Commands
```bash
# Install all dependencies
npm run install:all

# Development (frontend + backend concurrently)
npm run dev

# Frontend only
npm run dev:frontend

# Backend only  
npm run dev:backend

# Run tests
npm run test                    # all tests
npm run test:backend            # backend only
npm run test:frontend           # frontend only
npm run test:coverage           # with coverage report

# Build for production
npm run build                   # frontend only
cd backend && npm run build     # backend build (if applicable)
```

### Frontend Environment Variables
Create `frontend/.env.local`:
```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# API Configuration
REACT_APP_API_URL=http://localhost:5001  # local dev; use https://api.abunearegawi.church in prod

# Feature Flags
REACT_APP_ENABLE_EMAIL_AUTH=true
REACT_APP_ENABLE_PHONE_AUTH=true
REACT_APP_DEFAULT_AUTH_METHOD=phone

# Google reCAPTCHA (for phone auth)
REACT_APP_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

### Backend Environment Variables
Create `backend/.env`:
```env
# Server Configuration
NODE_ENV=development
PORT=5001

# Database (local development)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/church
# OR for testing (in-memory SQLite)
# DATABASE_URL=sqlite::memory:

# Firebase
FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_encoded_service_account
# Note: Generate via: base64 -i service-account.json (no newlines)

# JWT
JWT_SECRET=your_secure_jwt_secret_key_at_least_32_chars

# Twilio (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# CORS & Deployment
FRONTEND_URL=http://localhost:3000  # local; https://abune-aregawi-church-app.web.app in prod
```

### Production Environment Variables (OCI Compute)
```env
NODE_ENV=production
PORT=10000

# Database (Supabase)
DATABASE_URL=postgresql://postgres.project_ref:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Firebase & Auth
FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_encoded_service_account
JWT_SECRET=your_production_jwt_secret

# Twilio
TWILIO_ACCOUNT_SID=production_account_sid
TWILIO_AUTH_TOKEN=production_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# CORS & Frontend
FRONTEND_URL=https://abune-aregawi-church-app.web.app
```

### Local Development Ports
- **Frontend**: http://localhost:3000 (React dev server)
- **Backend**: http://localhost:5001 (Express API server)
- **Firebase Emulator** (optional): http://localhost:4000
  - Run via `npm run emulators` in frontend folder

### Database Setup (Local Development)

**PostgreSQL with Docker** (recommended):
```bash
# Start PostgreSQL container
docker run --name church-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=church \
  -p 5432:5432 \
  -d postgres:17

# Run migrations
cd backend
npm run db:migrate
```

**SQLite** (lightweight alternative for testing):
```bash
# In backend/.env, use:
DATABASE_URL=sqlite::memory:

# Migrations run automatically on server start
```

### Running Database Migrations
```bash
cd backend

# Check migration status
npm run db:status

# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Undo all migrations
npm run db:migrate:undo:all

# See backend/.claude/skills/db-migrations/SKILL.md for detailed procedures
```

## � Security Features
        bigint collectedBy FK
        date paymentDate
        decimal amount "min 1.00"
        enum paymentType
        enum paymentMethod
        enum status
        string receiptNumber
        text note "includes donor info"
        string externalId
    }
    
    LEDGER_ENTRIES {
        uuid id PK
        bigint transactionId FK
        bigint memberId FK "nullable for anonymous"
        bigint collectedBy FK
        date entryDate
        string type
        decimal amount
        string fund
        string category
        text memo
        string paymentMethod
        string receiptNumber
        string sourceSystem
        string externalId
        date statementDate
    }
    
    DEPARTMENTS {
        bigint id PK
        string name
        text description
        enum type
        bigint leaderId FK
        bigint parentDepartmentId FK
        string contactEmail
        string contactPhone
        string meetingSchedule
        boolean isActive
        boolean isPublic
        int maxMembers
        int sortOrder
    }
    
    DEPARTMENT_MEMBERS {
        bigint id PK
        bigint departmentId FK
        bigint memberId FK
        enum roleInDepartment
        date joinedAt
        enum status
    }
    
    MEMBERS ||--o{ CHILDREN : "has"
    MEMBERS ||--o{ TRANSACTIONS : "pays"
    MEMBERS ||--o{ TRANSACTIONS : "collects"
    TRANSACTIONS ||--o{ LEDGER_ENTRIES : "records"
    MEMBERS ||--o{ DEPARTMENTS : "leads"
    DEPARTMENTS ||--o{ DEPARTMENTS : "parent of"
    DEPARTMENTS ||--o{ DEPARTMENT_MEMBERS : "contains"
    MEMBERS ||--o{ DEPARTMENT_MEMBERS : "belongs to"
```

## 🔐 Security Features

- **Authentication**: Firebase Auth (phone + email) with dual JWT verification
- **Authorization**: 12-role hierarchical RBAC with granular permissions
- **Input Validation**: Express-validator with custom rules and Sequelize validations
- **SQL Injection Protection**: Sequelize ORM with parameterized queries
- **CORS**: Production-domain-only policy for cross-origin requests
- **Environment Variables**: Base64-encoded secrets with secure credential management
- **HTTPS**: Enforced on all production deployments (Firebase Hosting, OCI, Supabase)
- **Data Protection**: Encrypted sensitive fields (PII, financial records)
- **Rate Limiting**: Request throttling to prevent abuse
- **Audit Logging**: SystemAuditLog table tracks all sensitive actions
- **Error Handling**: Safe error messages (no sensitive info leakage)
- **SAST Analysis**: Regular code security scanning via tools

## 👥 Role-Based Access Control (RBAC) - Full Reference

For detailed RBAC implementation, role descriptions, and permission matrices, see the **[Architecture Overview](#-architecture-overview)** section above which documents all 12 specialized roles, their permission categories, and the hierarchical structure.

**Quick Reference**: The system supports Guest, Member, Treasurer, Bookkeeper, AR/AP Teams, Budget Committee, Auditor, Church Leadership, Secretary, Onboarding Coordinator, and Admin roles with granular permission controls.

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (local) or Supabase account
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
- `GET /api/members/all/firebase` - Search members with Firebase auth

### Children
- `GET /api/members/:memberId/dependents` - Get member's dependents
- `POST /api/members/:memberId/dependents` - Add dependent
- `PUT /api/members/dependents/:id` - Update dependent
- `DELETE /api/members/dependents/:id` - Remove dependent

### Payments (Treasurer)
- `GET /api/payments/stats` - Get payment overview statistics
- `GET /api/transactions` - List all transactions with filters
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions` - Record new payment (member or anonymous)
- `PUT /api/transactions/:id` - Update transaction

### Departments (Admin)
- `GET /api/departments` - List all departments with filters and search
- `GET /api/departments/:id` - Get department details with leader and members
- `POST /api/departments` - Create new department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department
- `GET /api/departments/:id/members` - Get department members
- `POST /api/departments/:id/members` - Add members to department
- `DELETE /api/departments/:id/members/:memberId` - Remove member from department
- `PUT /api/departments/:id/members/:memberId` - Update member role in department

### Communications (SMS)
- `POST /api/sms/sendIndividual/:memberId` - Send SMS to individual member
- `POST /api/sms/sendGroup/:groupId` - Send SMS to all members in a group
- `POST /api/sms/sendDepartment/:departmentId` - Send SMS to all members in a department
- `POST /api/sms/sendAll` - Send SMS to all active members (broadcast)

## 🔄 CI/CD Pipeline

### Firebase Hosting (Frontend)
- **Trigger**: Push to main branch (via GitHub Actions) or manual `firebase deploy`
- **Build**: `npm run build` in `frontend/`
- **Deploy**: Automatic via Firebase Hosting GitHub Action, or `firebase deploy --only hosting`
- **Domain**: `*.web.app` and `*.firebaseapp.com` with automatic SSL

### OCI Compute (Backend)
- **Trigger**: Push to main branch (via GitHub Actions)
- **Build**: `npm ci --production` on OCI instance
- **Deploy**: Manual or Auto deployment to OCI via GitHub Actions
- **Health Check**: `/health` endpoint

## 📊 Monitoring & Analytics

- **Firebase Hosting Logs**: Frontend hosting logs and deployment status
- **OCI Logs**: Backend application logs (`/var/log/abune-aregawi`)
- **Supabase Metrics**: Database performance monitoring
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
- Check Firebase configuration and `.env` values
- Verify Firebase configuration
- Ensure all dependencies are installed

**Backend Deployment Issues**
- Verify DATABASE_URL in OCI `.env` file
- Check JWT_SECRET is set
- Review GitHub Actions logs and OCI server logs

**Database Connection Issues**
- Verify Supabase connection string
- Check SSL configuration
- Ensure database is accessible from OCI

## 📄 License

This project is created for the Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church community.

## 🙏 Acknowledgments

- **Supabase** for providing the PostgreSQL database
- **Firebase Hosting** for frontend hosting and CI/CD
- **OCI Compute** for backend hosting and deployment
- **Firebase** for authentication services
- **TailwindCSS** for the beautiful UI framework

---

*Built with love for the Tigray Orthodox Christian community* 

**Last Updated**: August 2026
**Version**: 2.0.0

### Version History
- **v2.0.0** (August 2026): 11-agent specialized architecture, financial role expansion, comprehensive documentation
- **v1.3.0** (October 2025): Department Management System, route preservation, API optimization
- **v1.2.0** (January 2026): Financial role granularity (Bookkeeper, AR/AP, Budget Committee, Auditor)
- **v1.1.0** (October 2025): SMS broadcasting, payment validation, anonymous donations 
