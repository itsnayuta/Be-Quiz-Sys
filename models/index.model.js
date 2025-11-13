import dbConfig from "../config/db.config";
import { Sequelize,DataTypes } from "sequelize";


import { UserModel } from "./user.model";

const sequelize = new Sequelize(
  dbConfig.DB,
  dbConfig.HOST,
  dbConfig.PASSWORD,
  {
    host:dbConfig.HOST,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool
  }
)

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize

db.User = UserModel(sequelize,Sequelize);



export default db;