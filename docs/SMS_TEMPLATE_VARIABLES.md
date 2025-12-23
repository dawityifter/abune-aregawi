# SMS Template Variables - Personalized Pledge Messages

## ✅ Feature Complete

Added **template variable support** for personalized SMS messages to pledge groups. Each member receives a customized message with their specific pledge information!

---

## 🎯 Available Template Variables

### **For All Pledge Messages:**
- `{firstName}` - Member's first name
- `{lastName}` - Member's last name  
- `{fullName}` - Member's full name (First + Last)
- `{amount}` - Single pledge amount (formatted as currency, e.g., $500.00)
- `{totalAmount}` - Total of all pledges for this member
- `{pledgeCount}` - Number of pledges the member has

### **For Pending Pledges Only:**
- `{dueDate}` - Due date of the pledge (formatted as "Jan 15, 2025")

---

## 📝 Example Messages

### **Pending Pledges - Single Pledge:**
**Template:**
```
Hi {firstName}, this is a friendly reminder about your pending pledge of {amount} due on {dueDate}. 
We appreciate your commitment to the church. God bless!
```

**Personalized Output:**
```
Hi John, this is a friendly reminder about your pending pledge of $500.00 due on Dec 31, 2025. 
We appreciate your commitment to the church. God bless!
```

---

### **Pending Pledges - Multiple Pledges:**
**Template:**
```
Hello {fullName}, you have {pledgeCount} pending pledges totaling {totalAmount}. 
Thank you for your generous commitment!
```

**Personalized Output:**
```
Hello John Doe, you have 3 pending pledges totaling $1,250.00. 
Thank you for your generous commitment!
```

---

### **Fulfilled Pledges - Thank You:**
**Template:**
```
Dear {firstName}, thank you for fulfilling your pledge of {amount}! 
Your generous support helps our church community thrive. God bless you!
```

**Personalized Output:**
```
Dear John, thank you for fulfilling your pledge of $500.00! 
Your generous support helps our church community thrive. God bless you!
```

---

### **Fulfilled Pledges - Multiple Pledges:**
**Template:**
```
{fullName}, we're grateful for your {pledgeCount} fulfilled pledges totaling {totalAmount}. 
Your faithfulness is truly appreciated!
```

**Personalized Output:**
```
John Doe, we're grateful for your 2 fulfilled pledges totaling $800.00. 
Your faithfulness is truly appreciated!
```

---

## 🎨 UI Features

### **Template Variable Helper Box:**
When you select "Pending Pledges" or "Fulfilled Pledges", the UI displays:

✅ **Green helper box** with all available template variables  
✅ **Example placeholder** in the textarea  
✅ **Reminder** that each member gets a personalized message

### **Smart Defaults:**
- **Single pledge:** Use `{amount}` and `{dueDate}`
- **Multiple pledges:** Use `{totalAmount}` and `{pledgeCount}`
- The system automatically handles both cases!

---

## 💻 How It Works (Technical)

### **Backend Processing:**

1. **Query pledges** by status (pending/fulfilled)
2. **Aggregate by member** - collect all pledges for each member
3. **Calculate totals** - sum up pledge amounts per member
4. **Template substitution** - replace variables for each member
5. **Send personalized SMS** - each member gets their own message

### **Template Substitution Logic:**

```javascript
// For a member with 2 pending pledges ($300 + $200)
const templateData = {
  firstName: "John",
  lastName: "Doe",
  amount: 300.00,           // First pledge (if single)
  totalAmount: 500.00,      // Sum of all pledges
  pledgeCount: 2,           // Number of pledges
  dueDate: "2025-12-31"     // First pledge due date (if single)
};

// Message template
"Hi {firstName}, you have {pledgeCount} pledges totaling {totalAmount}"

// Becomes
"Hi John, you have 2 pledges totaling $500.00"
```

---

## 🧪 Testing Examples

### **Test 1: Basic Template**
1. Select "Pending Pledges"
2. Enter: `Hi {firstName}, your pledge of {amount} is pending.`
3. Send SMS
4. **Expected:** Each member sees their own name and amount

### **Test 2: Multiple Variables**
1. Select "Pending Pledges"
2. Enter: `{fullName}, you have {pledgeCount} pledges totaling {totalAmount}. Due: {dueDate}`
3. Send SMS
4. **Expected:** Full personalization with all details

### **Test 3: No Variables (Still Works)**
1. Select "Pending Pledges"
2. Enter: `Reminder: Your pledge is due soon. Thank you!`
3. Send SMS
4. **Expected:** Same message to all (no personalization)

---

## 📊 Use Cases

### **1. Gentle Reminders:**
```
Hi {firstName}, just a friendly reminder about your pending pledge of {amount}. 
No rush, but it's due on {dueDate}. Thank you for your support!
```

### **2. Urgent Reminders:**
```
{fullName}, your pledge of {amount} is due on {dueDate}. 
Please contact the church office if you need assistance. God bless!
```

### **3. Gratitude Messages:**
```
Dear {firstName}, we received your pledge payment of {amount}! 
Thank you for your faithful giving. May God bless you abundantly!
```

### **4. Summary Updates:**
```
{fullName}, you've completed {pledgeCount} pledges totaling {totalAmount} this year. 
Thank you for your incredible generosity!
```

---

## 🔒 Security & Privacy

✅ **No PII in logs** - Template variables are replaced at send time  
✅ **Personalized per recipient** - No one sees others' information  
✅ **Secure logging** - Uses the new logger utility with redaction  
✅ **Validated amounts** - Currency formatting prevents errors

---

## 📝 Files Modified

**Backend:**
- `../backend/src/controllers/smsController.js`
  - Added `substituteTemplateVariables()` function
  - Updated `sendPendingPledges()` with template support
  - Updated `sendFulfilledPledges()` with template support

**Frontend:**
- `../frontend/src/components/admin/SmsBroadcast.tsx`
  - Added template variables helper box
  - Added smart placeholders
  - Added visual guidance for users

---

## 🚀 Ready to Test!

**Servers Running:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5001

**Test Steps:**
1. Go to Admin → SMS Broadcast
2. Select "Pending Pledges"
3. See the green template variables box appear
4. Try this message:
   ```
   Hi {firstName}, reminder about your pending pledge of {amount}. Thank you!
   ```
5. Click Send SMS
6. Each member receives their personalized message!

---

**Status:** ✅ Ready for Testing  
**Impact:** Each member gets a personalized message with their specific pledge info!
