const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res) => {
  //! Get tour data from collection

  const tours = await Tour.find();

  //! Build template

  //! Render that template using tour data from step 1

  res.status(200).render('overview', {
    title: 'All tours',
    tours: tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  //! find tour

  //   console.log(req.params);

  const { slug } = req.params;
  console.log('slug: ', slug);

  const tour = await Tour.findOne({ slug: slug });
  console.log(tour);
  res.status(200).render('tour', {
    title: 'The Forest Hiker Tour',
  });
});
