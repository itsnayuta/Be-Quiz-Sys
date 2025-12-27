import { Op } from "sequelize";
import { WithdrawHistoryModel, UserModel } from "../../models/index.model.js";
import sequelize from "../../config/db.config.js";

export const getAllWithdrawals = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = 'all',
            sortBy = 'created_at',
            order = 'DESC',
            fromDate,
            toDate
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (status !== 'all') {
            where.status = status;
        }

        // Lọc theo thời gian
        if (fromDate || toDate) {
            where.created_at = {};
            if (fromDate) {
                where.created_at[Op.gte] = new Date(fromDate);
            }
            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.created_at[Op.lte] = endDate;
            }
        }

        // Include user và search theo email
        const includeOptions = [
            {
                model: UserModel,
                as: 'user',
                attributes: ['id', 'fullName', 'email', 'balance'],
                where: search ? {
                    email: {
                        [Op.like]: `%${search}%`
                    }
                } : undefined
            },
            {
                model: UserModel,
                as: 'processedBy',
                attributes: ['id', 'fullName', 'email'],
                required: false
            }
        ];

        // Lấy danh sách withdrawals với pagination
        const { count, rows } = await WithdrawHistoryModel.findAndCountAll({
            where,
            include: includeOptions,
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true
        });

        // Tính toán summary statistics
        const summaryQuery = await WithdrawHistoryModel.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
            ],
            group: ['status'],
            raw: true
        });

        // Khởi tạo summary với giá trị mặc định
        const summary = {
            totalPending: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalAmountPending: 0,
            totalAmountApproved: 0
        };

        // Xử lý kết quả summary
        summaryQuery.forEach(item => {
            const status = item.status;
            const count = parseInt(item.count) || 0;
            const amount = parseFloat(item.total_amount) || 0;

            if (status === 'pending') {
                summary.totalPending = count;
                summary.totalAmountPending = amount;
            } else if (status === 'approved') {
                summary.totalApproved = count;
                summary.totalAmountApproved = amount;
            } else if (status === 'rejected') {
                summary.totalRejected = count;
            }
        });

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách rút tiền thành công",
            data: {
                withdrawals: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                },
                summary
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách rút tiền",
            error: error.message
        });
    }
};

export const approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_note } = req.body;
        const adminId = req.userId;

        // Tìm withdrawal request
        const withdrawal = await WithdrawHistoryModel.findByPk(id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        // Kiểm tra trạng thái hiện tại
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Không thể duyệt yêu cầu rút tiền đã ở trạng thái '${withdrawal.status}'`
            });
        }

        // Cập nhật trạng thái
        withdrawal.status = 'approved';
        withdrawal.admin_note = admin_note || null;
        withdrawal.processed_by = adminId;
        withdrawal.processed_at = new Date();

        await withdrawal.save();

        return res.status(200).json({
            success: true,
            message: "Đã duyệt yêu cầu rút tiền thành công",
            data: {
                id: withdrawal.id,
                status: withdrawal.status,
                admin_note: withdrawal.admin_note,
                processed_by: withdrawal.processed_by,
                processed_at: withdrawal.processed_at
            }
        });

    } catch (error) {
        console.error("Lỗi khi duyệt yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi duyệt yêu cầu rút tiền",
            error: error.message
        });
    }
};

export const rejectWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { reject_reason } = req.body;
        const adminId = req.userId;

        // Validate reject_reason
        if (!reject_reason || reject_reason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp lý do từ chối"
            });
        }

        // Tìm withdrawal request
        const withdrawal = await WithdrawHistoryModel.findByPk(id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        // Kiểm tra trạng thái hiện tại (có thể reject pending hoặc approved)
        if (withdrawal.status !== 'pending' && withdrawal.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: `Không thể từ chối yêu cầu rút tiền đã ở trạng thái '${withdrawal.status}'`
            });
        }

        // Cập nhật trạng thái
        withdrawal.status = 'rejected';
        withdrawal.reject_reason = reject_reason;
        withdrawal.processed_by = adminId;
        withdrawal.processed_at = new Date();

        await withdrawal.save();

        return res.status(200).json({
            success: true,
            message: "Đã từ chối yêu cầu rút tiền",
            data: {
                id: withdrawal.id,
                status: withdrawal.status,
                reject_reason: withdrawal.reject_reason,
                processed_by: withdrawal.processed_by,
                processed_at: withdrawal.processed_at
            }
        });

    } catch (error) {
        console.error("Lỗi khi từ chối yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi từ chối yêu cầu rút tiền",
            error: error.message
        });
    }
};

export const getWithdrawalById = async (req, res) => {
    try {
        const { id } = req.params;

        const withdrawal = await WithdrawHistoryModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'fullName', 'email', 'balance', 'phoneNumber', 'role']
                },
                {
                    model: UserModel,
                    as: 'processedBy',
                    attributes: ['id', 'fullName', 'email', 'role'],
                    required: false
                }
            ]
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy yêu cầu rút tiền"
            });
        }

        return res.status(200).json({
            success: true,
            data: withdrawal
        });

    } catch (error) {
        console.error("Lỗi khi lấy chi tiết yêu cầu rút tiền:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy chi tiết yêu cầu rút tiền",
            error: error.message
        });
    }
};
