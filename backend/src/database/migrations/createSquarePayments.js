const { sequelize } = require('../../models');

async function createSquarePayments() {
  try {
    console.log('Creating square_payments table...');
    await sequelize.query(`SET search_path TO public;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS square_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        square_payment_id VARCHAR(191) NOT NULL UNIQUE,
        order_id VARCHAR(191),
        location_id VARCHAR(64),
        amount NUMERIC(10,2),
        currency VARCHAR(3),
        square_created_at TIMESTAMPTZ,
        buyer_name VARCHAR(255),
        buyer_email VARCHAR(255),
        note TEXT,
        card_brand VARCHAR(40),
        card_last4 VARCHAR(8),
        status VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW',
        matched_member_id BIGINT,
        match_confidence VARCHAR(20),
        match_source VARCHAR(60),
        transaction_id BIGINT,
        raw JSONB,
        processed_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS square_payments_status_idx ON square_payments(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS square_payments_matched_member_id_idx ON square_payments(matched_member_id);`);
    console.log('✅ square_payments table created');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  createSquarePayments()
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((error) => { console.error('❌ Error:', error); process.exit(1); });
}

module.exports = createSquarePayments;
