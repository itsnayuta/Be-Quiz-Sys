import {UserModel} from "../models/index.model.js";
import {RecentLoginModel} from "../models/index.model.js";

// Get information of a user
export const GetProfileInfo = async (req,res) => {
    try{

        const userId = req.userId;

        

        const userInfor = await UserModel.findOne({
            where: {
                id: userId
            },
            attributes: {exclude: ['password']},
            include: [
                {
                    model:RecentLoginModel,
                    as: 'login_list',
                    separate: true,
                    limit: 5,       
                    order: [
                        ['login_time', 'DESC'] 
                    ]
                }
               
            ]
        })

        if(!userInfor){
            return res.status(401).send({message: "User not found"})
        }

        return res.status(200).send(userInfor)

    }catch(error){
        return res.status(500).send({message: error.message})
    }
}


// Update profile
export const UpdateProfileInfo = async (req,res) => {

    try{

        const userId = req.userId;

        const {fullName, email} = req.body;
    
        if (!fullName || !email){
            res.status(400).send("Missing information");
        }

        //Check if user existed?
        
        const userInfor = await UserModel.findOne({where: {id: userId}, attributes: {exclude: ["password"]}});

        if(!userInfor){
            return res.status(404).send("Not found User")
        }

        userInfor.fullName = fullName;
        userInfor.email = email;

        await userInfor.save()
        

        return res.status(200).send({message: "Updated Successfully", user: {userInfor}})

    }catch(error){
        return res.status(500).send({message: error.message})
    }

}

// note:

export const ChangePassword = async(req,res) => {
    try{

        const userId = req.userId;

        const {currentPassword,newPassword} = req.body

        const userInfo = await UserModel.findOne({where:{id: userId}})


        if(currentPassword !== userInfo.password){
            return res.status(403).send({status: false, message: "Password not match"});
        }

        userInfo.password = newPassword;

        await userInfo.save()

        return res.status(200).send({status: true, message: "Đổi mật khẩu thành công"})

        

    }catch(error){
        return res.status(500).send({status:false, message: error.message})
    }
}