const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  //! tạo token
  const token = signToken(user._id);

  //! tạo cookie
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // secure: true, //! --> specify only working with https ( nếu đang là dev environment thì ko set)
    httpOnly: true, //! ---> make  cookie can not be accessed or modified in anyway by the browser --> prevent cross-site scripting attacks
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //! remove password from output
  user.password = undefined;

  //! gửi về user
  res.status(statusCode).json({
    status: 'success',
    token: token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  //   const newUser = await User.create(req.body);
  //! dòng này cuối của seasion JONAS mới sửa lại
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //! 1) Check if email and password được điền vào đầy đủ ko ?

  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  //! 2) Check if user exits && password is correct

  const user = await User.findOne({ email: email }).select('+password'); //! password trong model dc cài select là false==> ẩn khi dùng hàm find==> muốn find hiển thị ra được thì phải  dùng select

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //! 3) If everything ok, send token to client

  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  //! 1) Getting token and check of it's there ( Kiểm tra có token hay ko )

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access', 401)
    );
  }
  //! 2) Verification token (xác thực)
  //! tức là jwt.verify là hàm async==> the third param sẽ là một callback==> nhưng muốn tránh callback hell==> thay thế việc nhảy vào callback = việc nhảy vào then catch ==> chuyển đổi hàm based on callback thành hàm based on promise ==> dùng promissify ==> khi trả về promise rồi thì thay vì dùng then catch, ta sẽ dùng async await
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //! 3) Check if user still exits ( nghĩa nếu user tạo xong và được cấp cho token rồi nhưng user sau đó đã bị xóa thì cũng từ chối token đó )
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does no longer exits', 401)
    );
  }

  //! 4)Check if user changed password after the token was issued (tức là nếu lỡ người nào biết được mật khẩu cũ này và cố tình dùng nó để đăng nhập thì vẫn đăng nhập dc==> ko ổn===> phải tránh trường hợp này)

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }

  //! đến đây mới grant access to proteced route

  req.user = currentUser;

  next();
});
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    //! nếu roles khác với roles thì đẩy thẳng qua lỗi
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You don't have permission to perform this action", 403)
      );
    }
    next();
  };
};

exports.forgotPassword = async (req, res, next) => {
  //! 1) Get user based on posted email ( lấy user dựa trên email được gửi lên )

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('There is no user with email address', 404));
  }

  //! 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); //! để lưu lên database vì trong model chưa có lệnh save(), validateBeforeSave là false thì nó sẽ chỉ save mà ko validate lại các phần tử của document

  //! 3) Send it to user's email

  //todo: tạo URL để user click vào và thực hiện việc đổi mật khẩu

  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  //todo: viết message

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}. \n If you did not forget your password, please ignore this email!`;

  //todo: ---> thực hiện việc gửi mail chứa URL và message

  try {
    await sendEmail({
      email: user.email,
      submit: 'Your password reset token(valid for 10min)',
      message: message,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
  res.status(200).json({
    status: 'success',
    message: 'Token sent to email!',
  });
};
exports.resetPassword = catchAsync(async (req, res, next) => {
  //! 1) Get user based on the token
  //todo1: chuyển token về dạng hash để so sánh
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  //todo2: từ hashed token==> tìm user ( check cả hashed token và ngày hết hạn ( expires ) )

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //! 2) If token has not expired, and there is user, set the new password

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  //! 3) Update changedPasswordAt property for the user
  //todo: đã thêm code vào model
  //! 4) Log the user in, send new JWT to client ( tức là gửi JWT về cho user đăng nhập, front end xử lý đoạn tự đăng nhập )
  createSendToken(user, 200, res);
});
exports.updatePassword = catchAsync(async (req, res, next) => {
  //! 1) Get user from collection
  //todo: gọi middleware protect để xác thực và lấy thông tin user

  const user = await User.findById(req.user._id).select('+password');

  //! 2) Check if Posted current password is correct

  //todo: encrypt this current password---> then, compare this encrypted password with the password in database

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //! 3) If so, update password

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //! 4) Log user in ( gửi JWT về cho user )
  createSendToken(user, 200, res);
});
