import { QuestionModel, ExamModel, QuestionAnswerModel } from "../models/index.model.js";

// Create question
export const createQuestion = async (req, res) => {
    try {
        const {
            exam_id,
            question_text,
            image_url,
            type,
            difficulty,
            answers // Array of answers: [{text, is_correct}]
        } = req.body;

        const teacher_id = req.userId; // Get from middleware

        // Validate required fields
        if (!exam_id || !question_text) {
            return res.status(400).send({ 
                message: 'Missing required fields: exam_id, question_text' 
            });
        }

        // Validate that the exam exists and belongs to the teacher
        const exam = await ExamModel.findOne({
            where: {
                id: exam_id,
                created_by: teacher_id
            }
        });

        if (!exam) {
            return res.status(404).send({ 
                message: 'Exam not found or you do not have permission to create question for this exam' 
            });
        }

        // Validate answers if provided
        if (answers && Array.isArray(answers)) {
            if (answers.length === 0) {
                return res.status(400).send({ 
                    message: 'At least one answer is required' 
                });
            }
            
            // Check if at least one answer is correct
            const hasCorrectAnswer = answers.some(answer => answer.is_correct === true);
            if (!hasCorrectAnswer) {
                return res.status(400).send({ 
                    message: 'At least one answer must be marked as correct' 
                });
            }
        }

        // Create question
        const question = await QuestionModel.create({
            teacher_id,
            exam_id,
            question_text,
            image_url: image_url || null,
            type: type || 'multiple_choice',
            difficulty: difficulty || 'medium'
        });

        // Create answers if provided
        if (answers && Array.isArray(answers) && answers.length > 0) {
            const answerPromises = answers.map(answer => 
                QuestionAnswerModel.create({
                    question_id: question.id,
                    text: answer.text,
                    is_correct: answer.is_correct || false
                })
            );
            await Promise.all(answerPromises);
        }

        // Return question with answers
        const questionWithAnswers = await QuestionModel.findOne({
            where: { id: question.id },
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct', 'created_at', 'updated_at']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                }
            ]
        });

        return res.status(201).send(questionWithAnswers);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get question by ID
export const getQuestionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const role = req.role;

        const question = await QuestionModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct', 'created_at', 'updated_at']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'created_by']
                }
            ]
        });

        if (!question) {
            return res.status(404).send({ message: 'Question not found' });
        }

        // Teacher can only see their own questions
        if (role === 'teacher' && question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to view this question' 
            });
        }

        return res.status(200).send(question);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all questions (by exam or all for teacher)
export const getQuestions = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.role;
        const { exam_id } = req.query;

        let whereCondition = {};

        if (role === 'teacher') {
            // Teacher can only see questions they created
            whereCondition.teacher_id = userId;
            
            // Filter by exam if provided
            if (exam_id) {
                whereCondition.exam_id = exam_id;
            }
        }

        const questions = await QuestionModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct', 'created_at', 'updated_at']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).send(questions);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Update question
export const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const {
            question_text,
            image_url,
            type,
            difficulty
        } = req.body;

        // Find question
        const question = await QuestionModel.findOne({
            where: { id }
        });

        if (!question) {
            return res.status(404).send({ message: 'Question not found' });
        }

        // Check if user is the creator
        if (question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to update this question' 
            });
        }

        // Update question
        const updateData = {};
        if (question_text !== undefined) updateData.question_text = question_text;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (type !== undefined) updateData.type = type;
        if (difficulty !== undefined) updateData.difficulty = difficulty;

        await question.update(updateData);

        // Return updated question with answers
        const updatedQuestion = await QuestionModel.findOne({
            where: { id },
            include: [
                {
                    model: QuestionAnswerModel,
                    as: 'answers',
                    attributes: ['id', 'text', 'is_correct', 'created_at', 'updated_at']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                }
            ]
        });

        return res.status(200).send(updatedQuestion);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Delete question
export const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Find question
        const question = await QuestionModel.findOne({
            where: { id }
        });

        if (!question) {
            return res.status(404).send({ message: 'Question not found' });
        }

        // Check if user is the creator
        if (question.teacher_id !== userId) {
            return res.status(403).send({ 
                message: 'You do not have permission to delete this question' 
            });
        }

        // Delete all answers first (cascade delete)
        await QuestionAnswerModel.destroy({
            where: { question_id: id }
        });

        // Delete question
        await question.destroy();

        return res.status(200).send({ 
            message: 'Question deleted successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

