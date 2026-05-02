import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minLength: [2, 'Name must be at least 2 characters'],
    maxLength: [60, 'Name must not be longer than 60 characters'],
  },
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

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isValidPassword = function isValidPassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.generateJWT = function generateJWT() {
  return jwt.sign(
    { id: this._id.toString(), email: this.email, name: this.name },
    process.env.JWT_SECRET || 'dev-only-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );
};

const User = mongoose.model('user', userSchema);

export default User;
