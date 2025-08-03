# Church Transactions System

## Overview

The Church Transactions system allows tracking of payments made by members for various purposes including membership dues, tithes, donations, and other church-related payments.

## Database Schema

### `church_transactions` Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier for the transaction |
| `member_id` | UUID | NOT NULL, FK to members.id | The member who made the payment |
| `collected_by` | UUID | NOT NULL, FK to members.id | The member who collected the payment (e.g., treasurer) |
| `payment_date` | DATE | NOT NULL, DEFAULT NOW | Date when the payment was made |
| `amount` | DECIMAL(10,2) | NOT NULL, > 0 | Payment amount in dollars and cents |
| `payment_type` | ENUM | NOT NULL | Type of payment (membership_due, tithe, donation, event, other) |
| `payment_method` | ENUM | NOT NULL | Method of payment (cash, check, zelle, credit_card, debit_card, ach, other) |
| `receipt_number` | VARCHAR(100) | NULL | Receipt number (required for cash/check payments) |
| `note` | TEXT | NULL | Additional notes about the payment |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | When the record was created |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | When the record was last updated |

### ENUM Values

#### Payment Types
- `membership_due` - Membership dues
- `tithe` - Tithes
- `donation` - General donations
- `event` - Event-specific payments
- `other` - Other types of payments

#### Payment Methods
- `cash` - Cash payment
- `check` - Check payment
- `zelle` - Zelle transfer
- `credit_card` - Credit card payment
- `debit_card` - Debit card payment
- `ach` - ACH bank transfer
- `other` - Other payment methods

### Constraints

1. **Foreign Key Constraints**
   - `member_id` references `members.id` (CASCADE on update, RESTRICT on delete)
   - `collected_by` references `members.id` (CASCADE on update, RESTRICT on delete)

2. **Business Logic Constraints**
   - `amount` must be greater than 0
   - `receipt_number` is required for cash and check payments
   - Both `member_id` and `collected_by` must reference existing members

3. **Indexes**
   - `member_id` - For quick lookups by member
   - `collected_by` - For quick lookups by collector
   - `payment_date` - For date range queries
   - `payment_type` - For filtering by payment type
   - `payment_method` - For filtering by payment method

## API Endpoints

### Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Role Requirements
- **Admin**: Can perform all operations
- **Treasurer**: Can view, create, and update transactions (cannot delete)
- **Member**: Cannot access transaction endpoints

### Endpoints

#### 1. Get All Transactions
```
GET /api/transactions
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `member_id` (optional): Filter by member ID
- `payment_type` (optional): Filter by payment type
- `payment_method` (optional): Filter by payment method
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)
- `min_amount` (optional): Minimum amount filter
- `max_amount` (optional): Maximum amount filter

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "member_id": "uuid",
        "collected_by": "uuid",
        "payment_date": "2024-01-15",
        "amount": "50.00",
        "payment_type": "tithe",
        "payment_method": "cash",
        "receipt_number": "RCPT-001",
        "note": "Monthly tithe",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "member": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "phoneNumber": "+1234567890"
        },
        "collector": {
          "id": "uuid",
          "firstName": "Jane",
          "lastName": "Smith",
          "email": "jane@example.com",
          "phoneNumber": "+1234567891"
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 50,
      "items_per_page": 10
    }
  }
}
```

#### 2. Get Transaction by ID
```
GET /api/transactions/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": {
      // Same structure as above
    }
  }
}
```

#### 3. Create Transaction
```
POST /api/transactions
```

**Request Body:**
```json
{
  "member_id": "uuid",
  "collected_by": "uuid",
  "payment_date": "2024-01-15",
  "amount": "50.00",
  "payment_type": "tithe",
  "payment_method": "cash",
  "receipt_number": "RCPT-001",
  "note": "Monthly tithe"
}
```

**Required Fields:**
- `member_id`: UUID of the member making the payment
- `collected_by`: UUID of the member collecting the payment
- `amount`: Payment amount (must be > 0)
- `payment_type`: One of the payment type ENUM values
- `payment_method`: One of the payment method ENUM values

**Optional Fields:**
- `payment_date`: Date of payment (defaults to current date)
- `receipt_number`: Required for cash/check payments
- `note`: Additional notes

#### 4. Update Transaction
```
PUT /api/transactions/:id
```

**Request Body:** Same as create, but all fields are optional

#### 5. Delete Transaction
```
DELETE /api/transactions/:id
```

**Note:** Only admins can delete transactions

#### 6. Get Transaction Statistics
```
GET /api/transactions/stats
```

**Query Parameters:**
- `start_date` (optional): Start date for statistics
- `end_date` (optional): End date for statistics
- `payment_type` (optional): Filter by payment type

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "payment_type": "tithe",
        "payment_method": "cash",
        "count": "25",
        "total_amount": "1250.00",
        "average_amount": "50.00"
      }
    ]
  }
}
```

## Usage Examples

### Creating a Cash Payment
```bash
curl -X POST /api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "member-uuid",
    "collected_by": "treasurer-uuid",
    "amount": "100.00",
    "payment_type": "tithe",
    "payment_method": "cash",
    "receipt_number": "RCPT-2024-001",
    "note": "Monthly tithe for January"
  }'
```

### Creating an Electronic Payment
```bash
curl -X POST /api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "member-uuid",
    "collected_by": "treasurer-uuid",
    "amount": "50.00",
    "payment_type": "donation",
    "payment_method": "zelle",
    "note": "Special donation for building fund"
  }'
```

### Getting Transactions for a Member
```bash
curl -X GET "/api/transactions?member_id=member-uuid&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Getting Statistics for a Date Range
```bash
curl -X GET "/api/transactions/stats?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer <token>"
```

## Error Handling

### Common Error Responses

**400 Bad Request - Missing Required Fields:**
```json
{
  "success": false,
  "message": "Missing required fields: member_id, collected_by, amount, payment_type, payment_method"
}
```

**400 Bad Request - Invalid Amount:**
```json
{
  "success": false,
  "message": "Amount must be greater than 0"
}
```

**400 Bad Request - Missing Receipt Number:**
```json
{
  "success": false,
  "message": "Receipt number is required for cash and check payments"
}
```

**400 Bad Request - Member Not Found:**
```json
{
  "success": false,
  "message": "Member not found"
}
```

**404 Not Found - Transaction Not Found:**
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

**403 Forbidden - Insufficient Permissions:**
```json
{
  "success": false,
  "message": "Access denied"
}
```

## Migration

To create the church_transactions table, run:

```bash
npx sequelize-cli db:migrate
```

To rollback:

```bash
npx sequelize-cli db:migrate:undo
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Role-based access control (admin/treasurer)
3. **Input Validation**: All inputs are validated on both client and server
4. **SQL Injection Protection**: Using Sequelize ORM with parameterized queries
5. **Data Integrity**: Foreign key constraints and business logic validation 