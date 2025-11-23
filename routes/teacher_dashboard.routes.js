import { getTeacherDashboardStats } from "../controllers/teacher_dashboard.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const teacherDashboardRoutes = (app) => {
    // Get teacher dashboard statistics
    app.get('/api/teacher/dashboard/stats', verifyToken, verifyTeacher, getTeacherDashboardStats);
}

export default teacherDashboardRoutes;

