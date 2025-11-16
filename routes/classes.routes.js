import { createClass,getClasses } from "../controllers/classes.controller.js";
import { verifyToken,verifyTeacher } from "../middleware/authJWT.js";


const authClasses = (app) =>{
    app.post('/api/classes',verifyToken,verifyTeacher,createClass)
    app.get('/api/classes',verifyToken,getClasses)
}


export default authClasses;