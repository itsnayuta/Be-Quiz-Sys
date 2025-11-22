import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamPurchaseModel = sequelize.define('ExamPurchase', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    exam_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Exams',
            key: 'id'
        }
    },
    purchase_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    purchase_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: 'ExamPurchase',
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'exam_id']
        }
    ]
});

export default ExamPurchaseModel;

