import { UserModel, ClassesModel, ExamModel, ExamPurchaseModel, ExamSessionModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== DASHBOARD ====================

export const getDashboard = async (req, res) => {
    try {
        // Get summary statistics
        const totalUsers = await UserModel.count();
        const totalStudents = await UserModel.count({ where: { role: 'student' } });
        const totalTeachers = await UserModel.count({ where: { role: 'teacher' } });
        const totalAdmins = await UserModel.count({ where: { role: 'admin' } });
        
        const totalClasses = await ClassesModel.count();
        const totalExams = await ExamModel.count();
        const freeExams = await ExamModel.count({ where: { is_paid: false } });
        const paidExams = await ExamModel.count({ where: { is_paid: true } });
        
        const totalRevenue = await ExamPurchaseModel.sum('purchase_price') || 0;
        const totalPurchases = await ExamPurchaseModel.count();
        
        // Active sessions now
        const activeSessions = await ExamSessionModel.count({
            where: { status: 'in_progress' }
        });
        
        // Get recent registrations (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentUsers = await UserModel.count({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            }
        });
        
        // Daily statistics (last 30 days by day)
        const newUsers = await UserModel.findAll({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        const newExams = await ExamModel.findAll({
            where: {
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('created_at'))],
            order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        const examSessions = await ExamSessionModel.findAll({
            where: {
                start_time: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            attributes: [
                [sequelize.fn('DATE', sequelize.col('start_time')), 'date'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: [sequelize.fn('DATE', sequelize.col('start_time'))],
            order: [[sequelize.fn('DATE', sequelize.col('start_time')), 'ASC']],
            raw: true
        });
        
        // Merge all daily stats by date
        const dailyStatsMap = {};
        
        newUsers.forEach(item => {
            if (!dailyStatsMap[item.date]) {
                dailyStatsMap[item.date] = { date: item.date, newUsers: 0, newExams: 0, examSessions: 0 };
            }
            dailyStatsMap[item.date].newUsers = parseInt(item.count);
        });
        
        newExams.forEach(item => {
            if (!dailyStatsMap[item.date]) {
                dailyStatsMap[item.date] = { date: item.date, newUsers: 0, newExams: 0, examSessions: 0 };
            }
            dailyStatsMap[item.date].newExams = parseInt(item.count);
        });
        
        examSessions.forEach(item => {
            if (!dailyStatsMap[item.date]) {
                dailyStatsMap[item.date] = { date: item.date, newUsers: 0, newExams: 0, examSessions: 0 };
            }
            dailyStatsMap[item.date].examSessions = parseInt(item.count);
        });
        
        const dailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));
        
        // Get popular exams (most purchases)
        const popularExams = await ExamModel.findAll({
            where: { is_paid: true },
            include: [
                {
                    model: ExamPurchaseModel,
                    as: 'purchases',
                    attributes: []
                },
                {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            attributes: [
                'id', 'title', 'fee',
                [sequelize.fn('COUNT', sequelize.col('purchases.id')), 'purchase_count']
            ],
            group: ['Exams.id', 'creator.id'],
            order: [[sequelize.fn('COUNT', sequelize.col('purchases.id')), 'DESC']],
            limit: 10,
            subQuery: false
        });
        
        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    totalStudents,
                    totalTeachers,
                    totalAdmins,
                    totalClasses,
                    totalExams,
                    freeExams,
                    paidExams,
                    totalRevenue: parseFloat(totalRevenue).toFixed(2),
                    totalPurchases,
                    recentUsers,
                    activeSessions
                },
                charts: {
                    dailyStats
                },
                popularExams
            }
        });
        
    } catch (error) {
        console.error("Error getting dashboard:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting dashboard data",
            error: error.message
        });
    }
};

