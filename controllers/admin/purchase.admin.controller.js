import { ExamPurchaseModel, ExamModel, UserModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== PURCHASE MANAGEMENT ====================

export const getAllPurchases = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            user_id,
            exam_id,
            date_from,
            date_to,
            sortBy = 'purchase_date',
            order = 'DESC'
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        // Build where clause
        const whereClause = {};
        
        if (user_id) whereClause.user_id = user_id;
        if (exam_id) whereClause.exam_id = exam_id;
        
        if (date_from || date_to) {
            whereClause.purchase_date = {};
            if (date_from) whereClause.purchase_date[Op.gte] = new Date(date_from);
            if (date_to) whereClause.purchase_date[Op.lte] = new Date(date_to);
        }
        
        const { count, rows } = await ExamPurchaseModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee', 'is_paid'],
                    include: [{
                        model: UserModel,
                        as: 'creator',
                        attributes: ['id', 'fullName', 'email']
                    }]
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Calculate summary
        const totalRevenue = await ExamPurchaseModel.sum('purchase_price', { where: whereClause });
        
        return res.status(200).json({
            success: true,
            data: {
                purchases: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                },
                summary: {
                    totalPurchases: count,
                    totalRevenue: totalRevenue ? parseFloat(totalRevenue).toFixed(2) : 0,
                    avgPurchaseValue: count > 0 ? (parseFloat(totalRevenue) / count).toFixed(2) : 0
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting purchases:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting purchases",
            error: error.message
        });
    }
};

export const getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const purchase = await ExamPurchaseModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title', 'fee', 'is_paid', 'created_by'],
                    include: [{
                        model: UserModel,
                        as: 'creator',
                        attributes: ['id', 'fullName', 'email']
                    }]
                }
            ]
        });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: purchase
        });
        
    } catch (error) {
        console.error("Error getting purchase:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting purchase details",
            error: error.message
        });
    }
};

export const refundPurchase = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { reason, amount } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Refund reason is required"
            });
        }
        
        const purchase = await ExamPurchaseModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user'
                },
                {
                    model: ExamModel,
                    as: 'exam'
                }
            ]
        });
        
        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }
        
        // Determine refund amount (full or partial)
        const refundAmount = amount ? parseFloat(amount) : parseFloat(purchase.purchase_price);
        
        if (refundAmount > parseFloat(purchase.purchase_price)) {
            return res.status(400).json({
                success: false,
                message: "Refund amount cannot exceed purchase price"
            });
        }
        
        // Refund to user balance
        const user = purchase.user;
        user.balance = parseFloat(user.balance) + refundAmount;
        await user.save({ transaction });
        
        // Delete purchase record
        await purchase.destroy({ transaction });
        
        await transaction.commit();
        
        // TODO: Create transaction log for audit
        
        return res.status(200).json({
            success: true,
            message: "Refund processed successfully",
            data: {
                refundAmount: refundAmount,
                newBalance: parseFloat(user.balance),
                reason,
                purchaseInfo: {
                    exam: purchase.exam.title,
                    originalPrice: parseFloat(purchase.purchase_price)
                }
            }
        });
        
    } catch (error) {
        await transaction.rollback();
        console.error("Error processing refund:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing refund",
            error: error.message
        });
    }
};

export const getTransactionHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            user_id,
            type = 'purchase', // purchase, refund, adjustment
            date_from,
            date_to
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        // For now, we only have purchases. In future, you should create a Transaction table
        const whereClause = {};
        
        if (user_id) whereClause.user_id = user_id;
        
        if (date_from || date_to) {
            whereClause.purchase_date = {};
            if (date_from) whereClause.purchase_date[Op.gte] = new Date(date_from);
            if (date_to) whereClause.purchase_date[Op.lte] = new Date(date_to);
        }
        
        const { count, rows } = await ExamPurchaseModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: ExamModel,
                    as: 'exam',
                    attributes: ['id', 'title']
                }
            ],
            order: [['purchase_date', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Transform to transaction format
        const transactions = rows.map(purchase => ({
            id: purchase.id,
            type: 'purchase',
            amount: parseFloat(purchase.purchase_price),
            date: purchase.purchase_date,
            user: purchase.user,
            description: `Purchase: ${purchase.exam.title}`,
            exam: purchase.exam
        }));
        
        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting transaction history:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting transaction history",
            error: error.message
        });
    }
};

