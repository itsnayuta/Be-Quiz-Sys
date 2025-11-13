import db from '../models/index.model.js'
import authConfig from '../config/auth.config.js'
import jwt from 'jsonwebtoken'

import express from 'express'

const app = express()
const User = db.User;


export const signup = async (req ,res) => {
    try{
        const {fullName, email, password, role} = req.body;

        if (!fullName || !email || ! password || !role){
            return res.status(400).send({message: "Need to full information"});
        }

        const user = await User.create({
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


export const signin = async (req,res)