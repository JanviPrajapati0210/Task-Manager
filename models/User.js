const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Password is required only for email/password accounts.
    // Accounts created through Google login have no password.
    password: {
      type: String,
      required: [
        function () {
          return !this.googleId;
        },
        'Password is required',
      ],
    },
    // Google account id ("sub" claim). sparse: many users may have none.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      default: '',
    },
    picture: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);