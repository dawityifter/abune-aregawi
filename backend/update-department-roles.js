/**
 * Script to update department member roles
 * 
 * Usage:
 * node update-department-roles.js
 */

require('dotenv').config();
const { DepartmentMember, Department, Member } = require('./src/models');

async function updateRoles() {
    try {
        console.log('🔄 Updating department member roles...\n');

        // Example: Update Sebeka Gubae roles
        const sebekaGubae = await Department.findOne({ where: { name: 'Sebeka Gubae' } });

        if (sebekaGubae) {
            console.log(`Found department: ${sebekaGubae.name} (ID: ${sebekaGubae.id})\n`);

            // Get all members of this department
            const members = await DepartmentMember.findAll({
                where: { department_id: sebekaGubae.id },
                include: [{ model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] }]
            });

            console.log('Current members:');
            members.forEach((m, i) => {
                console.log(`${i + 1}. ${m.member.first_name} ${m.member.last_name} - ${m.role_in_department} (Member ID: ${m.member_id})`);
            });

            console.log('\n=== UPDATE ROLES BELOW ===\n');
            console.log('Uncomment and modify the examples below to update roles:\n');

            console.log('// Example: Update specific member role by member_id');
            console.log('// await DepartmentMember.update(');
            console.log('//   { role_in_department: "Chairman" },');
            console.log('//   { where: { department_id: sebekaGubae.id, member_id: 3 } }');
            console.log('// );');
            console.log('//');
            console.log('// Available role examples:');
            console.log('// - "Chairman"');
            console.log('// - "Vice Chairman"');
            console.log('// - "Secretary"');
            console.log('// - "Church Administrator"');
            console.log('// - "Financial Guardian"');
            console.log('// - "Auditor"');
            console.log('// - "Building Overseer"');
            console.log('// - "Member"');

            // Update roles for Sebeka Gubae members
            const updates = [
                { id: 331, name: 'Tadesse Araya', role: 'Chairperson' },
                { id: 48, name: 'Fetsum Biadgelgne', role: 'Vice Chairperson' },
                { id: 66, name: 'Solomon Gebreslasie', role: 'General Secretary' }
            ];

            for (const update of updates) {
                await DepartmentMember.update(
                    { role_in_department: update.role },
                    { where: { department_id: sebekaGubae.id, member_id: update.id } }
                );
                console.log(`✅ Updated ${update.name} (ID: ${update.id}) to '${update.role}'`);
            }

        } else {
            console.log('❌ Sebeka Gubae department not found');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating roles:', error);
        process.exit(1);
    }
}

updateRoles();
