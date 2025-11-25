import { 
    createExam, 
    getExamById, 
    getExams, 
    updateExam, 
    deleteExam,
    getAvailableExamsForStudent,
    getExamDetailForStudent,
    switchQuestionCreationMethod
} from "../controllers/exam.controller.js";
import { verifyToken, verifyTeacher, verifyStudent } from "../middleware/authJWT.js";

const examRoutes = (app) => {
    // Create exam (only teacher)
    app.post('/api/exams', verifyToken, verifyTeacher, createExam);
    
    // Get all exams (teacher can see their own exams)
    app.get('/api/exams', verifyToken, verifyTeacher, getExams);
    
    // Get exam by ID
    app.get('/api/exams/:id', verifyToken, verifyTeacher, getExamById);
    
    // Update exam (only teacher who created it)
    app.put('/api/exams/:id', verifyToken, verifyTeacher, updateExam);

    // Switch question creation method (reset all questions)
    app.post('/api/exams/:id/switch-question-method', verifyToken, verifyTeacher, switchQuestionCreationMethod);
    
    // Delete exam (only teacher who created it)
    app.delete('/api/exams/:id', verifyToken, verifyTeacher, deleteExam);
    
    // Student: Get available exams (public + in student's classes)
    app.get('/api/student/exams', verifyToken, verifyStudent, getAvailableExamsForStudent);
    
    // Student: Get exam detail (không lộ đáp án)
    app.get('/api/student/exams/:id', verifyToken, verifyStudent, getExamDetailForStudent);
}

export default examRoutes;

