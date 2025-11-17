import { verifyTeacher,verifyStudent, verifyToken } from "../middleware/authJWT.js";
import { CreatePost,GetPostsClass,CreateCommentPost } from "../controllers/posts.controller.js";

const postRoutes = (app) =>{
    

    // Create Post
    app.post('/api/posts/create',verifyToken,verifyTeacher,CreatePost)

    //Get All Post From A Class
    app.get('/api/classes/:classId/posts',verifyToken,GetPostsClass)

    // Create Comment A Post

    app.post('/api/posts/comment',verifyToken,CreateCommentPost)
}

export default postRoutes;