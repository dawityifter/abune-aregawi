# PostgreSQL Database Setup

This project now uses PostgreSQL with Neon as the database provider.

## Environment Configuration

1. Copy the environment example file:
   ```bash
   cp env.example .env
   ```

2. Update the `.env` file with your actual configuration values:
   - The database connection details are already configured for your Neon database
   - Update other values like JWT_SECRET, Firebase credentials, etc.

## Database Connection Details

The project is configured to connect to your Neon PostgreSQL database:
- **Host**: ep-bitter-glitter-aeq97lp6-pooler.c-2.us-east-2.aws.neon.tech
- **Database**: neondb
- **User**: neondb_owner
- **SSL**: Required (configured automatically)

## Initial Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Initialize the database (creates tables):
   ```bash
   npm run db:init
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Database Scripts

- `npm run db:init` - Initialize database and create all tables (drops existing data)
- `npm run db:sync` - Sync database schema without dropping data
- `npm run dev` - Start development server with auto-sync

## Important Notes

- The database connection uses SSL (required for Neon)
- All sensitive data is stored in environment variables
- The `.env` file is gitignored to keep credentials secure
- Database tables are automatically created on first run

## Troubleshooting

If you encounter connection issues:
1. Verify your Neon database is active
2. Check that the connection string is correct
3. Ensure SSL is enabled (configured automatically)
4. Verify network connectivity to Neon's servers 