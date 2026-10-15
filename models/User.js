const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // sparse + unique: accounts created before usernames existed have none
    username: {
      type: String,
      trim: true,
      minlength: [3, 'Username must contain at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      unique: true,
      sparse: true,
    },
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
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    name: {
      type: String,
      default: '',
    },
    picture: {
      type: String,
      default: '',
    },
    // Role-based access control: user / employee < manager < admin
    role: {
      type: String,
      enum: ['user', 'employee', 'manager', 'admin'],
      default: 'user',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Password reset: only the SHA-256 HASH of the emailed token is stored
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);