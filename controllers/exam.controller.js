import { ExamModel, ClassesModel, ClassStudentModel, QuestionModel, QuestionAnswerModel, StudentAnswerModel } from "../models/index.model.js";
import { Op } from "sequelize";
import { notifyExamAssignedToClass } from "../services/notification.service.js";

const ALLOWED_QUESTION_METHODS = ['text', 'editor'];

function normalizeQuestionMethod(value) {
    if (!value) return null;
    return ALLOWED_QUESTION_METHODS.includes(value) ? value : null;
}

export const createExam = async (req, res) => {
    try {
        const {
            class_id,
            title,
            des,
            total_score,
            minutes,
            start_time,
            end_time,
            is_paid,
            fee,
            is_public,
            question_creation_method
        } = req.body;

        const created_by = req.userId; // Get from middleware

        // Validate required fields
        if (!title || !minutes || !start_time || !end_time) {
            return res.status(400).send({ 
                message: 'Missing required fields: title, minutes, start_time, end_time' 
            });
        }

        // Validate class chỉ khi có class_id (class_id có thể null)
        if (class_id) {
            const classInfo = await ClassesModel.findOne({
                where: {
                    id: class_id,
                    teacher_id: created_by
                }
            });

            if (!classInfo) {
                return res.status(404).send({ 
                    message: 'Class not found or you do not have permission to create exam for this class' 
                });
            }
        }

        // Validate dates
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);

        if (startDate >= endDate) {
            return res.status(400).send({ 
                message: 'End time must be after start time' 
            });
        }

        // Validate fee if is_paid is true
        if (is_paid && (!fee || fee <= 0)) {
            return res.status(400).send({ 
                message: 'Fee is required when is_paid is true' 
            });
        }

        const normalizedQuestionMethod = normalizeQuestionMethod(question_creation_method);
        if (question_creation_method && !normalizedQuestionMethod) {
            return res.status(400).send({
                message: 'Invalid question_creation_method. Allowed values: text, editor'
            });
        }

        // Create exam
        const exam = await ExamModel.create({
            class_id: class_id || null, // Cho phép null (có thể gắn vào class sau)
            title,
            des: des || null,
            total_score: total_score || 100,
            minutes,
            start_time: startDate,
            end_time: endDate,
            is_paid: is_paid || false,
            fee: is_paid ? fee : 0,
            created_by,
            is_public: is_public || false,
            count: 0,
            question_creation_method: normalizedQuestionMethod
        });

        // Gửi thông báo cho students nếu exam được gắn vào class
        if (class_id) {
            try {
                await notifyExamAssignedToClass(exam.id, class_id);
            } catch (notifError) {
                console.error('Error sending notification:', notifError);
                // Không fail request nếu thông báo lỗi
            }
        }

        return res.status(201).send(exam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get exam by ID
export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;

        const exam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode']
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Teacher can only see their own exams
        if (role === 'teacher' && exam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to view this exam' 
            });
        }

        return res.status(200).send(exam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all exams (by class or all for teacher)
export const getExams = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const { class_id } = req.query;

        let whereCondition = {};

        if (role === 'teacher') {
            // Teacher can only see exams they created
            whereCondition.created_by = userId;
            
            // Filter by class if provided
            if (class_id) {
                whereCondition.class_id = class_id;
            }
        }

        const exams = await ExamModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).send(exams);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Update exam
