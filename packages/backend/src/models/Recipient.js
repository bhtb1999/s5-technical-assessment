'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Recipient extends Model {
    static associate(models) {
      Recipient.belongsToMany(models.Campaign, {
        through: models.CampaignRecipient,
        foreignKey: 'recipient_id',
        otherKey: 'campaign_id',
        as: 'campaigns',
      });
    }
  }

  Recipient.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'Recipient',
      tableName: 'recipients',
      underscored: true,
      timestamps: false,
    }
  );

  return Recipient;
};
