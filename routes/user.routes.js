import { GetProfileInfo } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/authJWT.js";



const authUser = (app) => {
   
    app.get('/api/user/me',verifyToken,GetProfileInfo)
}

export default authUser;