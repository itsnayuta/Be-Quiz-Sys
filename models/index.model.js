import UserModel from "./user.model.js";
import ClassesModel from "./classes.model.js";

// Đảm bảo các mối quan hệ được định nghĩa đúng
UserModel.hasMany(ClassesModel, {
  foreignKey: 'teacher_id',  // Khóa ngoại trong bảng Classes
  as: 'classes'        // Alias để truy cập các lớp dạy
});

ClassesModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',  // Khóa ngoại trong bảng Classes
  as: 'teacher'              // Alias để truy cập giáo viên của lớp
});


export { UserModel, ClassesModel };