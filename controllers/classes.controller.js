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
                include:teacherInclude
      
            });
        } else {

            console.log(userId)
          
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
                    },

                    teacherInclude,
                ],

                
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


       

        const joinClassInfo = await ClassesModel.findOne({
            where: {
                classCode: code.toUpperCase()
            }
        });

        if (!joinClassInfo) {
            return res.status(404).send({status: false, message: "Class not found"});
        }

        const existingEnrollment = await ClassStudentModel.findOne({
            where: {
                class_id: joinClassInfo.id,
                student_id: userId          
            }
        });

        if (existingEnrollment) {
            if (existingEnrollment.is_ban) {
                return res.status(400).send({ status: false, message: "You have been removed from this class" });
            }
            return res.status(400).send({ status: false, message: "You have already joined this class" });
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
            
        }

        return res.status(200).send({ status: true, class: classStudent });

    } catch (error) {

        return res.status(500).send({ status: false,message: error.message });
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

//Ban/Unban student

export const BanStudent = async(req,res) => {
    try{

        const {classId, class_id, student_id, is_banned} = req.body;

        // Support both classId and class_id for backward compatibility
        const classIdValue = classId || class_id;

        // Validate required fields
        if (!classIdValue || !student_id) {
            return res.status(400).send({ 
                status: false, 
                message: 'Missing required fields: classId (or class_id) and student_id' 
            });
        }

        // Validate is_banned is boolean
        if (typeof is_banned !== 'boolean') {
            return res.status(400).send({ 
                status: false, 
                message: 'is_banned must be a boolean value' 
            });
        }

        // Find the class-student relationship
        const classStudent = await ClassStudentModel.findOne({
            where: {
                class_id: classIdValue,
                student_id: student_id
            }
        })

        if (!classStudent) {
            return res.status(404).send({ 
                status: false, 
                message: 'Student not found in this class' 
            });
        }

        // Update ban status
        classStudent.is_ban = is_banned;
        await classStudent.save();

        return res.status(200).send({
            status: true,
            message: is_banned ? 'Student banned successfully' : 'Student unbanned successfully',
            data: {
                student_id: student_id,
                class_id: classIdValue,
                is_ban: is_banned
            }
        });
        
    }catch(error){
        console.error('Error updating student ban status:', error);
        return res.status(500).send({
            status: false,
            message: error.message || 'Internal server error'
        });
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