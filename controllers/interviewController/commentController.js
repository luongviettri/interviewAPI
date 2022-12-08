const Comment = require('../../models/interviewModals/commentModel');
const factory = require('../handlerFactory');

exports.setCommentOnPost = (req, res, next) => {
  //! Allow nested routes
  if (!req.body.post) req.body.post = req.params.postId; //! lấy từ param
  next();
};

exports.getAllComment = factory.getAll(Comment);
exports.getComment = factory.getOne(Comment);
exports.createComment = factory.createOne(Comment);
exports.deleteComment = factory.deleteOne(Comment);
exports.updateComment = factory.updateOne(Comment);
