import { ExamSessionModel, ExamModel, UserModel, ClassesModel, ClassStudentModel, QuestionModel, QuestionAnswerModel, ExamPurchaseModel } from "../models/index.model.js";
import { genCode } from "../utils/generateClassCode.js";
import { finalizeSessionResult } from "../services/exam_result.service.js";
import { updateStatusOnStart } from "../services/student_exam_status.service.js";
import sequelize from "../config/db.config.js";

// Bắt đầu bài thi (Tạo exam session)
export const startExam = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const student_id = req.userId;

        // Kiểm tra exam có tồn tại không
        const exam = await ExamModel.findOne({
            where: { id: exam_id },
            include: [
                {
                    model: ClassesModel,
                    as: 'class',
                    attributes: ['id', 'className', 'classCode']
                }
            ]
        });

        if (!exam) {
            return res.status(404).send({
                message: 'Exam not found'
            });
        }

        // Định nghĩa now ở đây để dùng cho toàn bộ hàm
        const now = new Date();

        // Kiểm tra thời gian bài thi có hợp lệ không (chỉ khi có giới hạn thời gian)
        if (exam.start_time && exam.end_time) {
            const examStartTime = new Date(exam.start_time);
            const examEndTime = new Date(exam.end_time);

            if (now < examStartTime) {
                return res.status(400).send({
                    message: 'Bài thi chưa bắt đầu'
                });
            }

            if (now > examEndTime) {
                return res.status(400).send({
                    message: 'Bài thi đã kết thúc'
                });
            }
        }
        // Nếu không có start_time và end_time (null), không kiểm tra thời gian (không giới hạn)

        // Kiểm tra trạng thái public/private
        if (!exam.is_public) {
            return res.status(403).send({
                message: 'This exam is private and cannot be accessed by students'
            });
        }

        // Kiểm tra nếu exam thuộc class, student phải là thành viên của class
        if (exam.class_id) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id: exam.class_id,
                    student_id: student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of this class. Cannot take this exam.'
                });
            }
        } else if (!exam.is_public) {
            // Nếu exam không thuộc class và không public, không cho phép
            return res.status(403).send({
                message: 'This exam is not available for you'
            });
        }

        // Kiểm tra xem student đã bắt đầu exam session chưa
        const existingSession = await ExamSessionModel.findOne({
            where: {
                exam_id: exam_id,
                student_id: student_id,
                status: 'in_progress'
            }
        });

        if (existingSession) {
            // Kiểm tra xem session còn hợp lệ không (chưa hết thời gian)
            const sessionEndTime = new Date(existingSession.end_time);
            if (now < sessionEndTime) {
                // Nếu có session đang active, trả về session đó (không trừ tiền lại)
                const sessionWithExam = await ExamSessionModel.findOne({
                    where: { id: existingSession.id },
                    include: [
                        {
                            model: ExamModel,
                            as: 'exam',
                            attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                        }
                    ]
                });
                return res.status(200).send({
                    message: 'Exam session already exists',
                    session: sessionWithExam
                });
            } else {
                // Session đã hết hạn, cập nhật status
                await existingSession.update({
                    status: 'expired'
                });
            }
        }

        // Nếu exam là trả phí (is_paid = true), kiểm tra và trừ tiền mỗi lần bắt đầu làm bài
        let transaction = null;
        if (exam.is_paid) {
            const user = await UserModel.findOne({ where: { id: student_id } });
            console.log(transaction)

            if (!user) {
                return res.status(404).send({
                    message: 'User not found'
                });
            }

            // Kiểm tra balance
            const userBalance = parseFloat(user.balance || 0);
            console.log(userBalance)
            const examFee = parseFloat(exam.fee || 0);

            if (userBalance < examFee) {
                return res.status(400).send({
                    message: 'Insufficient balance to take this exam',
                    currentBalance: userBalance,
                    requiredAmount: examFee
                });
            }

            // Bắt đầu transaction để đảm bảo tính nhất quán
            transaction = await sequelize.transaction();

            try {
                // Trừ tiền từ balance
                const newBalance = userBalance - examFee;
                console.log(newBalance)
                await user.update({
                    balance: newBalance
                }, { transaction });

                // Tạo bản ghi purchase để tracking (pay-per-attempt)
                await ExamPurchaseModel.create({
                    user_id: student_id,
                    exam_id: exam_id,
                    purchase_price: examFee
                }, { transaction });

                await transaction.commit();
                transaction = null;
            } catch (paymentError) {
                if (transaction) await transaction.rollback();

                // Log the specific validation details
                if (paymentError.name === 'SequelizeValidationError') {
                    console.error("Validation Details:", paymentError.errors.map(e => ({
                        field: e.path,
                        message: e.message,
                        value: e.value
                    })));
                } else {
                    console.error("General Error:", paymentError);
                }

                return res.status(500).send({
                    message: 'Error processing payment for exam',
                    error: paymentError.message,
                    details: paymentError.errors ? paymentError.errors.map(e => e.message) : null
                });
            }
        }

        // Kiểm tra lại existingSession một lần nữa để tránh race condition
        // (nếu có 2 request cùng lúc, cả 2 đều có thể không thấy session ở lần kiểm tra đầu)
        const doubleCheckSession = await ExamSessionModel.findOne({
            where: {
                exam_id: exam_id,
                student_id: student_id,
                status: 'in_progress'
            }
        });

        if (doubleCheckSession) {
            // Kiểm tra xem session còn hợp lệ không (chưa hết thời gian)
            const sessionEndTime = new Date(doubleCheckSession.end_time);
            if (now < sessionEndTime) {
                // Nếu có session đang active, trả về session đó (không trừ tiền lại)
                const sessionWithExam = await ExamSessionModel.findOne({
                    where: { id: doubleCheckSession.id },
                    include: [
                        {
                            model: ExamModel,
                            as: 'exam',
                            attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                        }
                    ]
                });
                return res.status(200).send({
                    message: 'Exam session already exists',
                    session: sessionWithExam
                });
            } else {
                // Session đã hết hạn, cập nhật status
                await doubleCheckSession.update({
                    status: 'expired'
                });
            }
        }

        // Tạo exam session mới
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + exam.minutes * 60000); // Thêm minutes vào start_time

        // Tạo code duy nhất cho session
        let sessionCode;
        let isUnique = false;
        while (!isUnique) {
            sessionCode = genCode(10);
            const codeExists = await ExamSessionModel.findOne({
                where: { code: sessionCode }
            });
            if (!codeExists) {
                isUnique = true;
            }
        }

        const examSession = await ExamSessionModel.create({
            exam_id: exam_id,
            student_id: student_id,
            code: sessionCode,
            start_time: startTime,
            end_time: endTime,
            status: 'in_progress',
            total_score: null,
            submitted_at: null
        });

        // Cập nhật count của exam (số lượt tham gia)
        await exam.increment('count');

        // Cập nhật status tracking
        try {
            await updateStatusOnStart(student_id, exam_id, examSession.id);
        } catch (statusError) {
            console.error('Error updating exam status on start:', statusError);
            // Không fail request nếu update status lỗi
        }

        // Trả về exam session với thông tin exam
        const sessionWithExam = await ExamSessionModel.findOne({
            where: { id: examSession.id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                }
            ]
        });

        return res.status(201).send({
            message: 'Exam session started successfully',
            session: sessionWithExam
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy thông tin exam session hiện tại của student
export const getCurrentSession = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const student_id = req.userId;

        const session = await ExamSessionModel.findOne({
            where: {
                exam_id: exam_id,
                student_id: student_id,
                status: 'in_progress'
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({
                message: 'No active exam session found'
            });
        }

        // Kiểm tra xem session còn hợp lệ không
        const now = new Date();
        const sessionEndTime = new Date(session.end_time);

        if (now > sessionEndTime) {
            const { result } = await finalizeSessionResult(session, student_id);
            return res.status(400).send({
                message: 'Phiên làm bài đã hết hạn và đã được tự động nộp',
                result
            });
        }

        return res.status(200).send(session);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Lấy tất cả exam sessions của student
export const getStudentSessions = async (req, res) => {
    try {
        const student_id = req.userId;

        const sessions = await ExamSessionModel.findAll({
            where: {
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time']
                }
            ],
            order: [['start_time', 'DESC']]
        });

        return res.status(200).send(sessions);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

export const getSessionQuestionsForStudent = async (req, res) => {
    try {
        const { session_id } = req.params;
        const student_id = req.userId;

        const session = await ExamSessionModel.findOne({
            where: {
                id: session_id,
                student_id: student_id
            },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'minutes', 'start_time', 'end_time']
                }
            ]
        });

        if (!session) {
            return res.status(404).send({
                message: 'Exam session not found or you do not have permission'
            });
        }

        const now = new Date();
        const exam = session.exam_id ? await ExamModel.findOne({ where: { id: session.exam_id } }) : null;
        if (exam && !exam.is_public) {
            return res.status(403).send({
                message: 'This exam is private and cannot be accessed by students'
            });
        }

        if (exam && exam.class_id) {
            const isMember = await ClassStudentModel.findOne({
                where: {
                    class_id: exam.class_id,
                    student_id: student_id
                }
            });

            if (!isMember) {
                return res.status(403).send({
                    message: 'You are not a member of this class. Cannot access this session.'
                });
            }
        }

        if (now > new Date(session.end_time)) {
            const { result } = await finalizeSessionResult(session, student_id);
            return res.status(400).send({
                message: 'Phiên làm bài đã hết hạn và đã được tự động nộp',
                result
            });
        }

        const questions = await QuestionModel.findAll({
            where: {
                exam_id: session.exam_id
            },
            attributes: ['id', 'question_text', 'type', 'difficulty', 'order', 'image_url'],
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text']
                }
            ],
            order: [['order', 'ASC']]
        });

        const sanitizedQuestions = questions.map(question => ({
            id: question.id,
            question_text: question.question_text,
            type: question.type,
            difficulty: question.difficulty,
            order: question.order,
            image_url: question.image_url,
            answers: question.answers.map(answer => ({
                id: answer.id,
                text: answer.text
            }))
        }));

        return res.status(200).send({
            session: {
                id: session.id,
                exam_id: session.exam_id,
                start_time: session.start_time,
                end_time: session.end_time,
                remaining_time_ms: new Date(session.end_time).getTime() - now.getTime()
            },
            exam: session.exam,
            questions: sanitizedQuestions
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

