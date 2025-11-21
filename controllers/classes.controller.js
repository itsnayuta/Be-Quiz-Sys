import { UserModel, ClassesModel,ClassStudentModel } from "../models/index.model.js";
import { notifyStudentJoinedClass } from "../services/notification.service.js";  // Import từ index.model.js

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
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;

        const teacherInclude = {
            model: UserModel,
            as: 'teacher',
            attributes: ['fullName'] 
        };

        let result;

        if (role === 'teacher') {
           
            result = await ClassesModel.findAndCountAll({
                where: {
                    teacher_id: userId
                },
                limit: limit,
                offset: offset,
           
      
            });
        } else {
          
            result = await ClassesModel.findAndCountAll({
                limit: limit,
                offset: offset,
                include: [
                    {
                        model: UserModel,
                        as: 'students',
                        where: {
                            id: userId 
                        },
                        attributes: [] 
                    }
                ],
                include:teacherInclude
                
            });
        }

        return res.status(200).send({ 
            status: true, 
            data: result.rows, 
            total: result.count,
            pagination: {
                limit,
                offset
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ status: false, message: error.message });
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

        // Gửi thông báo cho giáo viên
        try {
            await notifyStudentJoinedClass(userId, joinClassInfo.id);
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Không fail request nếu thông báo lỗi
        }

        return res.status(200).send({ message: "Join class success", class: classStudent });

    } catch (error) {

        return res.status(500).send({ message: error.message });
    }
};

//get list student from class

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

//Ban student

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

// Delete Class
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