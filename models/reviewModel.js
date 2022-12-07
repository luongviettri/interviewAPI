const mongoose = require('mongoose');
const Tour = require('./tourModel');

//! Create Schema
const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  {
    //! chỗ tham số t2 là object options===> cài đặt khi this tour được output nếu là dạng JSON or OBJECT thì cũng output ra những virtual properties---> mục đích là để in ra cái virtual properties
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

//! QUERY MIDDLEWARE
reviewSchema.pre(/^find/, function (next) {
  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

/**
 * ! Khai báo hàm static để tính average ratings (nhưng chưa dùng )
 * @param {*} tourId : tourID của this review
 */
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }, //! match những review nào có tour = tour trên tham số
    },
    {
      //! sau đó groupBy tourID(TH này có thể để ID = null vì chỉ có 1 tour được match)
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  if (stats.length > 0) {
    //! lưu lên database
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

//! DOCUMENT MIDDLEWARE
//todo dùng post vì sau khi save mới tính average
reviewSchema.post('save', function () {
  //todo this points to current document
  // Review.calcAverageRatings(this.tour); //todo calcAverageRatings là hàm static nên phải dùng Model để gọi nhưng Model Review được khai báo sau cho nên phải thay thế Model = this.constructor như dưới đây
  this.constructor.calcAverageRatings(this.tour);
});

//! STILL QUERY MIDDLEWARE

reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne(); //! r = this review
  console.log(this.r);
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  //! have to use this middle because this.findOne() does not work here, ( query has already executed )

  await this.r.constructor.calcAverageRatings(this.r.tour); //! meaning Model.calcAverageRating, this.r = this review. --> this review.constructor = Model
});

//todo Create model
const Review = mongoose.model('Review', reviewSchema);
//todo export
module.exports = Review;
