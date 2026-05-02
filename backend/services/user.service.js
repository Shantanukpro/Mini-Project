import userModel from '../models/user.model.js';

export const createUser = async ({ name, email, password }) => {
  const normalizedName = name?.trim();
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedName || !normalizedEmail || !password) {
    throw new Error('Please provide name, email, and password.');
  }

  return userModel.create({
    name: normalizedName,
    email: normalizedEmail,
    password,
  });
};
