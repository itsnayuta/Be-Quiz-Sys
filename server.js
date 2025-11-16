import express from "express";

import 'dotenv/config.js';
import cors from 'cors'; 

import sequelize from "./config/db.config.js";
import "./models/index.model.js";

import authRoutes from "./routes/auth.routes.js";
import authClasses from "./routes/classes.routes.js";
import authUser from "./routes/user.routes.js";
import examRoutes from "./routes/exam.routes.js";

const app = express()

//app.use(cors());
app.use(express.json())
app.use(express.urlencoded({extended:true}))

sequelize.sync().then(()=>{
    console.log('Database synced')
}).catch(error => {console.error(error.message)})


authRoutes(app);
authClasses(app)
authUser(app)
examRoutes(app)
const PORT  =process.env.PORT || 5005;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`)
})