import { Op } from "sequelize";
import sequelize from "../config/db.config.js";
import { ExamResultModel, ExamSessionModel, StudentAnswerModel, ExamModel, QuestionModel, QuestionAnswerModel, UserModel, ClassStudentModel } from "../models/index.model.js";
import { finalizeSessionResult } from "../services/exam_result.service.js";

// Submit bài thi (nộp bài và tính điểm)
export const submitExam = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;

        // Kiểm tra session có tồn tại và thuộc về student không
        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({ 
                message: 'Exam session not found or you do not have permission' 
            });
        }

        const { result, summary, alreadySubmitted } = await finalizeSessionResult(session, student_id);

        if (alreadySubmitted) {
            return res.status(200).send({
                message: 'Exam already submitted',
                result
            });
        }

        return res.status(200).send({
            message: 'Exam submitted successfully',
            result,
            summary
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy kết quả thi của một session
export const getResult = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;

        // Kiểm tra session có tồn tại và thuộc về student không
        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id
            }
        });

        if (!session) {
            return res.status(404).send({ 
                message: 'Exam session not found or you do not have permission' 
            });
        }

        // Lấy kết quả
        const result = await ExamResultModel.findOne({
            where: { session_id: session_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                }
            ]
        });

        if (!result) {
            return res.status(404).send({ 
                message: 'Result not found. Please submit the exam first.' 
            });
        }

        // Lấy tất cả câu trả lời của session
        const studentAnswers = await StudentAnswerModel.findAll({
            where: { session_id: session_id },
            include: [
                {
                    model: QuestionModel,
                    as: 'question',
                    attributes: ['id', 'question_text', 'type', 'difficulty', 'order', 'image_url'],
                    include: [
                        {
                            model: QuestionAnswerModel,
                            as: 'answers',
                            attributes: ['id', 'text', 'is_correct']
                        }
                    ]
                },
                {
                    model: QuestionAnswerModel,
                    as: 'selectedAnswer',
                    attributes: ['id', 'text', 'is_correct'],
                    required: false
                }
            ],
            order: [
                [{ model: QuestionModel, as: 'question' }, 'order', 'ASC']
            ]
        });

        return res.status(200).send({
            result: result,
            answers: studentAnswers
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả kết quả thi của student
export const getStudentResults = async (req, res) => {
    try {
        const student_id = req.userId;
        const { exam_id } = req.query; // Optional: filter by exam_id

        let whereCondition = {
            student_id: student_id
        };

        if (exam_id) {
            whereCondition.exam_id = exam_id;
        }

        const results = await ExamResultModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        return res.status(200).send(results);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả kết quả của một exam (cho teacher)
export const getExamResults = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền xem kết quả của exam
        if (role !== 'teacher') {
            return res.status(403).send({ 
                message: 'Only teacher can view exam results' 
            });
        }

        // Kiểm tra exam có tồn tại và thuộc về teacher không
        const exam = await ExamModel.findOne({
            where: {
                id: exam_id,
                created_by: userId
            }
        });

        if (!exam) {
            return res.status(404).send({ 
                message: 'Exam not found or you do not have permission' 
            });
        }

        // Lấy tất cả kết quả của exam
        const results = await ExamResultModel.findAll({
            where: { exam_id: exam_id },
            include: [
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                },
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        return res.status(200).send({
            exam: {
                id: exam.id,
                title: exam.title,
                total_score: exam.total_score
            },
            results: results,
            total_submissions: results.length
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// So sánh kết quả của student với lớp và toàn bộ người làm đề
export const getStudentComparison = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const student_id = req.userId;

        const studentResult = await ExamResultModel.findOne({
            where: {
                exam_id: exam_id,
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score', 'class_id']
                }
            ]
        });

        if (!studentResult) {
            return res.status(404).send({
                message: 'Result not found. Submit the exam first.'
            });
        }

        const studentScore = Number(studentResult.total_score);

        const [globalAggregate] = await ExamResultModel.findAll({
            where: { exam_id: exam_id },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('Exam_results.id')), 'total'],
                [sequelize.fn('AVG', sequelize.col('total_score')), 'average_score'],
                [sequelize.fn('MAX', sequelize.col('total_score')), 'best_score'],
                [sequelize.fn('MIN', sequelize.col('total_score')), 'lowest_score']
            ],
            raw: true
        });

        const globalTotal = Number(globalAggregate?.total ?? 0);
        const globalAverage = globalAggregate?.average_score ? Number(globalAggregate.average_score) : 0;
        const globalBest = globalAggregate?.best_score ? Number(globalAggregate.best_score) : 0;
        const globalLowest = globalAggregate?.lowest_score ? Number(globalAggregate.lowest_score) : 0;

        const globalHigher = await ExamResultModel.count({
            where: {
                exam_id: exam_id,
                total_score: { [Op.gt]: studentScore }
            }
        });

        const globalRank = globalHigher + 1;
        const globalPercentile = globalTotal > 0 ? Number((((globalTotal - globalRank) / globalTotal) * 100).toFixed(2)) : null;

        let classComparison = {
            available: false,
            reason: 'Exam is not attached to any class.'
        };

        const examClassId = studentResult.exam?.class_id || null;

        if (examClassId) {
            const classStudents = await ClassStudentModel.findAll({
                where: {
                    class_id: examClassId,
                    is_ban: false
                },
                attributes: ['student_id'],
                raw: true
            });

            const classStudentIds = classStudents.map((row) => row.student_id);
            const belongsToClass = classStudentIds.includes(student_id);

            if (!belongsToClass) {
                classComparison = {
                    available: false,
                    reason: 'You are not part of this class.'
                };
            } else if (classStudentIds.length === 0) {
                classComparison = {
                    available: false,
                    reason: 'No students found in this class.'
                };
            } else {
                const classFilter = {
                    exam_id: exam_id,
                    student_id: { [Op.in]: classStudentIds }
                };

                const classTotal = await ExamResultModel.count({ where: classFilter });

                if (classTotal === 0) {
                    classComparison = {
                        available: false,
                        reason: 'No classmate has submitted this exam yet.'
                    };
                } else {
                    const classHigher = await ExamResultModel.count({
                        where: {
                            ...classFilter,
                            total_score: { [Op.gt]: studentScore }
                        }
                    });

                    const [classAggregate] = await ExamResultModel.findAll({
                        where: classFilter,
                        attributes: [
                            [sequelize.fn('AVG', sequelize.col('total_score')), 'average_score'],
                            [sequelize.fn('MAX', sequelize.col('total_score')), 'best_score']
                        ],
                        raw: true
                    });

                    const classRank = classHigher + 1;
                    const classPercentile = Number((((classTotal - classRank) / classTotal) * 100).toFixed(2));

                    classComparison = {
                        available: true,
                        rank: classRank,
                        total: classTotal,
                        percentile: classPercentile,
                        average_score: classAggregate?.average_score ? Number(classAggregate.average_score) : 0,
                        best_score: classAggregate?.best_score ? Number(classAggregate.best_score) : 0
                    };
                }
            }
        }

        return res.status(200).send({
            exam: {
                id: studentResult.exam.id,
                title: studentResult.exam.title,
                class_id: studentResult.exam.class_id,
                total_score: studentResult.exam.total_score
            },
            student: {
                id: studentResult.student_id,
                score: studentScore,
                correct_count: studentResult.correct_count,
                wrong_count: studentResult.wrong_count,
                submitted_at: studentResult.submitted_at
            },
            comparison: {
                global: {
                    rank: globalRank,
                    total: globalTotal,
                    percentile: globalPercentile,
                    average_score: globalAverage,
                    best_score: globalBest,
                    lowest_score: globalLowest
                },
                class: classComparison
            }
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Teacher cập nhật feedback cho exam result
export const updateFeedback = async (req, res) => {
    try {
        const { result_id } = req.params;
        const { feedback } = req.body;
        const userId = req.userId;
        const role = req.role;

        // Chỉ teacher mới có quyền cập nhật feedback
        if (role !== 'teacher') {
            return res.status(403).send({ 
                message: 'Only teacher can update feedback' 
            });
        }

        // Tìm exam result
        const result = await ExamResultModel.findOne({
            where: { id: result_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'created_by']
                }
            ]
        });

        if (!result) {
            return res.status(404).send({ 
                message: 'Exam result not found' 
            });
        }

        // Kiểm tra teacher có quyền với exam này không
        if (result.exam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to update feedback for this exam result' 
            });
        }

        // Cập nhật feedback
        await result.update({
            feedback: feedback || null
        });

        // Lấy lại result với đầy đủ thông tin
        const updatedResult = await ExamResultModel.findOne({
            where: { id: result_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'total_score']
                },
                {
                    model: ExamSessionModel,
                    as: 'session',
                    attributes: ['id', 'code', 'start_time', 'end_time', 'submitted_at', 'status']
                },
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        return res.status(200).send({
            message: 'Feedback updated successfully',
            result: updatedResult
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

