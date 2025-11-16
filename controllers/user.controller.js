import { verifyToken } from "../middleware/authJWT.js";

import UserModel from "../models/user.model.js";


export const GetProfileInfo = async (req,res) => {
    try{

        const userId = req.userId;

        const userInfor = await UserModel.findOne({
            where: {
                id: userId
            },
            attributes: {exclude: ['password']}
        })

        if(!userInfor){
            res.status(401).send({message: "User not found"})
        }

        res.status(200).send(userInfor)

    }catch(error){
        res.status(500).send({message: error.message})
    }
}