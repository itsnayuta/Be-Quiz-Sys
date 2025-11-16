import { signin,signup } from "../controllers/auth.controller.js";

import CheckDuplicateEmail from "../middleware/verifySignUp.js";
const authRoutes = (app) => {
  

    app.post('/api/auth/signup' ,CheckDuplicateEmail,signup);
    app.post('/api/auth/signin',signin)
}



export default authRoutes