const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');

// const validator = require('validator');
//! create Tour Schema
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (value) => {
        //! value = giá trị ratingsAverage hiện tại
        //! 4.6666666 ---> 46.66 --> 47 ---> 4.7
        return Math.round(value * 10) / 10;
      },
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        //! val --> trỏ đến priceDiscount
        validator: function (val) {
          //!RIÊNG ở trong hàm validator, this chỉ trỏ đến document hiện tại khi nó được tạo mới ( create or save  )
          return val < this.price;
        },
        message: 'Discount price({VALUE}) should be below regular price', //! VALUE trỏ đến priceDiscount( cú pháp riêng biệt của mongoose)
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, //! sẽ ko hiển thị ra khi gửi về user
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      //geoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    //! chỗ tham số t2 là object options===> cài đặt khi this tour được output nếu là dạng JSON or OBJECT thì cũng output ra những virtual properties---> mục đích là để in ra cái virtual properties
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
//! tạo index price xếp theo thứ tự bé đến lớn, sau đó tạo compoundIndex--> dùng componendIndex thì ko cần dùng 1 mỗi cái 1 mình nữa
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

//! create virtual field ( or virtual property )
tourSchema.virtual('durationWeek').get(function () {
  return this.duration / 7; //! chỗ này callback ko dùng được arrowFunction vì arrowFunction không nhận this
});
//! create virtual populate ( để populate dc reviews mà ko thật sự lưu reviews trong database )

tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

//! DOCUMENT MIDDLEWARE: just run before .save() or .create() mongoose methods (not update, delete or filter,.. )

tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true }); //! this ở đây trỏ đến document
  next();
});

// tourSchema.pre('save', async function (next) {
//   //! User.findById sẽ trả về query có thể dùng then, nhưng muốn biến nó thành chính xác là một promise thì phải dùng  hàm exec()

//   const guidesPromises = this.guides.map((id) => User.findById(id).exec());

//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document....');
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });
//! QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } }); //! vì Schemar có field secretTour để default là false cho nên khi trả về từ postman kể cả khi giá trị field này là rỗng thì vẫn trả về là false ( vì phải tuân theo schema) nhưng trên database thì ta thấy thực tế lúc tạo ra các data cũ thì field này thật sự là rỗng ( mở dạng table để xem rõ hơn )

  this.start = Date.now();

  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} miliseconds `);
  next();
});

//! AGGREGATION MIDDLEWARE

// tourSchema.pre('aggregate', function (next) {
//   //!   this.pipeline()---> aggregation hiện đang có
//   //! chỉ cần thêm 1 stage vào trước của pipeline ( 1 khái niệm trong aggregation) là được
//   this.pipeline().unshift({
//     $match: { secretTour: { $ne: true } },
//   });
//   next();
// });

//! create Model

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
