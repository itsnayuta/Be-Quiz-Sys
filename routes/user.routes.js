import { GetProfileInfo,UpdateProfileInfo,ChangePassword } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/authJWT.js";



const authUser = (app) => {
   
    // Get user profile
    app.get('/api/user/profile',verifyToken,GetProfileInfo);

    //
    app.post('/api/user/profile',verifyToken,UpdateProfileInfo);
    app.post('/api/user/changepassword',verifyToken,ChangePassword)
}


export default authUser;