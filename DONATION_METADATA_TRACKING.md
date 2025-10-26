# Donation Metadata Tracking Guide

## Overview
We now track whether donations used the church's email as a fallback when donors don't provide their own email addresses.

## What Was Implemented

### Metadata Fields Added to All Donations

```javascript
{
  email_provided: boolean,              // Did donor provide their email?
  email_is_church_fallback: boolean,    // Using church email?
  donor_has_phone: boolean,             // Has phone number?
  donor_has_address: boolean,           // Has address?
  contact_completeness: number,         // Score 0-4 (how many fields provided)
  donation_source: string,              // 'public_donation_page' or 'treasurer_payment'
  member_email_missing: boolean         // (Treasurer only) Member has no email in profile
}
```

## Where to Find This Data

### 1. Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Click **Payments**
3. Click on any payment
4. Scroll down to **Metadata** section
5. You'll see all tracking fields

### 2. Backend Database
The metadata is stored in the `donations` table in the `metadata` JSON column.

### 3. Stripe API
```bash
curl https://api.stripe.com/v1/payment_intents/{PAYMENT_ID} \
  -u sk_test_xxx:
```

## Use Cases

### Identify Donations Without Real Email
**Query donations using church fallback email:**
```sql
SELECT * FROM donations 
WHERE metadata->>'email_is_church_fallback' = 'true';
```

### Find Members Without Email Addresses
**Treasurer payments where member has no email:**
```sql
SELECT DISTINCT member_id, metadata->>'memberId' 
FROM donations 
WHERE metadata->>'member_email_missing' = 'true'
  AND metadata->>'donation_source' = 'treasurer_payment';
```

### Contact Completeness Report
**See how many donors provide full contact info:**
```sql
SELECT 
  metadata->>'contact_completeness' as completeness_score,
  COUNT(*) as donation_count
FROM donations
GROUP BY metadata->>'contact_completeness'
ORDER BY completeness_score DESC;
```

**Results:**
- Score 4 = All fields (email, phone, address, zip)
- Score 3 = 3 of 4 fields
- Score 2 = 2 of 4 fields
- Score 1 = 1 of 4 fields
- Score 0 = No contact info (only name)

### Identify High-Risk Patterns
**Many donations with same email (church fallback):**
```sql
SELECT 
  donor_email,
  COUNT(*) as usage_count,
  SUM(CASE WHEN metadata->>'email_is_church_fallback' = 'true' THEN 1 ELSE 0 END) as fallback_count
FROM donations
GROUP BY donor_email
HAVING COUNT(*) > 10
ORDER BY fallback_count DESC;
```

This helps you see if `abunearegawitx@gmail.com` is being used too frequently.

### Follow-Up Actions
**Donors who need email collection:**
```sql
SELECT 
  donor_first_name,
  donor_last_name,
  donor_phone,
  created_at
FROM donations
WHERE metadata->>'email_is_church_fallback' = 'true'
  AND donor_phone IS NOT NULL
ORDER BY created_at DESC;
```

Use this list to:
1. Call donors and collect their email
2. Update member profiles
3. Send thank you cards with email request

## Stripe Dashboard Filters

### Custom Filter for Fallback Emails
1. Go to Stripe Dashboard → Payments
2. Click **Add Filter**
3. Select **Metadata**
4. Key: `email_is_church_fallback`
5. Value: `true`
6. **Apply**

### View by Source
Filter by `donation_source`:
- `public_donation_page` - Online donations
- `treasurer_payment` - Manual entries by treasurer

## Monitoring Recommendations

### Weekly Check
Run this query weekly:
```sql
SELECT 
  COUNT(*) FILTER (WHERE metadata->>'email_is_church_fallback' = 'true') as fallback_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'email_is_church_fallback' = 'true') / COUNT(*), 2) as fallback_percentage
FROM donations
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Ideal targets:**
- ✅ < 10% fallback rate = Excellent
- ⚠️ 10-30% fallback rate = Acceptable
- ❌ > 30% fallback rate = Need to improve email collection

### Monthly Report
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_donations,
  COUNT(*) FILTER (WHERE metadata->>'email_provided' = 'true') as with_email,
  COUNT(*) FILTER (WHERE metadata->>'email_is_church_fallback' = 'true') as fallback_email,
  ROUND(AVG((metadata->>'contact_completeness')::int), 2) as avg_completeness
FROM donations
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

## Action Items Based on Data

### If Fallback Rate > 30%
1. **Add email requirement** on donation page
2. **Add email field** to treasurer form
3. **Train treasurers** to collect email at donation time

### If Completeness Score < 2
1. **Encourage optional fields** with messaging
2. **Show tax receipt benefit** for providing email
3. **Add incentive** (e.g., "Get weekly newsletter")

### If Member Emails Missing
1. **Export member list** without emails
2. **Contact them** to update profile
3. **Add email collection** to membership renewal

## Benefits of This Tracking

✅ **Fraud Prevention** - Identify if same email used too often
✅ **Data Quality** - Know which donors need follow-up
✅ **Compliance** - Track who received tax receipts
✅ **Reporting** - Understand donation quality trends
✅ **Member Engagement** - Find members to update profiles
✅ **Stripe Health** - Monitor for patterns that trigger fraud alerts

## Next Steps

Consider implementing:
1. **Dashboard widget** showing fallback email percentage
2. **Automated email** to treasurer when fallback rate exceeds threshold
3. **Member profile alert** when member has no email
4. **Donation receipt system** that works without email (print/mail)

---

**Last Updated:** October 2025
**Implemented In:** v1.0.0
