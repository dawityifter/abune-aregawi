'use strict';

const express = require('express');
const router = express.Router();

const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const departmentController = require('../controllers/departmentController');
const departmentMemberController = require('../controllers/departmentMemberController');

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
router.get('/', roleMiddleware(viewRoles), departmentController.getAllDepartments);
router.get('/:id', roleMiddleware(viewRoles), departmentController.getDepartmentById);
router.post('/', roleMiddleware(manageRoles), departmentController.createDepartment);
router.put('/:id', roleMiddleware(manageRoles), departmentController.updateDepartment);
router.delete('/:id', roleMiddleware(deleteRoles), departmentController.deleteDepartment);

// Department Members Management
router.get('/:departmentId/members', roleMiddleware(viewRoles), departmentMemberController.getDepartmentMembers);
router.post('/:departmentId/members', roleMiddleware(manageRoles), departmentMemberController.addMembersToDepartment);
router.put('/:departmentId/members/:memberId', roleMiddleware(manageRoles), departmentMemberController.updateDepartmentMember);
router.delete('/:departmentId/members/:memberId', roleMiddleware(manageRoles), departmentMemberController.removeMemberFromDepartment);

// Member's Departments (any authenticated user can view their own departments)
router.get('/members/:member_id/departments', departmentController.getMemberDepartments);

const { requireDepartmentRole, requireDepartmentMembership } = require('../middleware/departmentAuth');

// ========== MEETING ROUTES ==========
// Department meetings (leaders can manage, all members can view)
router.get('/:id/meetings', requireDepartmentMembership(), departmentController.getDepartmentMeetings);
router.get('/meetings/:id', requireDepartmentMembership(), departmentController.getMeetingById);
router.post('/:id/meetings', requireDepartmentRole(['leader', 'chairperson', 'secretary']), departmentController.createMeeting);
router.put('/meetings/:id', requireDepartmentRole(['leader', 'chairperson', 'secretary']), departmentController.updateMeeting);
router.delete('/meetings/:id', requireDepartmentRole(['leader', 'chairperson', 'secretary']), departmentController.deleteMeeting);

// ========== TASK ROUTES ==========
// Department tasks (leaders can manage, all members can view)
router.get('/:id/tasks', requireDepartmentMembership(), departmentController.getDepartmentTasks);
router.post('/:id/tasks', requireDepartmentMembership(), departmentController.createTask);
router.put('/tasks/:id', requireDepartmentMembership(), departmentController.updateTask);
router.delete('/tasks/:id', requireDepartmentMembership(), departmentController.deleteTask);

module.exports = router;
