import { text } from "express";
import {PostCommentsModel,PostClassesModel,UserModel,ClassesModel} from "../models/index.model.js";


// Create Post
export const CreatePost = async (req,res) => {
    try{


        const userId = req.userId;
        const {classId,title, post} = req.body;
        const createdPost = await PostClassesModel.create({
            user_id: userId,
            class_id: classId,
            title: title,
            text: post
        })
        
        const result = await PostClassesModel.findByPk(createdPost.id,{
            include: [{ model: UserModel, as: 'author', attributes: ['id', 'fullName'] }]
        })


        return res.status(200).send(result)
        

    }catch(error){
        return res.status(500).send({message: error.message})
    }
}

// Get List Post Of A Class
export const GetPostsClass = async (req,res) => {
    try{
        const classId = req.params.classId;

        const posts = await PostClassesModel.findAll({
            where: {
                class_id: classId
            },
            include:[
                {
                    model: UserModel,
                    as: 'author',
                    attributes: ['id','fullName']
                }
            ],
            order: [['created_at', 'DESC']]
        })

        res.status(200).send(posts);
    }
    catch(error){
        return res.status(500).send(error.message)
    }
}

export const CreateCommentClass = async (req,res) => {
    try{

        const userId = req.userId;
        const {classId,postId,commentId} = req.body;

        
        
    }catch(error){
        return res.status(500).send(error.message)
    }
}