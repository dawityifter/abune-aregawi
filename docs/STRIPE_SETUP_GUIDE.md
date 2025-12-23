# Stripe Payment Integration Setup Guide

## 🎯 Overview

This guide will help you set up Stripe payments for your church donation system. The integration includes:

- ✅ Secure payment processing with Stripe Elements
- ✅ Support for credit/debit cards and ACH payments
- ✅ One-time and recurring donations
- ✅ Donation tracking in PostgreSQL database
- ✅ Webhook handling for payment status updates

## 🔧 Backend Setup

### 1. Install Stripe Dependencies

```bash
cd backend
npm install stripe
```

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
```

### 3. Run Database Migration

```bash
cd backend
npm run db:sync
```

This will create the `donations` table with all necessary fields.

## 🔧 Frontend Setup

### 1. Install Stripe Dependencies

```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Configure Environment Variables

Add this variable to your frontend `.env` file:

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

## 🔑 Stripe Dashboard Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete your business profile
3. Navigate to the Dashboard

### 2. Get API Keys

1. In the Stripe Dashboard, go to **Developers > API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add these to your environment variables

### 3. Configure Webhooks

1. In the Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-domain.com/api/donations/webhook`
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook signing secret (starts with `whsec_`)
6. Add this to your environment variables

### 4. Enable ACH Payments (Optional)

1. In the Stripe Dashboard, go to **Settings > Payment methods**
2. Enable **US bank accounts (ACH)**
3. Complete the verification process

## 🚀 Testing

### Test Card Numbers

Use these test card numbers:

- **Visa**: `4242424242424242`
- **Mastercard**: `5555555555554444`
- **Declined**: `4000000000000002`

### Test ACH Account

- **Routing Number**: `110000000`
- **Account Number**: `000123456789`

## 📋 API Endpoints

### Create Payment Intent
```
POST /api/donations/create-payment-intent
```

**Request Body:**
```json
{
  "amount": 50.00,
  "currency": "usd",
  "donation_type": "one-time",
  "frequency": "monthly",
  "payment_method": "card",
  "donor_first_name": "John",
  "donor_last_name": "Doe",
  "donor_email": "john@example.com",
  "donor_phone": "+1234567890",
  "donor_address": "123 Main St",
  "donor_zip_code": "12345"
}
```

### Confirm Payment
```
POST /api/donations/confirm-payment
```

**Request Body:**
```json
{
  "payment_intent_id": "pi_1234567890"
}
```

### Get Donation
```
GET /api/donations/:id
```

### Get All Donations
```
GET /api/donations?page=1&limit=20&status=succeeded
```

### Webhook
```
POST /api/donations/webhook
```

## 🔒 Security Features

- ✅ **PCI Compliance**: No card data touches your server
- ✅ **Webhook Verification**: All webhooks are cryptographically verified
- ✅ **Input Validation**: All inputs are validated on both frontend and backend
- ✅ **Error Handling**: Comprehensive error handling and user feedback
- ✅ **Rate Limiting**: API endpoints are rate-limited

## 🎯 Payment Flow

1. **User fills donation form** → Frontend validation
2. **Create payment intent** → Backend creates Stripe payment intent
3. **User enters card details** → Stripe Elements handles securely
4. **Confirm payment** → Stripe processes payment
5. **Webhook notification** → Backend updates donation status
6. **Success/Error handling** → User gets feedback

## 🐛 Troubleshooting

### Common Issues

1. **"Stripe has not loaded yet"**
   - Check that `REACT_APP_STRIPE_PUBLISHABLE_KEY` is set correctly
   - Ensure the key starts with `pk_test_` or `pk_live_`

2. **"Payment failed"**
   - Check Stripe Dashboard for detailed error logs
   - Verify your Stripe account is properly configured

3. **Webhook errors**
   - Ensure webhook URL is accessible from internet
   - Check webhook signing secret is correct
   - Verify webhook events are properly configured

4. **Database errors**
   - Run `npm run db:sync` to ensure tables are created
   - Check database connection and permissions

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📞 Support

- **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: Available in your Stripe Dashboard
- **React Stripe**: [github.com/stripe/react-stripe-js](https://github.com/stripe/react-stripe-js)

## 🔄 Production Deployment

### 1. Switch to Live Keys

Replace test keys with live keys:
- `pk_test_` → `pk_live_`
- `sk_test_` → `sk_live_`

### 2. Update Webhook URL

Change webhook endpoint to your production domain:
```
https://your-production-domain.com/api/donations/webhook
```

### 3. Enable ACH (if needed)

Complete ACH verification in Stripe Dashboard for live processing.

### 4. Monitor Payments

Use Stripe Dashboard to monitor:
- Payment success rates
- Failed payments
- Disputes and refunds
- Revenue analytics

## ✅ Checklist

- [ ] Stripe account created and configured
- [ ] API keys added to environment variables
- [ ] Webhook endpoint configured
- [ ] Database migration run successfully
- [ ] Frontend dependencies installed
- [ ] Test payments working
- [ ] Error handling tested
- [ ] Production keys ready (when deploying)

---

**🎉 Congratulations!** Your Stripe payment integration is now ready to accept donations securely. 