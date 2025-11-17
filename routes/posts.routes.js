import { verifyTeacher,verifyStudent, verifyToken } from "../middleware/authJWT.js";
import { CreatePost } from "../controllers/posts.controller.js";
const postRoutes = (app) =>{
    

    // Create Post

    app.post('/api/posts/create',verifyToken,verifyTeacher,CreatePost)
}

export default postRoutes;