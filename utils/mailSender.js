import nodemailer from 'nodemailer';

export const sendOTPEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "ptitagent@gmail.com",
                pass: "wnjx eptx agom aizv"
            }
        })

        await transporter.sendMail({
            from: "ptitagent@gmail.com",
            to: email,
            subject: "OTP for verification",
            text: `Your OTP is ${otp}`
        })
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}
