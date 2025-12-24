import { Op } from "sequelize";
import { DepositHistoryModel } from "../models/index.model.js";

export const markExpiredDeposits = async () => {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const expiredDeposits = await DepositHistoryModel.findAll({
            where: {
                deposit_status: "pending",
                created_at: {
                    [Op.lt]: fiveMinutesAgo,
                },
            },
            limit: 50,
        });

        for (const deposit of expiredDeposits) {
            try {
                await deposit.update({
                    deposit_status: "failed",
                });
            } catch (err) {
                console.error(`Failed to mark deposit ${deposit.id} as failed:`, err.message);
            }
        }
    } catch (error) {
        console.error("Error while marking expired deposits:", error.message);
    }
};

let depositSchedulerInterval = null;

export const startDepositExpiryScheduler = (intervalMs = 60000) => {
    if (depositSchedulerInterval) {
        return;
    }

    depositSchedulerInterval = setInterval(() => {
        markExpiredDeposits().catch((error) => {
            console.error("Deposit expiry scheduler error:", error.message);
        });
    }, intervalMs);
};


