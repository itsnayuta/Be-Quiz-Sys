import { ExamFavoriteModel, ExamModel, UserModel, ClassesModel } from "../models/index.model.js";

// Add exam to favorites
export const addFavorite = async (req, res) => {
    try {
        const { exam_id } = req.body;
        const user_id = req.userId;

        // Validate required fields
        if (!exam_id) {
            return res.status(400).send({ 
                message: 'Missing required field: exam_id' 
            });
        }

        // Validate exam exists
        const exam = await ExamModel.findOne({
            where: { id: exam_id }
        });

        if (!exam) {
            return res.status(404).send({ 
                message: 'Exam not found' 
            });
        }

        // Check if already favorited
        const existingFavorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        if (existingFavorite) {
            return res.status(400).send({ 
                message: 'Exam already in favorites' 
            });
        }

        // Create favorite
        const favorite = await ExamFavoriteModel.create({
            user_id,
            exam_id
        });

        // Return favorite with exam info
        const favoriteWithExam = await ExamFavoriteModel.findOne({
            where: { id: favorite.id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'is_paid', 'fee', 'is_public']
                }
            ]
        });

        return res.status(201).send(favoriteWithExam);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Remove exam from favorites
export const removeFavorite = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        // Find favorite
        const favorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        if (!favorite) {
            return res.status(404).send({ 
                message: 'Favorite not found' 
            });
        }

        // Delete favorite
        await favorite.destroy();

        return res.status(200).send({ 
            message: 'Exam removed from favorites successfully' 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get all favorite exams for current user
export const getFavorites = async (req, res) => {
    try {
        const user_id = req.userId;

        const favorites = await ExamFavoriteModel.findAll({
            where: { user_id },
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'des', 'total_score', 'minutes', 'start_time', 'end_time', 'is_paid', 'fee', 'is_public', 'created_at'],
                    include: [
                        {
                            model: ClassesModel,
                            as: 'class',
                            attributes: ['id', 'className', 'classCode']
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).send(favorites);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Check if exam is favorited by user
export const checkFavorite = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const user_id = req.userId;

        const favorite = await ExamFavoriteModel.findOne({
            where: {
                user_id,
                exam_id
            }
        });

        return res.status(200).send({ 
            is_favorited: !!favorite 
        });

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

