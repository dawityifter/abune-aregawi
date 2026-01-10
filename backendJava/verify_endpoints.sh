#!/bin/bash

echo "Waiting for server to start (max 30s)..."
count=0
until curl -s http://localhost:8080/api/health > /dev/null; do
  echo "Waiting..."
  sleep 2
  count=$((count+2))
  if [ $count -ge 30 ]; then
    echo "Timeout waiting for server."
    exit 1
  fi
done

echo "Server UP!"
echo "------------------------------------------------"

echo "1. Checking Health:"
curl -s http://localhost:8080/api/health
echo -e "\n------------------------------------------------"

echo "2. Checking Departments (Public):"
curl -s http://localhost:8080/api/departments
echo -e "\n------------------------------------------------"

echo "3. Registering User:"
curl -X POST http://localhost:8080/api/members/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phoneNumber": "+15555555555",
    "firebaseUid": "test-uid-123"
  }'
echo -e "\n------------------------------------------------"

echo "4. Checking Profile (Demo Mode):"
curl -s http://localhost:8080/api/members/profile \
  -H "Authorization: Bearer MAGIC_DEMO_TOKEN" \
  -H "X-Demo-Email: test@example.com"
echo -e "\n------------------------------------------------"
