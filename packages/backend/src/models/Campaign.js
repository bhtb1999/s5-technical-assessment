'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Campaign extends Model {
    static associate(models) {
      Campaign.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'creator',
      });
      Campaign.belongsToMany(models.Recipient, {
        through: models.CampaignRecipient,
        foreignKey: 'campaign_id',
        otherKey: 'recipient_id',
        as: 'recipients',
      });
      Campaign.hasMany(models.CampaignRecipient, {
        foreignKey: 'campaign_id',
        as: 'campaignRecipients',
      });
    }
  }

  Campaign.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'sending', 'scheduled', 'sent'),
        allowNull: false,
        defaultValue: 'draft',
      },
      scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'Campaign',
      tableName: 'campaigns',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return Campaign;
};
