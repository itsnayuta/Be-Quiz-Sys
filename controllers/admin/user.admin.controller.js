import { UserModel, ClassesModel, ExamModel, ExamPurchaseModel, ExamResultModel } from "../../models/index.model.js";
import { Op } from "sequelize";
import sequelize from "../../config/db.config.js";

// ==================== USER MANAGEMENT ====================

export const getAllUsers = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            role, 
            search, 
            sortBy = 'created_at', 
            order = 'DESC' 
        } = req.query;
        
        const offset = (page - 1) * limit;
        
        // Build where clause
        const whereClause = {};
        
        if (role) {
            whereClause.role = role;
        }
        
        if (search) {
            whereClause[Op.or] = [
                { fullName: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ];
        }
        
        const { count, rows } = await UserModel.findAndCountAll({
            where: whereClause,
            attributes: ['id', 'fullName', 'email', 'role', 'balance', 'created_at', 'last_login'],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        return res.status(200).json({
            success: true,
            data: {
                users: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("Error getting users:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting users",
            error: error.message
        });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await UserModel.findByPk(id, {
            attributes: { exclude: ['password'] }
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Get additional statistics based on role
        let statistics = {};
        
        if (user.role === 'teacher') {
            const classCount = await ClassesModel.count({ where: { teacher_id: id } });
            const examCount = await ExamModel.count({ where: { created_by: id } });
            
            statistics = {
                totalClasses: classCount,
                totalExams: examCount
            };
        } else if (user.role === 'student') {
            const purchaseCount = await ExamPurchaseModel.count({ where: { user_id: id } });
            const totalSpent = await ExamPurchaseModel.sum('purchase_price', { where: { user_id: id } }) || 0;
            const examsTaken = await ExamResultModel.count({ where: { student_id: id } });
            
            const avgScore = await ExamResultModel.findOne({
                where: { student_id: id },
                attributes: [[sequelize.fn('AVG', sequelize.col('percentage')), 'avgScore']]
            });
            
            statistics = {
                purchaseCount,
                totalSpent: parseFloat(totalSpent).toFixed(2),
                examsTaken,
                avgScore: avgScore ? parseFloat(avgScore.dataValues.avgScore).toFixed(2) : 0
            };
        }
        
        return res.status(200).json({
            success: true,
            data: {
                user,
                statistics
            }
        });
        
    } catch (error) {
        console.error("Error getting user:", error);
        return res.status(500).json({
            success: false,
            message: "Error getting user details",
            error: error.message
        });
    }
};

export const createUser = async (req, res) => {
    try {
        const { fullName, email, password, role, balance } = req.body;
        
        // Validation
        if (!fullName || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }
        
        if (!['student', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }
        
        // Check if email exists
        const existingUser = await UserModel.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }
        
        // Create user (password stored as plaintext to match existing auth system)
        const user = await UserModel.create({
            fullName,
            email,
            password: password,  // Plaintext to match auth.controller.js
            role,
            balance: balance || 0
        });
        
        // Remove password from response
        const userResponse = user.toJSON();
        delete userResponse.password;
        
        return res.status(201).json({
            success: true,
            message: "User created successfully",
            data: userResponse
        });
        
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating user",
            error: error.message
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, role, balance } = req.body;
        
        const user = await UserModel.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Update fields
        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (role && ['student', 'teacher', 'admin'].includes(role)) user.role = role;
        if (balance !== undefined) user.balance = balance;
        
        await user.save();
        
        const userResponse = user.toJSON();
        delete userResponse.password;
        
        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: userResponse
        });
        
    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating user",
            error: error.message
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await UserModel.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Don't allow deleting yourself
        if (parseInt(id) === req.userId) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete your own account"
            });
        }
        
        await user.destroy();
        
        return res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message
        });
    }
};

export const adjustUserBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body;
        
        if (!amount || !reason) {
            return res.status(400).json({
                success: false,
                message: "Amount and reason are required"
            });
        }
        
        const user = await UserModel.findByPk(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        const oldBalance = parseFloat(user.balance);
        const newBalance = oldBalance + parseFloat(amount);
        
        if (newBalance < 0) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            });
        }
        
        user.balance = newBalance;
        await user.save();
        
        // TODO: Create transaction record for audit
        
        return res.status(200).json({
            success: true,
            message: "Balance adjusted successfully",
            data: {
                previousBalance: oldBalance,
                adjustAmount: parseFloat(amount),
                newBalance: newBalance,
                reason
            }
        });
        
    } catch (error) {
        console.error("Error adjusting balance:", error);
        return res.status(500).json({
            success: false,
            message: "Error adjusting balance",
            error: error.message
        });
    }
};

