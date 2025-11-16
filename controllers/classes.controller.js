import { UserModel, ClassesModel } from "../models/index.model.js";  // Import từ index.model.js

export const createClass = async (req, res) => {
    try {
        const { className } = req.body;
        const teacher_id = req.userId; // Get from middleware

        if (!className) {
            return res.status(400).send({ message: 'Missing classname !!!' });
        }

        const classCreate = await ClassesModel.create({
            className: className,
            teacher_id: teacher_id
        });

        return res.status(201).send(classCreate);

    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

// Get list class for teacher

export const getClasses = async (req, res) => {
    const teacher_id = req.userId;

    try {
        const taughtClasses = await UserModel.findOne({
            where: {
                id: teacher_id
            },
            include: [
                {
                    model: ClassesModel,
                    as: 'classes' // 'teacher' ,
                

                }
            ],
            attributes: ['id','fullName','role','email']
        });

        return res.status(200).send(taughtClasses);

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// join class

// export const joinClass = async (req,res)
