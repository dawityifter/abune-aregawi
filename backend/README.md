# Abune Aregawi Church - Backend API

A comprehensive Node.js/Express API for managing church members, built with PostgreSQL and Sequelize ORM.

## 🏗️ Architecture

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── utils/          # Utility functions
│   └── server.js       # Main server file
├── package.json
├── env.example         # Environment variables template
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE abune_aregawi_db;
   CREATE USER abune_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE abune_aregawi_db TO abune_user;
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `abune_aregawi_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

## 📊 Database Schema

### Members Table
Comprehensive member information including:

- **Personal Information**: Name, gender, date of birth, marital status
- **Contact & Address**: Phone, email, full address
- **Family Information**: Household details, emergency contacts
- **Spiritual Information**: Orthodox-specific fields (baptism, chrismation, liturgical roles)
- **Account Information**: Login credentials, role-based access
- **Contribution**: Giving preferences, member ID

### Children Table
Linked to members for family management:
- Child personal information
- Baptism status and dates
- Name day information

## 🔐 Authentication & Authorization

### JWT-based Authentication
- Secure token-based authentication
- Automatic password hashing with bcrypt
- Token expiration (7 days)

### Role-based Access Control
- **Member**: Basic profile access
- **Treasurer**: Financial data access
- **Church Secretary**: Member management
- **Administrator**: Full system access
- **Priest**: Member viewing and spiritual data
- **Board Member**: Administrative access

## 📡 API Endpoints

### Public Endpoints

#### POST `/api/members/register`
Register a new church member

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "gender": "Male",
  "dateOfBirth": "1990-01-01",
  "maritalStatus": "Married",
  "phoneNumber": "+1234567890",
  "email": "john.doe@example.com",
  "streetAddress": "123 Main St",
  "city": "Garland",
  "state": "TX",
  "postalCode": "75042",
  "country": "United States",
  "isBaptized": true,
  "baptismDate": "1990-02-01",
  "isChrismated": true,
  "chrismationDate": "1990-02-01",
  "isCommunicantMember": true,
  "spiritualFather": "Fr. Michael",
  "nameDay": "St. John",
  "liturgicalRole": "Reader",
  "languagePreference": "English",
  "loginEmail": "john.doe@example.com",
  "password": "SecurePassword123",
  "children": [
    {
      "firstName": "Mary",
      "lastName": "Doe",
      "dateOfBirth": "2015-06-15",
      "gender": "Female",
      "isBaptized": true
    }
  ]
}
```

#### POST `/api/members/login`
Member login

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123"
}
```

### Protected Endpoints

#### GET `/api/members/profile`
Get current member's profile

#### PUT `/api/members/profile`
Update current member's profile

#### GET `/api/members/all` (Admin)
Get all members with pagination and filtering

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term
- `role`: Filter by role
- `isActive`: Filter by active status

#### GET `/api/members/:id` (Admin)
Get specific member by ID

#### PUT `/api/members/:id` (Admin)
Update specific member

#### DELETE `/api/members/:id` (Admin)
Deactivate member account

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Comprehensive field validation
- **Password Hashing**: bcrypt with 12 rounds
- **JWT Security**: Secure token handling
- **SQL Injection Protection**: Sequelize ORM

## 📝 Validation Rules

### Member Registration
- Required fields: firstName, lastName, gender, dateOfBirth, phoneNumber, email, address
- Email validation and normalization
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Phone number format validation
- Date format validation

### Profile Updates
- Optional field updates
- Maintains data integrity
- Role-based field restrictions

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📦 Scripts

```bash
npm run dev          # Start development server
npm start           # Start production server
npm test            # Run tests
npm run migrate     # Run database migrations
npm run seed        # Seed database with sample data
```

## 🔄 Database Migrations

The system uses Sequelize for database management:

```bash
# Sync database (development)
npm run dev

# Manual sync
npx sequelize-cli db:sync
```

## 📊 Monitoring & Logging

- Request logging
- Error tracking
- Performance monitoring
- Health check endpoint (`/health`)

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set secure JWT secret
- [ ] Configure CORS for production domain
- [ ] Set up SSL/TLS
- [ ] Configure logging
- [ ] Set up monitoring

### Environment Variables for Production
```bash
NODE_ENV=production
PORT=5000
DB_HOST=your_production_db_host
DB_NAME=abune_aregawi_prod
DB_USER=your_production_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_very_secure_jwt_secret
FRONTEND_URL=https://your-domain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is created for the Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church community.

---

*Built with ❤️ for the Tigray Orthodox Christian community* 