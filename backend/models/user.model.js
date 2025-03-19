import mongoose from "mongoose"; 
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema= new mongoose.Schema({
    email:{

        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        minLength: [ 6, 'Email must be at least 6 characters'],
        maxLength: [ 50, 'Email must not be longer than 50 characters']

    },
    password:{
        type:String,
        required:true,
        select: false,
    },
})


userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});


userSchema.methods.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateJWT = function () {
    return jwt.sign(
        {email: this.email},
         process.env.JWT_SECRET,
         { expiresIn: '24h'} );
}


const User = mongoose.model('user', userSchema);

export default User;