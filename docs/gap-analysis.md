# API Gap Analysis Report

## 1. Member Management (`/api/members`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/` | GET | `getAllMembers` | `getAllMembers` | ✅ | |
| `/search` | GET | `searchMembers` | `searchMembers` | ✅ | |
| `/profile` | GET | `getProfile` | `getProfile` | ✅ | |
| `/register` | POST | `register` | `register` | ✅ | |
| `/:id` | GET | `getMember` | `getMember` | ✅ | |
| `/:id` | PUT | `updateMember` | `updateMember` | ✅ | |
| `/:id` | DELETE | `deleteMember` | `deleteMember` | ✅ | |
| `/:id/role` | PATCH | `updateMemberRole` | `updateMemberRole` | ✅ | Fixed in Step 1404 |
| `/:id/dependents` | GET | `getMemberDependents` | `getMemberDependents` | ✅ | |
| `/:id/dependents` | POST | `addDependent` | `addDependent` | ✅ | |
| `/dependents/:id` | PUT | `updateDependent` | `updateDependent` | ✅ | |
| `/dependents/:id` | DELETE | `deleteDependent` | `deleteDependent` | ✅ | |
| `/dependents/:dependentId/promote` | POST | `promoteDependent` | `promoteDependent` | ✅ | |
| `/validate-family-head/:phoneNumber` | GET | `validateHeadOfHouseholdPhone` | `validateHeadOfHouseholdPhone` | ✅ | |
| `/registration-status` | GET | `checkRegistrationStatus` | `checkRegistrationStatus` | ✅ | |
| `/pending-welcomes` | GET | `getPendingWelcomes` | `getPendingWelcomes` | ✅ | |
| `/:id/mark-welcomed` | POST | `markWelcomed` | `markWelcomed` | ✅ | |
| `/:id/contributions` | GET | `getMemberContributions` | `getMemberContributions` | ✅ | |
| `/phone-check/:phoneNumber` | GET | `checkPhoneExists` | ❓ | ⚠️ | **MISSING in Java** |
| `/login` | POST | `login` | `login` (Firebase Auth) | 🟡 | Java uses header-based Firebase Auth, not custom login endpoint |
| `/self-claim/start` | POST | `selfClaimStart` | ❓ | ⚠️ | **MISSING** |
| `/self-claim/verify` | POST | `selfClaimVerify` | ❓ | ⚠️ | **MISSING** |
| `/self-claim/link` | POST | `selfClaimLink` | ❓ | ⚠️ | **MISSING** |

## 2. Transactions (`/api/transactions`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/` | GET | `getTransactions` | `getAllTransactions` | ✅ | |
| `/:id` | GET | `getTransaction` | `getTransaction` | ✅ | |
| `/` | POST | `createTransaction` | `createTransaction` | ✅ | |
| `/:id` | PUT | `updateTransaction` | `updateTransaction` | ✅ | |
| `/:id` | DELETE | `deleteTransaction` | `deleteTransaction` | ✅ | |
| `/summary` | GET | `getSummary` | `getSummary` | ✅ | |
| `/export` | GET | `exportTransactions` | `exportTransactions` | ✅ | |
| `/budget-stats` | GET | `getBudgetStats` | ❓ | ⚠️ | **MISSING in Java** (Check TransactionController) |
| `/payment-methods` | GET | `getPaymentMethods` | ❓ | ⚠️ | **MISSING in Java** (Likely hardcoded or Enum) |

## 3. Zelle (`/api/zelle`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/parse` | POST | `parseZelleEmail` | `parseZelleEmail` | ✅ | |
| `/sync` | POST | `syncZelleTransactions` | `syncZelleTransactions` | ✅ | |
| `/preview` | POST | `previewBatch` | `previewBatch` | ✅ | |
| `/batch-create` | POST | `createBatch` | `createBatch` | ✅ | |

## 4. Departments (`/api/departments`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/board-members` | GET | `getBoardMembers` | ❓ | ⚠️ | **MISSING in Java** |
| `/` | GET | `getAllDepartments` | `getAllDepartments` | ✅ | |
| `/:id` | GET | `getDepartmentById` | `getDepartment` | ✅ | |
| `/` | POST | `createDepartment` | `createDepartment` | ✅ | |
| `/:id` | PUT | `updateDepartment` | `updateDepartment` | ✅ | |
| `/:id/meetings` | GET | `getDepartmentMeetings` | `getDepartmentMeetings` | ✅ | |
| `/:id/tasks` | GET | `getDepartmentTasks` | `getDepartmentTasks` | ✅ | |

## 5. Groups (`/api/groups`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/active` | GET | `listActive` | `listActive` | ✅ | |

## 6. Gallery (`/api/gallery`)
| Endpoint | Method | Node.js | Java | Status | Notes |
|----------|--------|---------|------|--------|-------|
| `/:folderId` | GET | `getFolderImages` | `getFolderImages` | ✅ | |
| `/:folderId/upload` | POST | `uploadImage` | `uploadImage` | ✅ | |

## 7. SMS (`/api/sms`)
### 4. SMS / Notifications
*   **Controller:** `SmsController`
*   **Missing Endpoints:**
    *   `POST /send/group/{groupId}` -> **IMPLEMENTED** (in `SmsController` via `SmsService.sendToGroup`)
    *   `POST /send/department/{departmentId}` -> **IMPLEMENTED** (in `SmsController` via `SmsService.sendToDepartment`)
    *   `POST /send/all` -> **IMPLEMENTED** (in `SmsController` via `SmsService.sendToAll`)
    *   `POST /sendPendingPledges` -> **IMPLEMENTED** (in `SmsController` via `SmsService.sendToPendingPledges`)
    *   `POST /sendFulfilledPledges` -> **IMPLEMENTED** (in `SmsController` via `SmsService.sendToFulfilledPledges`)
    *   `GET /recipients/group/{groupId}` -> **IMPLEMENTED**
    *   `GET /recipients/department/{departmentId}` -> **IMPLEMENTED**
    *   `GET /recipients/all` -> **IMPLEMENTED**
    *   `GET /pendingPledgesRecipients` -> **IMPLEMENTED**
    *   `GET /fulfilledPledgesRecipients` -> **IMPLEMENTED**
*   **Notes:** Full parity achieved for SMS bulk messaging. Logic added to `SmsService` to fetch recipients from `MemberGroupRepository`, `DepartmentMemberRepository`, and `PledgeRepository`.

## 8. Summary of Gaps
1.  **SMS Bulk Messaging**: Full parity achieved.
2.  **Board Members**: Public-facing board member list is missing.
3.  **Member Self-Service**: Portal features (self-claim) missing.
4.  **Transaction Stats**: Budget stats endpoint missing.
