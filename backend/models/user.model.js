import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minLength: [6, 'Email must be at least 6 characters'],
    maxLength: [50, 'Email must not be longer than 50 characters'],
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.__v;
      return ret;
    },
  },
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.isValidPassword = function isValidPassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateJWT = function generateJWT() {
  return jwt.sign(
    { id: this._id.toString(), email: this.email },
    process.env.JWT_SECRET || 'dev-only-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );
};

const User = mongoose.model('user', userSchema);

export default User;
