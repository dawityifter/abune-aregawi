'use strict';

const { Model, DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  class Pledge extends Model {
    static associate(models) {
      // Define associations here if needed
      // Pledge belongs to Member
      Pledge.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      // Pledge can be linked to a Donation when fulfilled
      Pledge.belongsTo(models.Donation, {
        foreignKey: 'donation_id',
        as: 'donation'
      });

      Pledge.belongsTo(models.PledgeCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
      Pledge.hasMany(models.PledgeAllocation, { foreignKey: 'pledge_id', as: 'allocations' });
    }
  }

  Pledge.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'usd'
    },
    pledge_type: {
      type: DataTypes.ENUM('general', 'event', 'fundraising', 'tithe'),
      allowNull: false,
      defaultValue: 'general'
    },
    event_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Renamed from `status`. Holds the hand-flipped 2025 values verbatim.
    // NOT a source of truth: fulfillment is derived in the pledge_balances view.
    // Renaming was deliberate — leaving it called `status` is how this bug returns.
    legacy_status: {
      type: DataTypes.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: true
    },
    campaign_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'pledge_campaigns', key: 'id' }
    },
    // The ONLY mutable state on a pledge. Fulfillment is never stored.
    lifecycle: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'active',
      validate: { isIn: [['active', 'cancelled']] }
    },
    // True for every 2025 row. Required because 6 members hold duplicate 2025
    // pledges, which would break the partial unique index below.
    is_historical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // The recorded human choice, NOT a fulfillment state. Fulfillment is still
    // derived from pledge_allocations by the pledge_balances view and is never
    // stored. This column answers "what did they say they were doing", which
    // cannot be reliably re-derived later.
    fulfillment_intent: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'later',
      validate: { isIn: [['later', 'immediate']] }
    },
    // The donor's recorded wish. Never a viewer permission — PledgeTracker's
    // role-based masking is a different thing entirely.
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // Internal identifier for an anonymous giver with no account, so the church
    // can reconcile the payment. Mirrors members.baptism_name.
    baptism_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    pledge_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fulfilled_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Contact information
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmailOrEmpty(value) {
          // Allow null, undefined, or empty string
          if (!value || value.trim() === '') {
            return true;
          }
          // If value is provided, validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error('Please enter a valid email address');
          }
          return true;
        }
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    zip_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Link to donation when fulfilled
    donation_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'donations',
        key: 'id'
      }
    },
    // Additional fields
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Pledge',
    tableName: 'pledges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['campaign_id', 'lifecycle'] },
      {
        name: 'pledges_one_active_per_member_per_campaign',
        unique: true,
        fields: ['campaign_id', 'member_id'],
        where: {
          member_id: { [Op.ne]: null },
          lifecycle: 'active',
          is_historical: false,
          fulfillment_intent: 'later'
        }
      }
    ],
    validate: {
      // Mirrors the pledges_anonymous_requires_immediate CHECK. Required here
      // because the Jest suite builds its schema with sequelize.sync(), which
      // never runs migrations — without this the rule is untested and unenforced
      // outside production.
      anonymousMustBeImmediate() {
        if (this.is_anonymous && this.fulfillment_intent !== 'immediate') {
          throw new Error('An anonymous pledge must be fulfilled immediately');
        }
      },
      // Mirrors the pledges_anonymous_is_identifiable CHECK. Anonymous to the
      // parish, never anonymous to the treasurer.
      anonymousMustBeIdentifiable() {
        if (!this.is_anonymous) return;
        const hasBaptismName = String(this.baptism_name || '').trim().length > 0;
        if (this.member_id == null && !hasBaptismName) {
          throw new Error('An anonymous pledge requires a baptism name or a linked member');
        }
      }
    }
  });

  return Pledge;
};
