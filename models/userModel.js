const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: String,
  role: {
    type: String,
    enum: ['admin', 'guide', 'lead-guide', 'user'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      //! el bên dưới trỏ đến passwordConfirm
      //! this trong validator chỉ hoạt động đúng (trỏ đến password) khi chúng ta tạo mới user (create or save)
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  //! Only run this function if password was acctually modified
  if (!this.isModified('password')) return next();
  //! Hash the password with cost of 12
  //todo: chỗ này cost = 12---> cost càng lớn thì độ phức tạp hash càng cao
  //todo: bcrypt.hash là async==> phải có await
  this.password = await bcrypt.hash(this.password, 12);
  //! Delete passwordConfirm field so it will not be saved on the database
  this.passwordConfirm = undefined;
  next();
});
//! middleware dùng để tự động ghi lại passwordChangedAt khi đổi mật khẩu
userSchema.pre('save', function (next) {
  //todo1: nếu ko phải là đổi mật khẩu hoặc nếu là tạo mới user thì bỏ qua middleware này

  if (!this.isModified('password') || this.isNew) return next();

  //todo2: set passwordChangedAt ---> và in practice, code này có thể chạy chậm hơn kì vọng vì có thể lưu vào database chậm---> cần phải -1 giây để chắc chắn nó được lưu vào database trước khi token được tạo ra và trả về user

  this.passwordChangedAt = Date.now() - 1000;

  next();
});

//! cái bên dưới gọi là instance method ==> tất cả các document của collection ( hay là tất cả row trong table) đều dùng được
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    //! chuyển đơn vị ngày về đơn vị có thể so sánh được với timestamp
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto

    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  console.log('resetToken: ', resetToken);
  console.log('passwordResetToken: ', this.passwordResetToken);
  return resetToken;
};

userSchema.pre(/^find/, function (next) {
  //! this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
