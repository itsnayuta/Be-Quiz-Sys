import { 
    createExam, 
    getExamById, 
    getExams, 
    updateExam, 
    deleteExam 
} from "../controllers/exam.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const examRoutes = (app) => {
    // Create exam (only teacher)
    app.post('/api/exams', verifyToken, verifyTeacher, createExam);
    
    // Get all exams (teacher can see their own exams)
    app.get('/api/exams', verifyToken, verifyTeacher, getExams);
    
    // Get exam by ID
    app.get('/api/exams/:id', verifyToken, verifyTeacher, getExamById);
    
    // Update exam (only teacher who created it)
    app.put('/api/exams/:id', verifyToken, verifyTeacher, updateExam);
    
    // Delete exam (only teacher who created it)
    app.delete('/api/exams/:id', verifyToken, verifyTeacher, deleteExam);
}

export default examRoutes;

