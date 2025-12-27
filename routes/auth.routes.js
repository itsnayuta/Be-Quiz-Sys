import {
    signin,
    signup,
    sendOTP,
    sendOTPForForgotPassword,
    resetPassword,
    sendOTPForWithdraw,
    verifyOTPAndWithdraw
} from "../controllers/auth.controller.js";

import CheckDuplicateEmail from "../middleware/verifySignUp.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const authRoutes = (app) => {

    // Đăng ký
    app.post('/api/auth/send-otp-signup', CheckDuplicateEmail, sendOTP);
    app.post('/api/auth/signup', CheckDuplicateEmail, signup);

    // Đăng nhập
    app.post('/api/auth/signin', signin);

    // Quên mật khẩu
    app.post('/api/auth/forgot-password/send-otp', sendOTPForForgotPassword);
    app.post('/api/auth/forgot-password/reset', resetPassword);

    // Rút tiền với OTP (teacher)
    app.post('/api/auth/withdraw/send-otp', verifyToken, verifyTeacher, sendOTPForWithdraw);
    app.post('/api/auth/withdraw/verify-otp', verifyToken, verifyTeacher, verifyOTPAndWithdraw);
}



export default authRoutes