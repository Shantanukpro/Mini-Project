import mongoose from 'mongoose';

function connect() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. Database features will be unavailable.');
    return;
  }

  setTimeout(() => {
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000),
    })
      .then(() => {
        console.log('Connected to MongoDB');
      })
      .catch((error) => {
        console.error('MongoDB connection failed:', error.message);
      });
  }, 0);
}

export default connect;
