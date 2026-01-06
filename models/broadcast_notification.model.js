import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const BroadcastNotificationModel = sequelize.define('BroadcastNotifications', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    admin_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    target_type: {
        type: DataTypes.ENUM('all', 'role', 'specific_users'),
        allowNull: false
    },
    target_role: {
        type: DataTypes.ENUM('student', 'teacher', 'admin'),
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium'
    },
    data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON chứa thông tin chi tiết như link, user_ids, etc.'
    },
    recipients_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'BroadcastNotifications'
});

export default BroadcastNotificationModel;
