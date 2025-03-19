import jwt from "jsonwebtoken";

export const authUser = async (req, res, next) => {
try {
 const taken = req.cookies.token || req.headers.authorization.split(' ')[1];

 if (!token) {
    return res.status(401).send({ error: 'Unauthorized User' });
 }

 const decoded = jwt.verify(taken, process.env.JWT_SECRET);
 req.user = decoded;
 next();
} catch (error) { 
    console.error(error);   
    res.status(401).send({ error: 'Unauthorized User' });
}

}