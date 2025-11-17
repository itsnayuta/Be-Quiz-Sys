import UserModel from "./user.model.js";
import ClassesModel from "./classes.model.js";
import ClassStudentModel from "./class_student.model.js";
import ExamModel from "./exam.model.js";
import QuestionModel from "./question.model.js";
import QuestionAnswerModel from "./question_answer.model.js";
import ExamFavoriteModel from "./exam_favorite.model.js";

// User(Teacher) 1-N Classes
UserModel.hasMany(ClassesModel, {
  foreignKey: 'teacher_id', 
  as: 'classes'     
});

ClassesModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',  
  as: 'teacher'            
});

// User(Student) N-N Classes through (ClassStudent)
UserModel.belongsToMany(ClassesModel,{
  through: ClassStudentModel,
  foreignKey: 'student_id',
  otherKey: 'class_id',
  as: 'joinedClasses'
});

ClassesModel.belongsToMany(UserModel,{
  through: ClassStudentModel,
  foreignKey: 'class_id',
  otherKey: 'student_id',
  as: 'students'
});

// Classes 1-N Exams (class_id có thể null)
ClassesModel.hasMany(ExamModel, {
  foreignKey: 'class_id',
  as: 'exams',
  onDelete: 'SET NULL'
});

ExamModel.belongsTo(ClassesModel, {
  foreignKey: 'class_id',
  as: 'class',
  onDelete: 'SET NULL'
});

// User(Teacher) 1-N Exams
UserModel.hasMany(ExamModel, {
  foreignKey: 'created_by',
  as: 'createdExams'
});

ExamModel.belongsTo(UserModel, {
  foreignKey: 'created_by',
  as: 'creator'
});

// Exams 1-N Questions
ExamModel.hasMany(QuestionModel, {
  foreignKey: 'exam_id',
  as: 'questions'
});

QuestionModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

// User(Teacher) 1-N Questions
UserModel.hasMany(QuestionModel, {
  foreignKey: 'teacher_id',
  as: 'questions'
});

QuestionModel.belongsTo(UserModel, {
  foreignKey: 'teacher_id',
  as: 'teacher'
});

// Questions 1-N Question_answers
QuestionModel.hasMany(QuestionAnswerModel, {
  foreignKey: 'question_id',
  as: 'answers'
});

QuestionAnswerModel.belongsTo(QuestionModel, {
  foreignKey: 'question_id',
  as: 'question'
});

// User N-N Exams through Exam_favorites (Favorite exams)
UserModel.belongsToMany(ExamModel, {
  through: ExamFavoriteModel,
  foreignKey: 'user_id',
  otherKey: 'exam_id',
  as: 'favoriteExams'
});

ExamModel.belongsToMany(UserModel, {
  through: ExamFavoriteModel,
  foreignKey: 'exam_id',
  otherKey: 'user_id',
  as: 'favoritedBy'
});

ExamFavoriteModel.belongsTo(UserModel, {
  foreignKey: 'user_id',
  as: 'user'
});

ExamFavoriteModel.belongsTo(ExamModel, {
  foreignKey: 'exam_id',
  as: 'exam'
});

export { UserModel, ClassesModel, ClassStudentModel, ExamModel, QuestionModel, QuestionAnswerModel, ExamFavoriteModel };