export const updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const {
            class_id,
            title,
            des,
            total_score,
            minutes,
            start_time,
            end_time,
            is_paid,
            fee,
            is_public,
            question_creation_method
        } = req.body;

        // Find exam
        const exam = await ExamModel.findOne({
            where: { id }
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Check if user is the creator
        if (exam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to update this exam' 
            });
        }

        // Validate dates if provided
        if (start_time || end_time) {
            const startDate = start_time ? new Date(start_time) : new Date(exam.start_time);
            const endDate = end_time ? new Date(end_time) : new Date(exam.end_time);

            if (startDate >= endDate) {
                return res.status(400).send({ 
                    message: 'End time must be after start time' 
                });
            }
        }

        // Validate fee if is_paid is true
        const finalIsPaid = is_paid !== undefined ? is_paid : exam.is_paid;
        if (finalIsPaid && (!fee || fee <= 0)) {
            return res.status(400).send({ 
                message: 'Fee is required when is_paid is true' 
            });
        }

        // Validate class_id nếu được cung cấp (cho phép null để bỏ gắn exam)
        if (class_id !== undefined) {
            // Nếu set class_id = null, cho phép (để bỏ gắn exam khỏi class)
            if (class_id !== null) {
                const classInfo = await ClassesModel.findOne({
                    where: {
                        id: class_id,
                        teacher_id: userId
                    }
                });

                if (!classInfo) {
                    return res.status(404).send({ 
                        message: 'Class not found or you do not have permission to assign exam to this class' 
                    });
                }
            }
        }

        // Lưu class_id cũ để kiểm tra xem có thay đổi không
        const oldClassId = exam.class_id;
        const newClassId = class_id !== undefined ? class_id : oldClassId;

        // Validate question creation method updates
        let normalizedQuestionMethodValue = undefined;
        if (question_creation_method !== undefined) {
            const normalizedMethod = question_creation_method
                ? normalizeQuestionMethod(question_creation_method)
                : null;

            if (question_creation_method && !normalizedMethod) {
                return res.status(400).send({
                    message: 'Invalid question_creation_method. Allowed values: text, editor'
                });
            }

            const existingMethod = exam.question_creation_method;

            if (existingMethod && normalizedMethod && existingMethod !== normalizedMethod) {
                return res.status(400).send({
                    message: `Question creation method has already been locked to "${existingMethod}".`
                });
            }

            if (existingMethod && normalizedMethod === null) {
                return res.status(400).send({
                    message: 'Question creation method cannot be unset once selected.'
                });
            }

            if (!existingMethod || normalizedMethod === existingMethod) {
                // Only set when previously empty or same value (idempotent)
                normalizedQuestionMethodValue = normalizedMethod ?? existingMethod ?? null;
            }
        }

        // Update exam
        const updateData = {};
        if (class_id !== undefined) updateData.class_id = class_id; // Cho phép set null để bỏ gắn exam
        if (title !== undefined) updateData.title = title;
        if (des !== undefined) updateData.des = des;
        if (total_score !== undefined) updateData.total_score = total_score;
        if (minutes !== undefined) updateData.minutes = minutes;
        if (start_time !== undefined) updateData.start_time = new Date(start_time);
        if (end_time !== undefined) updateData.end_time = new Date(end_time);
        if (is_paid !== undefined) updateData.is_paid = is_paid;
        if (fee !== undefined) updateData.fee = finalIsPaid ? fee : 0;
        if (is_public !== undefined) updateData.is_public = is_public;
        if (question_creation_method !== undefined && normalizedQuestionMethodValue !== undefined) {
            updateData.question_creation_method = normalizedQuestionMethodValue;
        }

        await exam.update(updateData);

        // Gửi thông báo nếu exam được gắn vào class mới (từ null -> có giá trị, hoặc đổi class)
        if (newClassId && newClassId !== oldClassId) {
            try {
                await notifyExamAssignedToClass(exam.id, newClassId);
            } catch (notifError) {
                console.error('Error sending notification:', notifError);
                // Không fail request nếu thông báo lỗi
            }
        }

        // Return updated exam
        const updatedExam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode']
                }
            ]
        });

        return res.status(200).send(updatedExam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

export const switchQuestionCreationMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { target_method } = req.body;
        const userId = req.userId;

        if (!target_method) {
            return res.status(400).send({
                message: 'target_method is required (text | editor)'
            });
        }

        const normalizedTarget = normalizeQuestionMethod(target_method);
        if (!normalizedTarget) {
            return res.status(400).send({
                message: 'Invalid target_method. Allowed values: text, editor'
            });
        }

        const exam = await ExamModel.findOne({
            where: { id, created_by: userId }
        });

        if (!exam) {
            return res.status(404).send({
                message: 'Exam not found or you do not have permission to update it'
            });
        }

        if (!exam.question_creation_method) {
            return res.status(400).send({
                message: 'Question creation method has not been selected yet.'
            });
        }

        if (exam.question_creation_method === normalizedTarget) {
            return res.status(400).send({
                message: 'Exam is already using the requested question creation method.'
            });
        }

        const transaction = await ExamModel.sequelize.transaction();

        try {
            const questions = await QuestionModel.findAll({
                where: { exam_id: id, teacher_id: userId },
                attributes: ['id'],
                transaction
            });

            const questionIds = questions.map(q => q.id);

            if (questionIds.length > 0) {
                await StudentAnswerModel.destroy({
                    where: { exam_question_id: questionIds },
                    transaction
                });

                await QuestionAnswerModel.destroy({
                    where: { question_id: questionIds },
                    transaction
                });

                await QuestionModel.destroy({
                    where: { id: questionIds },
                    transaction
                });
            }

            await exam.update(
                {
                    question_creation_method: normalizedTarget,
                    count: 0
                },
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        const updatedExam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode'],
                    required: false
                }
            ]
        });

        return res.status(200).send({
            message: 'Question creation method switched successfully. All previous questions have been removed.',
            exam: updatedExam
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Delete exam
export const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Find exam
        const exam = await ExamModel.findOne({
            where: { id }
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Check if user is the creator
        if (exam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to delete this exam' 
            });
        }

        // Delete exam
        await exam.destroy();

        return res.status(200).send({ 
            message: 'Exam deleted successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all exams available for student (public exams + exams in student's classes)
export const getAvailableExamsForStudent = async (req, res) => {
    try {
        const student_id = req.userId;
        const { class_id } = req.query; // Optional: filter by class

        // Lấy danh sách class_id mà student đã join
        const studentClasses = await ClassStudentModel.findAll({
            where: { student_id: student_id },
            attributes: ['class_id']
        });

        const studentClassIds = studentClasses.map(sc => sc.class_id);

        const orConditions = [
            {
                is_public: true,
                class_id: null
            }
        ];

        if (studentClassIds.length > 0) {
            orConditions.push({
                is_public: true,
                class_id: {
                    [Op.in]: studentClassIds
                }
            });
        }

        let whereCondition = {
            [Op.or]: orConditions
        };

        if (class_id) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id,
                    student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of this class'
                });
            }

            whereCondition = {
                is_public: true,
                class_id
            };
        }

        const exams = await ExamModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Thêm thông tin về trạng thái exam (chưa bắt đầu, đang diễn ra, đã kết thúc)
        const now = new Date();
        const examsWithStatus = exams.map(exam => {
            const examData = exam.toJSON();
            const startTime = new Date(exam.start_time);
            const endTime = new Date(exam.end_time);

            if (now < startTime) {
                examData.status = 'upcoming';
            } else if (now >= startTime && now <= endTime) {
                examData.status = 'ongoing';
            } else {
                examData.status = 'ended';
            }

            return examData;
        });

        return res.status(200).send(examsWithStatus);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get exam detail for student (không lộ đáp án)
export const getExamDetailForStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const student_id = req.userId;

        const exam = await ExamModel.findOne({
            where: { id },
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode'],
                    required: false
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        if (!exam.is_public) {
            return res.status(403).send({
                message: 'This exam is private and only available to the creator'
            });
        }

        if (exam.class_id) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id: exam.class_id,
                    student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of this class. Cannot view this exam.'
                });
            }
        }

        // Thêm thông tin về trạng thái exam
        const now = new Date();
        const examData = exam.toJSON();
        const startTime = new Date(exam.start_time);
        const endTime = new Date(exam.end_time);

        if (now < startTime) {
            examData.status = 'upcoming';
        } else if (now >= startTime && now <= endTime) {
            examData.status = 'ongoing';
        } else {
            examData.status = 'ended';
        }

        return res.status(200).send(examData);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};
