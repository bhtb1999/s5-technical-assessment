"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CampaignRecipient extends Model {
    static associate(models) {}
  }

  CampaignRecipient.init(
    {
      campaign_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "campaigns",
          key: "id",
        },
      },
      recipient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "recipients",
          key: "id",
        },
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      opened_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "sent", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      sequelize,
      modelName: "CampaignRecipient",
      tableName: "campaign_recipients",
      underscored: true,
      timestamps: false,
    },
  );

  return CampaignRecipient;
};
