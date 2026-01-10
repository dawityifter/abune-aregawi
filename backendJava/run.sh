#!/bin/bash

# Load environment variables from .env file and convert for Java
# This script properly handles Node.js DATABASE_URL format -> JDBC format

if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Export DATABASE_USER and DATABASE_PASSWORD
export $(grep 'DATABASE_USER=' .env | xargs)
export $(grep 'DATABASE_PASSWORD=' .env | xargs)

# Convert DATABASE_URL from postgresql:// to jdbc:postgresql://
# Cleaning: Remove " and ' and spaces
NODE_DB_URL=$(grep 'DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)

echo "🔍 DEBUG: Raw DATABASE_URL from .env: '$NODE_DB_URL'"

# Strip credentials (user:pass@) for JDBC compatibility
# JDBC driver interprets "user@host" as a hostname which fails
CLEAN_NODE_DB_URL=$(echo "$NODE_DB_URL" | sed -E 's|//[^@]+@|//|')

if [[ $CLEAN_NODE_DB_URL == postgresql://* ]]; then
  # Convert Node.js format to JDBC format
  export DATABASE_URL="jdbc:${CLEAN_NODE_DB_URL}"
  echo "✅ Converted to JDBC: $DATABASE_URL"
elif [[ $CLEAN_NODE_DB_URL == jdbc:postgresql://* ]]; then
  # Already in JDBC format
  export DATABASE_URL="$CLEAN_NODE_DB_URL"
  echo "ℹ️ Already JDBC format"
else
  # Use default
  echo "⚠️ Unknown format. Defaulting to localhost."
  export DATABASE_URL="jdbc:postgresql://localhost:5432/abune_aregawi"
fi

# FORCE Spring Boot to use this URL
export SPRING_DATASOURCE_URL="$DATABASE_URL"

# Handle the Firebase variable specially since it's base64 encoded
FIREBASE_KEY=$(grep 'FIREBASE_SERVICE_ACCOUNT_BASE64=' .env | cut -d '=' -f2-)
export FIREBASE_SERVICE_ACCOUNT_BASE64="$FIREBASE_KEY"

# Force Enable Demo Mode (Override .env)
export ENABLE_DEMO_MODE=true

echo "✅ Environment variables loaded from .env"
echo "📦 Database: ${DATABASE_USER}@localhost"
echo "🔐 Firebase Auth: Configured"
echo "✨ Demo Mode: ENABLED"
echo ""
echo "🚀 Starting Spring Boot application with IPv4 preference..."
./gradlew bootRun -Djava.net.preferIPv4Stack=true
