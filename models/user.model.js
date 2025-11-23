

import sequelize from "../config/db.config.js";
import { DataTypes } from "sequelize";

const UserModel = sequelize.define("User",{
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    fullName:{
        type: DataTypes.STRING,
        allowNull: false
    },

    email:{
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }

    },

    password: {
        type: DataTypes.STRING,
        allowNull: false

        
    },

    balance: {
        type: DataTypes.DECIMAL(19, 4), 
        allowNull: false,
        defaultValue: 0 
    },
    role: {
        type: DataTypes.ENUM('student','teacher','admin','superadmin'),
        allowNull: false,
        defaultValue: 'student'
    },

    last_login: {
        type: DataTypes.DATE
    }},{
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'User'

    }    
);

export default UserModel;

