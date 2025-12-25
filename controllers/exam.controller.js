import { ExamModel, ClassesModel, ClassStudentModel, QuestionModel, QuestionAnswerModel, StudentAnswerModel, ExamRatingModel, UserModel } from "../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../config/db.config.js";
import { notifyExamAssignedToClass } from "../services/notification.service.js";

const ALLOWED_QUESTION_METHODS = ['text', 'editor'];

function normalizeQuestionMethod(value) {
    if (!value) return null;
    return ALLOWED_QUESTION_METHODS.includes(value) ? value : null;
}

// Helper function để tính average rating của exam
async function getExamAverageRating(examId) {
    try {
        const result = await ExamRatingModel.findOne({
            where: { exam_id: examId },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('rating')), 'average_rating'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_ratings']
            ],
            raw: true
        });

        const averageRating = result ? parseFloat(result.average_rating) || 0 : 0;
        const totalRatings = result ? parseInt(result.total_ratings) || 0 : 0;

        return {
            average_rating: parseFloat(averageRating.toFixed(2)),
            total_ratings: totalRatings
        };
    } catch (error) {
        console.error('Error calculating average rating:', error);
        return {
            average_rating: 0,
            total_ratings: 0
        };
    }
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
            question_creation_method,
            image_url
        } = req.body;

        const created_by = req.userId; // Get from middleware

        // Validate required fields
        if (!title || !minutes) {
            return res.status(400).send({ 
                message: 'Missing required fields: title, minutes' 
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

        // Validate dates nếu có (cho phép null khi không giới hạn thời gian)
        let startDate = null;
        let endDate = null;
        
        if (start_time && end_time) {
            startDate = new Date(start_time);
            endDate = new Date(end_time);

            if (startDate >= endDate) {
                return res.status(400).send({ 
                    message: 'End time must be after start time' 
                });
            }
        } else if (start_time || end_time) {
            // Nếu chỉ có một trong hai, không hợp lệ
            return res.status(400).send({ 
                message: 'Both start_time and end_time must be provided together, or both can be null for unlimited time' 
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
            start_time: startDate, // Có thể null
            end_time: endDate, // Có thể null
            is_paid: is_paid || false,
            fee: is_paid ? fee : 0,
            created_by,
            is_public: is_public || false,
            count: 0,
            question_creation_method: normalizedQuestionMethod,
            image_url: image_url || null
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

// Get exam by ID (merged for both teacher and student with role-based logic)
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
                    attributes: ['id', 'className', 'classCode'],
                    required: false
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Lấy số câu hỏi
        const questionCount = await QuestionModel.count({
            where: { exam_id: id }
        });

        if (role === 'teacher') {
            // Teacher can only see their own exams
            if (exam.created_by !== userId) {
                return res.status(403).send({ 
                    message: 'You do not have permission to view this exam' 
                });
            }

            const examData = exam.toJSON();
            examData.question_count = questionCount;
            
            // Thêm average rating
            const ratingInfo = await getExamAverageRating(id);
            examData.average_rating = ratingInfo.average_rating;
            examData.total_ratings = ratingInfo.total_ratings;
            
            return res.status(200).send(examData);
        } else if (role === 'student') {
            // Student logic: check if exam is public and accessible
            const student_id = userId;

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
            examData.question_count = questionCount;
            
            // Thêm average rating
            const ratingInfo = await getExamAverageRating(id);
            examData.average_rating = ratingInfo.average_rating;
            examData.total_ratings = ratingInfo.total_ratings;
            
            // Xử lý trường hợp không giới hạn thời gian
            if (!exam.start_time || !exam.end_time) {
                examData.status = 'unlimited'; // Không giới hạn thời gian
            } else {
                const startTime = new Date(exam.start_time);
                const endTime = new Date(exam.end_time);

                if (now < startTime) {
                    examData.status = 'upcoming';
                } else if (now >= startTime && now <= endTime) {
                    examData.status = 'ongoing';
                } else {
                    examData.status = 'ended';
                }
            }

            return res.status(200).send(examData);
        } else {
            return res.status(403).send({ 
                message: 'Invalid role. Only teacher and student can access exams.' 
            });
        }

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all exams (merged for both teacher and student with role-based logic)
export const getExams = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const { class_id } = req.query;

        if (role === 'teacher') {
            // Teacher can only see exams they created
            let whereCondition = {
                created_by: userId
            };
            
            // Filter by class if provided
            if (class_id) {
                whereCondition.class_id = class_id;
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

            // Thêm số câu hỏi và average rating cho mỗi exam
            const examsWithQuestionCount = await Promise.all(
                exams.map(async (exam) => {
                    const examData = exam.toJSON();
                    const questionCount = await QuestionModel.count({
                        where: { exam_id: exam.id }
                    });
                    examData.question_count = questionCount;
                    
                    // Thêm average rating
                    const ratingInfo = await getExamAverageRating(exam.id);
                    examData.average_rating = ratingInfo.average_rating;
                    examData.total_ratings = ratingInfo.total_ratings;
                    
                    return examData;
                })
            );

            return res.status(200).send(examsWithQuestionCount);
        } else if (role === 'student') {
            // Student logic: public exams + exams in student's classes
            const student_id = userId;

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

            // Thêm thông tin về trạng thái exam, số câu hỏi và average rating
            const now = new Date();
            const examsWithStatus = await Promise.all(
                exams.map(async (exam) => {
                    const examData = exam.toJSON();
                    
                    // Thêm số câu hỏi
                    const questionCount = await QuestionModel.count({
                        where: { exam_id: exam.id }
                    });
                    examData.question_count = questionCount;
                    
                    // Thêm average rating
                    const ratingInfo = await getExamAverageRating(exam.id);
                    examData.average_rating = ratingInfo.average_rating;
                    examData.total_ratings = ratingInfo.total_ratings;
                    
                    // Xử lý trường hợp không giới hạn thời gian
                    if (!exam.start_time || !exam.end_time) {
                        examData.status = 'unlimited'; // Không giới hạn thời gian
                    } else {
                        const startTime = new Date(exam.start_time);
                        const endTime = new Date(exam.end_time);

                        if (now < startTime) {
                            examData.status = 'upcoming';
                        } else if (now >= startTime && now <= endTime) {
                            examData.status = 'ongoing';
                        } else {
                            examData.status = 'ended';
                        }
                    }

                    return examData;
                })
            );

            return res.status(200).send(examsWithStatus);
        } else {
            return res.status(403).send({ 
                message: 'Invalid role. Only teacher and student can access exams.' 
            });
        }

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
            question_creation_method,
            image_url
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
        if (start_time !== undefined || end_time !== undefined) {
            // Nếu cả hai đều null, cho phép (không giới hạn thời gian)
            if (start_time === null && end_time === null) {
                // OK - không giới hạn thời gian
            } else if (start_time && end_time) {
                // Cả hai đều có giá trị, kiểm tra hợp lệ
                const startDate = new Date(start_time);
                const endDate = new Date(end_time);

                if (startDate >= endDate) {
                    return res.status(400).send({ 
                        message: 'End time must be after start time' 
                    });
                }
            } else if (start_time === null || end_time === null) {
                // Chỉ một trong hai null, không hợp lệ
                return res.status(400).send({ 
                    message: 'Both start_time and end_time must be provided together, or both can be null for unlimited time' 
                });
            } else {
                // Một trong hai được cung cấp, lấy giá trị từ exam hiện tại cho giá trị còn lại
                const startDate = start_time ? new Date(start_time) : (exam.start_time ? new Date(exam.start_time) : null);
                const endDate = end_time ? new Date(end_time) : (exam.end_time ? new Date(exam.end_time) : null);
                
                if (startDate && endDate && startDate >= endDate) {
                    return res.status(400).send({ 
                        message: 'End time must be after start time' 
                    });
                }
            }
        }

        // Validate fee if is_paid is true
        // Chỉ validate fee khi:
        // 1. is_paid được gửi trong request và là true, HOẶC
        // 2. is_paid không được gửi nhưng exam hiện tại có is_paid = true VÀ fee được gửi trong request
        // Nếu chỉ update các field khác (như question_creation_method) mà không gửi fee, thì không validate fee
        if (is_paid !== undefined && is_paid === true) {
            // Nếu is_paid được set thành true trong request, fee phải được gửi và hợp lệ
            if (fee === undefined || fee === null || fee <= 0) {
                return res.status(400).send({ 
                    message: 'Fee is required when is_paid is true' 
                });
            }
        } else if (is_paid === undefined && exam.is_paid === true && fee !== undefined) {
            // Nếu exam hiện tại có is_paid = true và fee được gửi trong request, validate fee
            if (fee === null || fee <= 0) {
                return res.status(400).send({ 
                    message: 'Fee must be greater than 0 when is_paid is true' 
                });
            }
        }
        // Nếu không gửi fee và không set is_paid = true, không validate (giữ nguyên fee hiện tại)

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
        if (start_time !== undefined) updateData.start_time = start_time === null ? null : new Date(start_time);
        if (end_time !== undefined) updateData.end_time = end_time === null ? null : new Date(end_time);
        if (is_paid !== undefined) updateData.is_paid = is_paid;
        if (fee !== undefined) {
            // Nếu is_paid được set, dùng giá trị đó, nếu không dùng giá trị hiện tại của exam
            const finalIsPaid = is_paid !== undefined ? is_paid : exam.is_paid;
            updateData.fee = finalIsPaid ? fee : 0;
        }
        if (is_public !== undefined) updateData.is_public = is_public;
        if (question_creation_method !== undefined && normalizedQuestionMethodValue !== undefined) {
            updateData.question_creation_method = normalizedQuestionMethodValue;
        }
        if (image_url !== undefined) updateData.image_url = image_url || null;

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
            
            // Xử lý trường hợp không giới hạn thời gian
            if (!exam.start_time || !exam.end_time) {
                examData.status = 'unlimited'; // Không giới hạn thời gian
            } else {
                const startTime = new Date(exam.start_time);
                const endTime = new Date(exam.end_time);

                if (now < startTime) {
                    examData.status = 'upcoming';
                } else if (now >= startTime && now <= endTime) {
                    examData.status = 'ongoing';
                } else {
                    examData.status = 'ended';
                }
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
        
        // Xử lý trường hợp không giới hạn thời gian
        if (!exam.start_time || !exam.end_time) {
            examData.status = 'unlimited'; // Không giới hạn thời gian
        } else {
            const startTime = new Date(exam.start_time);
            const endTime = new Date(exam.end_time);

            if (now < startTime) {
                examData.status = 'upcoming';
            } else if (now >= startTime && now <= endTime) {
                examData.status = 'ongoing';
            } else {
                examData.status = 'ended';
            }
        }

        return res.status(200).send(examData);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get similar exams (cùng class, cùng chủ đề, hoặc tên liên quan)
export const getSimilarExams = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;
        const limit = parseInt(req.query.limit) || 6;

        // Lấy thông tin exam hiện tại
        const currentExam = await ExamModel.findOne({
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

        if (!currentExam) {
            return res.status(404).send({ message: 'Exam not found' });
        }

        // Kiểm tra quyền truy cập
        if (role === 'teacher' && currentExam.created_by !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to view this exam' 
            });
        } else if (role === 'student') {
            if (!currentExam.is_public) {
                return res.status(403).send({
                    message: 'This exam is private and only available to the creator'
                });
            }

            if (currentExam.class_id) {
                const isMember = await ClassStudentModel.findOne({
                    where: {
                        class_id: currentExam.class_id,
                        student_id: userId
                    }
                });

                if (!isMember) {
                    return res.status(403).send({
                        message: 'You are not a member of this class. Cannot view this exam.'
                    });
                }
            }
        }

        // Xây dựng điều kiện tìm kiếm bài thi tương tự
        const orConditions = [];

        // 1. Cùng class_id (nếu có)
        if (currentExam.class_id) {
            orConditions.push({
                class_id: currentExam.class_id,
                id: { [Op.ne]: id } // Loại trừ exam hiện tại
            });
        }

        // 2. Tên tương tự (tìm các từ khóa trong title)
        const titleWords = currentExam.title.split(/\s+/).filter(word => word.length > 2);
        if (titleWords.length > 0) {
            orConditions.push({
                title: {
                    [Op.or]: titleWords.map(word => ({
                        [Op.like]: `%${word}%`
                    }))
                },
                id: { [Op.ne]: id }
            });
        }

        // 3. Cùng created_by (các bài thi khác của cùng giáo viên)
        orConditions.push({
            created_by: currentExam.created_by,
            id: { [Op.ne]: id }
        });

        let whereCondition = {};

        // Thêm điều kiện cho student (chỉ lấy public exams)
        if (role === 'student') {
            // Lấy danh sách class_id mà student đã join
            const studentClasses = await ClassStudentModel.findAll({
                where: { student_id: userId },
                attributes: ['class_id']
            });
            const studentClassIds = studentClasses.map(sc => sc.class_id);

            const studentOrConditions = [
                { is_public: true, class_id: null }
            ];

            if (studentClassIds.length > 0) {
                studentOrConditions.push({
                    is_public: true,
                    class_id: { [Op.in]: studentClassIds }
                });
            }

            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: studentOrConditions
                    },
                    {
                        [Op.or]: orConditions
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        } else if (role === 'teacher') {
            // Teacher chỉ thấy các exam của mình
            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: orConditions
                    },
                    {
                        created_by: userId
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        } else {
            whereCondition = {
                [Op.and]: [
                    {
                        [Op.or]: orConditions
                    },
                    {
                        id: { [Op.ne]: id }
                    }
                ]
            };
        }

        const similarExams = await ExamModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode'],
                    required: false
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ],
            order: [
                // Ưu tiên cùng class, sau đó cùng title, sau đó cùng creator
                ['class_id', currentExam.class_id ? 'ASC' : 'DESC'],
                ['created_at', 'DESC']
            ],
            limit: limit
        });

        // Thêm số câu hỏi, status và average rating cho mỗi exam
        const now = new Date();
        const examsWithDetails = await Promise.all(
            similarExams.map(async (exam) => {
                const examData = exam.toJSON();
                
                // Thêm số câu hỏi
                const questionCount = await QuestionModel.count({
                    where: { exam_id: exam.id }
                });
                examData.question_count = questionCount;
                
                // Thêm average rating
                const ratingInfo = await getExamAverageRating(exam.id);
                examData.average_rating = ratingInfo.average_rating;
                examData.total_ratings = ratingInfo.total_ratings;
                
                // Thêm status
                if (!exam.start_time || !exam.end_time) {
                    examData.status = 'unlimited';
                } else {
                    const startTime = new Date(exam.start_time);
                    const endTime = new Date(exam.end_time);

                    if (now < startTime) {
                        examData.status = 'upcoming';
                    } else if (now >= startTime && now <= endTime) {
                        examData.status = 'ongoing';
                    } else {
                        examData.status = 'ended';
                    }
                }

                return examData;
            })
        );

        // Chỉ lọc các bài thi đang diễn ra (ongoing) và không giới hạn (unlimited)
        const filteredExams = examsWithDetails.filter(exam => 
            exam.status === 'ongoing' || exam.status === 'unlimited'
        );

        return res.status(200).send(filteredExams);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};
