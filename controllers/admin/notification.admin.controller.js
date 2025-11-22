import { NotificationModel, UserModel } from "../../models/index.model.js";
import { Op } from "sequelize";

// ==================== NOTIFICATION MANAGEMENT ====================

export const broadcastNotification = async (req, res) => {
    try {
        const { title, message, target_type, target_role, user_ids, priority = 'medium', link } = req.body;
        
        // Validation
        if (!title || !message || !target_type) {
            return res.status(400).json({
                success: false,
                message: "Title, message, and target_type are required"
            });
        }
        
        if (!['all', 'role', 'specific_users'].includes(target_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid target_type. Must be: all, role, or specific_users"
            });
        }
        
        // Get target users
        let targetUsers = [];
        
        if (target_type === 'all') {
            targetUsers = await UserModel.findAll({ attributes: ['id'] });
        } else if (target_type === 'role') {
            if (!target_role) {
                return res.status(400).json({
                    success: false,
                    message: "target_role is required when target_type is 'role'"
                });
            }
            targetUsers = await UserModel.findAll({ 
                where: { role: target_role },
                attributes: ['id'] 
            });
        } else if (target_type === 'specific_users') {
            if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "user_ids array is required when target_type is 'specific_users'"
                });
            }
            targetUsers = await UserModel.findAll({ 
                where: { id: { [Op.in]: user_ids } },
                attributes: ['id'] 
            });
        }
        
        if (targetUsers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No users found matching the criteria"
            });
        }
        
        // Create notifications for all target users
        const notifications = targetUsers.map(user => ({
            recipient_id: user.id,
            type: 'admin_broadcast',
            title,
            message,
            data: link ? JSON.stringify({ link }) : null,
            priority,
            is_read: false
        }));
        
        const createdNotifications = await NotificationModel.bulkCreate(notifications);
        
        return res.status(201).json({
            success: true,
            message: "Notifications sent successfully",
            data: {
                notificationsSent: createdNotifications.length,
                targetType: target_type,
                targetRole: target_role || null,
                notificationIds: createdNotifications.map(n => n.id)
            }
        });
        
    } catch (error) {
        console.error("Error broadcasting notification:", error);
        return res.status(500).json({
            success: false,
            message: "Error broadcasting notification",
            error: error.message
        });
    }
};

export const getNotificationHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, date_from, date_to } = req.query;
        
        const offset = (page - 1) * limit;
        
        const whereClause = {
            type: 'admin_broadcast'
        };
        
        if (date_from || date_to) {
            whereClause.created_at = {};
            if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
        }
        
        const { count, rows } = await NotificationModel.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: UserModel,
                    as: 'recipient',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        return res.status(200).json({
            success: true,
            data: {
                notifications: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting notification history:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting notification history",
            error: error.message
        });
    }
};

