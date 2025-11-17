import { text } from "express";
import {PostCommentsModel,PostClassesModel,UserModel,ClassesModel} from "../models/index.model.js";


export const CreatePost = async (req,res) => {
    try{


        const userId = req.userId;
        const {classId,title, post} = req.body;

        console.log(req.body)

        const createdPost = await PostClassesModel.create({
            user_id: userId,
            class_id: classId,
            title: title,
            text: post
        })

        return res.status(200).send(createdPost)
        

    }catch(error){
        return res.status(500).send({message: error.message})
    }
}