import { UserModel, ClassesModel,ClassStudentModel } from "../models/index.model.js";  // Import từ index.model.js

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

// Get list class for teacher and student

export const getClasses = async (req, res) => {
    

    try {
        const userId = req.userId;
        const role = req.role;

        if(role === 'teacher'){
            const taughtClasses = await UserModel.findOne({
                where: {
                    id: userId
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

        }

        else{
            const joinedClass = await UserModel.findOne({
                where: {
                    id: userId,
                },
                include: [
                    {
                        model: ClassesModel,
                        as: 'joinedClasses' // 'teacher' ,
                    
                    }
                ],
                attributes: ['id','fullName','role','email']
            });
    
            return res.status(200).send(joinedClass);
        };
        

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// join class

export const joinClassByCode = async (req, res) => {
    try {
        const role = req.role;
        const userId = req.userId;
        const code = req.query.code;


        if (role === 'teacher') {
            return res.status(400).send("You must be a student to join this class");
        }

        const joinClassInfo = await ClassesModel.findOne({
            where: {
                classCode: code.toUpperCase()
            }
        });

        if (!joinClassInfo) {
            return res.status(404).send("Class not found");
        }

        const existingEnrollment = await ClassStudentModel.findOne({
            where: {
                class_id: joinClassInfo.id,
                student_id: userId          
            }
        });

        if (existingEnrollment) {
            if (existingEnrollment.is_ban) {
                return res.status(400).send({ message: "You have been removed from this class" });
            }
            return res.status(400).send({ message: "You have already joined this class" });
        }

    
        const classStudent = await ClassStudentModel.create({
            class_id: joinClassInfo.id,
            student_id: userId,
            joined_at: new Date(),
            is_ban: false  
        });

 
        return res.status(200).send({ message: "Join class success", class: classStudent });

    } catch (error) {

        return res.status(500).send({ message: error.message });
    }
};


export const GetStudentFromClass = async (req,res) => {
    try{
        const classCode = req.query.class;

        const classInfor = await ClassesModel.findOne({
            where: {
                classCode: classCode
            }
        })

        if(!classInfor){
            return res.status(404).send("Class not found")
        }

        const listStudent = await ClassesModel.findOne({
            where: {
                id: classInfor.id
            },
            
            include: [
                {
                    model: UserModel,
                    as: "students"
                }
            ]

        })

        return res.status(200).send(listStudent)
    }catch(error){
        return res.status(500).send({message: error.message})
    }
}


export const BanStudent = async(req,res) => {
    try{

        const {classId,student_id} = req.body;

        const classStudent = await ClassStudentModel.findOne({
            where: {
                class_id: classId,
                student_id: student_id
            }
        })

        classStudent.is_ban = true

        await classStudent.save()

        return res.status(200).send("Ban Successfully")
        
    }catch(error){
        return res.status(500).send({message: error.message})
    }
}

export const DeleteClass = async(req,res) => {
    try{

        const {classId} = req.body

        const deletedClass = await ClassesModel.destroy({
            where: {
                id: classId
            }
        })

        if (!deletedClass) {
            return res.status(404).send({ message: "Class not found." });
        }


        return res.status(200).send("Delete Successfully")

    }catch(error){
        return res.status(500).send({message: message.error})
    }
}