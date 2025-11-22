import { UserModel, ExamModel, ExamPurchaseModel, ExamResultModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== REPORTS & ANALYTICS ====================

export const getRevenueReport = async (req, res) => {
    try {
        const { date_from, date_to, group_by = 'day', teacher_id } = req.query;
        
        const whereClause = {};
        
        if (date_from || date_to) {
            whereClause.purchase_date = {};
            if (date_from) whereClause.purchase_date[Op.gte] = new Date(date_from);
            if (date_to) whereClause.purchase_date[Op.lte] = new Date(date_to);
        }
        
        // Total revenue
        const totalRevenue = await ExamPurchaseModel.sum('purchase_price', { where: whereClause }) || 0;
        const totalPurchases = await ExamPurchaseModel.count({ where: whereClause });
        
        // Revenue by period
        let dateFormat;
        switch (group_by) {
            case 'month':
                dateFormat = '%Y-%m';
                break;
            case 'week':
                dateFormat = '%Y-%u';
                break;
            default: // day
                dateFormat = '%Y-%m-%d';
        }
        
        const revenueByPeriod = await ExamPurchaseModel.findAll({
            where: whereClause,
            attributes: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('purchase_date'), dateFormat), 'period'],
                [sequelize.fn('SUM', sequelize.col('purchase_price')), 'revenue'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE_FORMAT', sequelize.col('purchase_date'), dateFormat)],
            order: [[sequelize.fn('DATE_FORMAT', sequelize.col('purchase_date'), dateFormat), 'ASC']],
            raw: true
        });
        
        // Top earning exams
        const topEarningExams = await ExamPurchaseModel.findAll({
            where: whereClause,
            include: [
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee'],
                    include: [{
                        model: UserModel,
                        as: 'creator',
                        attributes: ['id', 'fullName'],
                        where: teacher_id ? { id: teacher_id } : {}
                    }]
                }
            ],
            attributes: [
                'exam_id',
                [sequelize.fn('COUNT', sequelize.col('exam_id')), 'purchase_count'],
                [sequelize.fn('SUM', sequelize.col('purchase_price')), 'total_revenue']
            ],
            group: ['exam_id', 'exam.id', 'exam->creator.id'],
            order: [[sequelize.fn('SUM', sequelize.col('purchase_price')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        // Top spending students
        const topSpendingStudents = await ExamPurchaseModel.findAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            attributes: [
                'user_id',
                [sequelize.fn('COUNT', sequelize.col('user_id')), 'purchase_count'],
                [sequelize.fn('SUM', sequelize.col('purchase_price')), 'total_spent']
            ],
            group: ['user_id', 'user.id'],
            order: [[sequelize.fn('SUM', sequelize.col('purchase_price')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalRevenue: parseFloat(totalRevenue).toFixed(2),
                    totalPurchases,
                    avgPurchaseValue: totalPurchases > 0 ? (parseFloat(totalRevenue) / totalPurchases).toFixed(2) : 0
                },
                revenueByPeriod,
                topEarningExams,
                topSpendingStudents
            }
        });
        
    } catch (error) {
        console.error("Error getting revenue report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting revenue report",
            error: error.message
        });
    }
};

export const getUserActivityReport = async (req, res) => {
    try {
        const { date_from, date_to, role } = req.query;
        
        const whereClause = {};
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
        }
        
        if (role) {
            whereClause.role = role;
        }
        
        // Total users registered
        const totalUsers = await UserModel.count({ where: whereClause });
        
        // New registrations by day
        const registrationsByDay = await UserModel.findAll({
            where: whereClause,
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                'role'
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at')), 'role'],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        // Most active users (by exam submissions)
        const mostActiveUsers = await ExamResultModel.findAll({
            include: [
                {
                    model: UserModel,
                    as: 'student',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            attributes: [
                'student_id',
                [sequelize.fn('COUNT', sequelize.col('student_id')), 'submission_count'],
                [sequelize.fn('AVG', sequelize.col('percentage')), 'avg_score']
            ],
            group: ['student_id', 'student.id'],
            order: [[sequelize.fn('COUNT', sequelize.col('student_id')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    averageUsersPerDay: registrationsByDay.length > 0 ? 
                        (totalUsers / registrationsByDay.length).toFixed(2) : 0
                },
                registrationsByDay,
                mostActiveUsers
            }
        });
        
    } catch (error) {
        console.error("Error getting user activity report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting user activity report",
            error: error.message
        });
    }
};

export const getExamStatsReport = async (req, res) => {
    try {
        const { date_from, date_to, class_id, teacher_id } = req.query;
        
        const whereClause = {};
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
        }
        
        if (class_id) whereClause.class_id = class_id;
        if (teacher_id) whereClause.created_by = teacher_id;
        
        // Total exams created
        const totalExams = await ExamModel.count({ where: whereClause });
        
        // Total submissions
        const totalSubmissions = await ExamResultModel.count({
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }]
        });
        
        // Average score overall
        const avgScoreResult = await ExamResultModel.findOne({
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }],
            attributes: [[sequelize.fn('AVG', sequelize.col('percentage')), 'avgScore']]
        });
        
        // Pass rate (assuming 50% is passing)
        const passedCount = await ExamResultModel.count({
            where: { percentage: { [Op.gte]: 50 } },
            include: [{
                model: ExamModel,
                as: 'exam',
                where: whereClause,
                attributes: []
            }]
        });
        
        const passRate = totalSubmissions > 0 ? ((passedCount / totalSubmissions) * 100).toFixed(2) : 0;
        
        // Exams by status
        const now = new Date();
        const examsByStatus = {
            upcoming: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    start_time: { [Op.gt]: now } 
                } 
            }),
            ongoing: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    start_time: { [Op.lte]: now },
                    end_time: { [Op.gte]: now }
                } 
            }),
            ended: await ExamModel.count({ 
                where: { 
                    ...whereClause, 
                    end_time: { [Op.lt]: now } 
                } 
            })
        };
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalExams,
                    totalSubmissions,
                    avgScoreOverall: avgScoreResult ? parseFloat(avgScoreResult.dataValues.avgScore).toFixed(2) : 0,
                    passRate: parseFloat(passRate)
                },
                examsByStatus
            }
        });
        
    } catch (error) {
        console.error("Error getting exam stats report:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting exam statistics report",
            error: error.message
        });
    }
};

