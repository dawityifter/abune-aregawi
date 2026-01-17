'use strict';

const express = require('express');
const router = express.Router();

const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const departmentController = require('../controllers/departmentController');
const departmentMemberController = require('../controllers/departmentMemberController');

const { requireDepartmentRole, requireDepartmentMembership } = require('../middleware/departmentAuth');

// Public Routes
router.get('/board-members', departmentController.getBoardMembers);

// All routes require authentication
router.use(firebaseAuthMiddleware);

// Define role groups
const viewRoles = ['admin', 'church_leadership', 'secretary', 'treasurer']; // Can view departments
const manageRoles = ['admin', 'church_leadership', 'secretary']; // Can create/edit departments
const deleteRoles = ['admin']; // Can delete departments

// Department CRUD
router.get('/stats', roleMiddleware(viewRoles), departmentController.getDepartmentStats);
// Basic members can view the department list
router.get('/', roleMiddleware(['member', ...viewRoles]), departmentController.getAllDepartments);
router.get('/:id', requireDepartmentMembership(), departmentController.getDepartmentById);
router.post('/', roleMiddleware(manageRoles), departmentController.createDepartment);
router.put('/:id', roleMiddleware(manageRoles), departmentController.updateDepartment);
router.delete('/:id', roleMiddleware(deleteRoles), departmentController.deleteDepartment);

// Department Members Management
// Department Members Management
// Allow global admins AND department leaders to manage members
const leaderRoles = ['leader', 'chairperson', 'chairman', 'co-leader', 'vice chairperson', 'vice chairman', 'head'];
router.get('/:departmentId/members', roleMiddleware(viewRoles), departmentMemberController.getDepartmentMembers);
router.post('/:departmentId/members', requireDepartmentRole(leaderRoles), departmentMemberController.addMembersToDepartment);
router.put('/:departmentId/members/:memberId', requireDepartmentRole(leaderRoles), departmentMemberController.updateDepartmentMember);
router.delete('/:departmentId/members/:memberId', requireDepartmentRole(leaderRoles), departmentMemberController.removeMemberFromDepartment);

// Member's Departments (any authenticated user can view their own departments)
router.get('/members/:member_id/departments', departmentController.getMemberDepartments);


// ========== MEETING ROUTES ==========
// Department meetings (leaders can manage, all members can view)
router.get('/:id/meetings', requireDepartmentMembership(), departmentController.getDepartmentMeetings);
router.get('/meetings/:id', requireDepartmentMembership(), departmentController.getMeetingById);
router.post('/:id/meetings', requireDepartmentMembership(), departmentController.createMeeting);
router.put('/meetings/:id', requireDepartmentMembership(), departmentController.updateMeeting);
router.delete('/meetings/:id', requireDepartmentMembership(), departmentController.deleteMeeting);

// ========== TASK ROUTES ==========
// Department tasks (leaders can manage, all members can view)
router.get('/:id/tasks', requireDepartmentMembership(), departmentController.getDepartmentTasks);
router.post('/:id/tasks', requireDepartmentMembership(), departmentController.createTask);
router.put('/tasks/:id', requireDepartmentMembership(), departmentController.updateTask);
router.delete('/tasks/:id', requireDepartmentMembership(), departmentController.deleteTask);

module.exports = router;
