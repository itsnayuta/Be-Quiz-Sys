import { verifyToken, verifyAdmin } from "../middleware/authJWT.js";
import {
    createDepositRequest,
    sepayWebhook,
    getDepositHistory,
    getWithdrawHistory,
    getTransactionHistory,
    adminAddBalance
} from "../controllers/wallet.controller.js";

export default function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Người dùng yêu cầu nạp tiền -> tạo deposit pending + trả QR base64
    app.post(
        "/api/wallet/deposit",
        [verifyToken],
        createDepositRequest
    );

    // Webhook từ SePay (không dùng verifyToken)
    app.post(
        "/api/wallet/deposit/webhook",
        sepayWebhook
    );

    // Lấy danh sách deposit_history
    app.get(
        "/api/wallet/deposit-history",
        [verifyToken],
        getDepositHistory
    );

    // Lấy danh sách withdrawn_history
    app.get(
        "/api/wallet/withdraw-history",
        [verifyToken],
        getWithdrawHistory
    );

    // Lấy danh sách transactions_history
    app.get(
        "/api/wallet/transaction-history",
        [verifyToken],
        getTransactionHistory
    );

    // Admin cộng tiền cho user
    app.post(
        "/api/wallet/admin/add-balance",
        [verifyToken, verifyAdmin],
        adminAddBalance
    );
}

