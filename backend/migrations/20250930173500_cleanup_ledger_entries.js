"use strict";

/**
 * Migration: Cleanup ledger_entries table
 * - Drop unmapped legacy columns if they exist (e.g., currency, bank_account, cleared, bank_txn_id, etc.)
 * - Ensure required indexes exist per current LedgerEntry model
 *
 * Safe/Idempotent:
 * - Uses describeTable() to check column existence before dropping
 * - Uses showIndex() to check index existence before creating
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "ledger_entries";

    // 1) Drop legacy/unmapped columns if they exist
    const columns = await queryInterface.describeTable(table);

    // List of legacy columns to drop. currency is included per request.
    const legacyColumns = [
      "currency",
      "bank_account",
      "cleared",
      "bank_txn_id",
      // Optional historical possibilities; guard with existence checks
      "reconciled",
      "reconciled_at",
      "bank_statement_id",
      "bank_reference",
    ];

    for (const col of legacyColumns) {
      if (columns[col]) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeColumn(table, col);
      }
    }

    // 2) Ensure required indexes exist (do not drop extras unless conflicting)
    const existingIndexes = await queryInterface.showIndex(table).catch(() => []);

    const hasIndex = (nameOrFields) => {
      // Accept either index name or array of fields
      return existingIndexes.some((idx) => {
        if (typeof nameOrFields === "string") return idx.name === nameOrFields;
        if (Array.isArray(nameOrFields)) {
          const fields = idx.fields?.map((f) => f.attribute || f.column) || [];
          return (
            fields.length === nameOrFields.length &&
            nameOrFields.every((f, i) => fields[i] === f)
          );
        }
        return false;
      });
    };

    // Unique index on external_id
    if (!hasIndex(["external_id"])) {
      await queryInterface.addIndex(table, ["external_id"], {
        name: "ledger_entries_external_id",
        unique: true,
      });
    }

    // Non-unique indexes used by queries in controllers
    const requiredNonUnique = [
      { fields: ["transaction_id"], name: "ledger_entries_transaction_id" },
      { fields: ["member_id"], name: "ledger_entries_member_id" },
      { fields: ["entry_date"], name: "ledger_entries_entry_date" },
      { fields: ["account"], name: "ledger_entries_account" },
      { fields: ["category"], name: "ledger_entries_category" },
      { fields: ["status"], name: "ledger_entries_status" },
    ];

    for (const idx of requiredNonUnique) {
      if (!hasIndex(idx.fields) && !hasIndex(idx.name)) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.addIndex(table, idx.fields, { name: idx.name });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const table = "ledger_entries";

    // 1) Re-add currency column (others are legacy and will not be restored automatically)
    const columns = await queryInterface.describeTable(table);
    if (!columns["currency"]) {
      await queryInterface.addColumn(table, "currency", {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "USD",
      });
    }

    // 2) Optionally remove the indexes we added in up()
    const existingIndexes = await queryInterface.showIndex(table).catch(() => []);
    const dropIfExists = async (name) => {
      const exists = existingIndexes.some((i) => i.name === name);
      if (exists) {
        await queryInterface.removeIndex(table, name);
      }
    };

    await dropIfExists("ledger_entries_external_id");
    await dropIfExists("ledger_entries_transaction_id");
    await dropIfExists("ledger_entries_member_id");
    await dropIfExists("ledger_entries_entry_date");
    await dropIfExists("ledger_entries_account");
    await dropIfExists("ledger_entries_category");
    await dropIfExists("ledger_entries_status");
  },
};
