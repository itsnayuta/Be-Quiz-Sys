import express from "express";

import 'dotenv/config.js';
import cors from 'cors'; 

import sequelize from "./config/db.config.js";
import "./models/index.model.js";

import authRoutes from "./routes/auth.routes.js";
import authClasses from "./routes/classes.routes.js";
import authUser from "./routes/user.routes.js";
import examRoutes from "./routes/exam.routes.js";
import questionRoutes from "./routes/question.routes.js";
import questionAnswerRoutes from "./routes/question_answer.routes.js";
import examFavoriteRoutes from "./routes/exam_favorite.routes.js";
import examCommentRoutes from "./routes/exam_comment.routes.js";
import examSessionRoutes from "./routes/exam_session.routes.js";
import studentAnswerRoutes from "./routes/student_answer.routes.js";
import examResultRoutes from "./routes/exam_result.routes.js";
import { startAutoSubmitScheduler } from "./services/exam_result.service.js";
import notificationRoutes from "./routes/notification.routes.js";
import examPurchaseRoutes from "./routes/exam_purchase.routes.js";

import postRoutes from "./routes/posts.routes.js";
const app = express()

app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
}));
app.use(express.json())
app.use(express.urlencoded({extended:true}))

sequelize.sync({ alter: true }).then(()=>{
    console.log('Database synced')
}).catch(error => {console.error(error.message)})


authRoutes(app);
authClasses(app)
authUser(app)
examRoutes(app)
questionRoutes(app)
questionAnswerRoutes(app)
examFavoriteRoutes(app)
examCommentRoutes(app)
examSessionRoutes(app)
studentAnswerRoutes(app)
postRoutes(app)
examResultRoutes(app)
notificationRoutes(app)
examPurchaseRoutes(app)

startAutoSubmitScheduler();
const PORT  =process.env.PORT || 5005;
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`)
})