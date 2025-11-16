
import authConfig from '../config/auth.config.js'
import jwt from 'jsonwebtoken'


import {UserModel} from '../models/index.model.js'
// Sign In / Sign Up module

export const signup = async (req ,res) => {
    try{
        const {fullName, email, password, role} = req.body;

        if (!fullName || !email || !password || !role){
            return res.status(400).send({message: "Need to full information"});
        }
        
        
        const user = await UserModel.create({
            fullName: fullName,
            email: email,
            password: password,
            role: role
        })

        res.status(201).send({message: 'Register Success Fully'});
        
    } catch(error){
        res.status(500).send({message: error.message})
    }
}


export const signin = async (req,res) => {
    try{
        const {email,password} = req.body;

        if (!email || !password) {
            return res.status(400).send({message: "Need full information"})
        }

        const user = await UserModel.findOne({where: {email: email}})
        

        if(!user){
            return res.status(404).send({message: 'Not found email'})

        }

        const passwordisValid = (user.password === password)

        if(!passwordisValid){
            return res.status(401).send({access_token: null, message: "Wrong password!!"})
        }

        const token = jwt.sign({id:user.id, role:user.role},authConfig.secret,{expiresIn: authConfig.jwtExpiration})

        user.last_login = new Date();

        await user.save()

        res.status(200).send({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            accessToken: token
        })


    } catch(error){
        res.status(500).send({message: error.message})
    }
}

