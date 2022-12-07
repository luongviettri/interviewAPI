const Review = require('../models/reviewModel');
// const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

// = catchAsync(async (req, res, next) => {

//   const reviews = await Review.find(filter);

//   res.status(200).json({
//     status: 'success',
//     results: reviews.length,
//     data: {
//       reviews: reviews,
//     },
//   });
// });

exports.setTourUserIds = (req, res, next) => {
  //! Allow nested routes
  if (!req.body.tour) req.body.tour = req.params.tourId; //! lấy từ param
  if (!req.body.user) req.body.user = req.user.id; //! lấy từ JWT
  next();
};
exports.getAllReview = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = factory.createOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.updateReview = factory.updateOne(Review);
