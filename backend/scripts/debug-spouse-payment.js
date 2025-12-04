const { Member, Transaction, sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function debugSpousePayment() {
    try {
        console.log('🔍 Searching for Meaza Abera...');
        const meaza = await Member.findOne({
            where: {
                first_name: { [Op.iLike]: 'Meaza' },
                last_name: { [Op.iLike]: 'Abera' }
            }
        });

        if (!meaza) {
            console.log('❌ Meaza Abera not found in Members table.');
        } else {
            console.log('✅ Found Meaza Abera:', meaza.toJSON());

            // Check for transactions for Meaza
            const meazaTransactions = await Transaction.findAll({
                where: { member_id: meaza.id }
            });
            console.log(`💰 Found ${meazaTransactions.length} transactions for Meaza.`);
            meazaTransactions.forEach(t => console.log(`   - ${t.payment_date}: $${t.amount} (${t.payment_type})`));
        }

        // Search for potential spouse (Head of Household)
        console.log('\n🔍 Searching for members with spouse "Meaza Abera"...');
        const spouse = await Member.findOne({
            where: {
                spouse_name: { [Op.iLike]: '%Meaza%' }
            }
        });

        if (!spouse) {
            console.log('❌ No member found with spouse name matching "Meaza".');
        } else {
            console.log('✅ Found potential spouse:', spouse.toJSON());

            // Check family linkage
            console.log('\n🔗 Checking Family Linkage:');
            console.log(`   - Spouse (HoH) ID: ${spouse.id}, Family ID: ${spouse.family_id}`);
            if (meaza) {
                console.log(`   - Meaza ID: ${meaza.id}, Family ID: ${meaza.family_id}`);

                if (String(spouse.family_id) === String(meaza.family_id)) {
                    console.log('✅ Family IDs match!');
                } else {
                    console.log('❌ Family IDs do NOT match!');
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

debugSpousePayment();
